import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from './models/userModel.js';

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ מחובר ל־MongoDB');

    const email = 'yosefdaean@gmail.com';
    const password = '0546205955'; // שנה לסיסמה חזקה
    const name = 'Yosef Admin';   // ✨ הוספנו את שם המנהל

    const existing = await User.findOne({ email });

    if (existing) {
      console.log('⚠️ משתמש מנהל כבר קיים');
      return process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name, // ✨ השדה החדש והנדרש
      email,
      passwordHash: hashedPassword, // ✨ תיקנו את שם השדה ל-passwordHash
      role: 'admin',
    });

    console.log(`🎉 נוצר משתמש מנהל: ${email}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ שגיאה ביצירת מנהל:', err);
    process.exit(1);
  }
};

createAdmin();