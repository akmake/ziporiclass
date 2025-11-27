import mongoose from 'mongoose';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';

// טעינת המודלים ממסד הנתונים החדש
import User from './models/userModel.js';
import Transaction from './models/Transaction.js';
import FinanceProfile from './models/FinanceProfile.js';

dotenv.config();

// ===================================================================
// --- ⚙️ הגדרות: שנה את 3 הערכים הבאים ---
// ===================================================================

// 1. כתובת החיבור למסד הנתונים החדש (MongoDB)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your_db_name';

// 2. הנתיב המלא לקובץ מסד הנתונים הישן (SQLite)
const SQLITE_DB_PATH = 'C:/path/to/your/fin3an3ce.db'; // <-- שנה לנתיב המדויק שלך!

// 3. כתובת האימייל של המשתמש באתר שאליו אתה רוצה לייבא את הנתונים
const USER_EMAIL = 'your-email@example.com'; // <-- שנה לאימייל שלך!

// ===================================================================

const accountMapper = (oldAccountName) => {
  if (!oldAccountName) return 'checking';
  const name = oldAccountName.toLowerCase();
  if (name.includes('עו"ש') || name.includes('checking')) return 'checking';
  if (name.includes('מזומן') || name.includes('cash')) return 'cash';
  return 'checking'; // ברירת מחדל
};

const runImport = async () => {
  console.log('--- מתחיל סקריפט ייבוא חד-פעמי ---');

  // התחברות ל-MongoDB
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ התחברות ל-MongoDB הצליחה.');
  } catch (error) {
    console.error('❌ שגיאה בהתחברות ל-MongoDB:', error.message);
    return;
  }

  // מציאת המשתמש ב-MongoDB
  const user = await User.findOne({ email: USER_EMAIL });
  if (!user) {
    console.error(`❌ לא נמצא משתמש עם האימייל: ${USER_EMAIL}`);
    await mongoose.disconnect();
    return;
  }
  console.log(`✅ נמצא משתמש: ${user.name} (${user._id})`);

  // קריאת הנתונים מ-SQLite
  const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) return console.error('❌ שגיאה בפתיחת קובץ SQLite:', err.message);
  });
  
  console.log('📖 קורא נתונים מקובץ SQLite...');
  db.all("SELECT date, description, amount, type, category, account FROM transactions", [], async (err, rows) => {
    if (err) {
      console.error('❌ שגיאה בקריאת טבלת העסקאות:', err.message);
      db.close();
      await mongoose.disconnect();
      return;
    }
    console.log(`📊 נמצאו ${rows.length} עסקאות בקובץ הישן.`);
    db.close();

    // עיבוד והכנת הנתונים להכנסה
    const transactionsToInsert = rows.map(row => ({
      user: user._id,
      date: new Date(row.date),
      description: row.description || 'ללא תיאור',
      amount: Math.abs(Number(row.amount)) || 0,
      type: row.type === 'expense' || row.type === 'הוצאה' ? 'הוצאה' : 'הכנסה',
      category: row.category || 'כללי',
      account: accountMapper(row.account),
    }));

    try {
      // ביצוע פעולות ב-MongoDB
      console.log('🗑️ מוחק עסקאות קיימות עבור המשתמש...');
      await Transaction.deleteMany({ user: user._id });

      console.log(`➕ מכניס ${transactionsToInsert.length} עסקאות חדשות...`);
      await Transaction.insertMany(transactionsToInsert);

      console.log('🧮 מחשב מחדש יתרות בחשבונות...');
      const aggregation = await Transaction.aggregate([
        { $match: { user: user._id } },
        { $group: {
            _id: '$account',
            total: { $sum: { $cond: [{ $eq: ['$type', 'הכנסה'] }, '$amount', { $multiply: ['$amount', -1] }] } }
        }}
      ]);
      
      const newBalances = { checking: 0, cash: 0, deposits: 0, stocks: 0 };
      aggregation.forEach(item => {
        if (newBalances.hasOwnProperty(item._id)) newBalances[item._id] = item.total;
      });

      await FinanceProfile.updateOne({ user: user._id }, { $set: newBalances }, { upsert: true });
      console.log('🔄 היתרות עודכנו בהצלחה.');

      console.log('\n🎉🎉🎉 הייבוא הושלם בהצלחה! 🎉🎉🎉');

    } catch (dbError) {
      console.error('❌ שגיאה קריטית במהלך הכתיבה ל-MongoDB:', dbError);
    } finally {
      await mongoose.disconnect();
      console.log('🔚 נותקה התקשורת עם מסד הנתונים.');
    }
  });
};

runImport();