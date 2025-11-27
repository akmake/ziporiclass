import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/userModel.js';

// --- הגדרת נתיבים לטעינת משתני הסביבה ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// טוען את קובץ ה-.env מהתיקייה הראשית של השרת
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const migrateRoles = async () => {
  console.log('🔄 מתחיל תהליך מיגרציית תפקידים...');

  // 1. התחברות לדאטה-בייס
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('❌ משתנה סביבה MONGO_URI חסר.');
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ מחובר ל-MongoDB בהצלחה.');

  } catch (error) {
    console.error('❌ שגיאה בהתחברות:', error.message);
    process.exit(1);
  }

  try {
    // 2. בדיקת מצב קיים
    const countOldUsers = await User.countDocuments({ role: 'user' });
    console.log(`📊 נמצאו ${countOldUsers} משתמשים עם התפקיד הישן ("user").`);

    if (countOldUsers === 0) {
      console.log('✨ אין צורך בשינויים. כל המשתמשים מעודכנים.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // 3. ביצוע העדכון
    // updateMany עוקף ולידציות מסוימות, מה שטוב לנו כי "user" כבר לא קיים ב-Enum החדש
    const result = await User.updateMany(
      { role: 'user' }, 
      { $set: { role: 'sales' } }
    );

    console.log(`✅ עודכנו בהצלחה: ${result.modifiedCount} משתמשים.`);
    console.log('🎉 כעת כולם מוגדרים כ-"sales" (מלבד המנהלים).');

  } catch (error) {
    console.error('❌ שגיאה במהלך העדכון:', error);
  } finally {
    // 4. ניתוק מסודר
    await mongoose.disconnect();
    console.log('👋 החיבור נסגר.');
    process.exit(0);
  }
};

migrateRoles();