// server/models/ExtraType.js
import mongoose from 'mongoose';

const extraTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // אפשר להוסיף מחיר ברירת מחדל אם תרצה בעתיד, כרגע ביקשת שהמחיר יהיה שרירותי
}, { timestamps: true });

export default mongoose.model('ExtraType', extraTypeSchema);