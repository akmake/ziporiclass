import mongoose from 'mongoose';

const categoryRuleSchema = new mongoose.Schema({
  // מילת המפתח לחיפוש בשם הספק, למשל "סופר", "דלק", "AMZN"
  keyword: {
    type: String,
    required: true,
    trim: true,
    unique: true, // כל מילת מפתח היא ייחודית
  },
  // הקישור לקטגוריה שאליה יש לשייך את העסקה אם נמצאה מילת המפתח
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  // ניתן להוסיף עדיפות בעתיד, כדי לטפל במקרים שמספר חוקים מתאימים
  // priority: { type: Number, default: 0 }
}, {
  timestamps: true,
});

export default mongoose.model('CategoryRule', categoryRuleSchema);