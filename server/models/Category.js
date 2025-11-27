import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  // הסרנו את שדה המשתמש
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true, // שם הקטגוריה חייב להיות ייחודי בכל המערכת
  },
  type: {
    type: String,
    enum: ['הוצאה', 'הכנסה', 'כללי'],
    default: 'הוצאה',
  },
}, {
  timestamps: true,
});

export default mongoose.model('Category', categorySchema);