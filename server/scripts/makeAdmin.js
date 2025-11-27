import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

// טען את .env מהשורש של server
dotenv.config({ path: './.env', override: true });

console.log('🔐 Connecting to:', process.env.MONGO_URI);

const promoteToAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = 'yosefdaean@gmail.com'; // ← האימייל שברצונך לקדם

  const user = await User.findOne({ email });
  if (!user) {
    console.log('❌ המשתמש לא נמצא');
    process.exit(1);
  }

  user.role = 'admin';
  await user.save();

  console.log(`✅ המשתמש ${email} קודם לתפקיד מנהל`);
  process.exit(0);
};

promoteToAdmin();