import mongoose from 'mongoose';

const financeProfileSchema = new mongoose.Schema({
  // קישור ייחודי למשתמש (אחד על אחד)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // ודא שזה שם מודל המשתמש שלך
    required: true,
    unique: true, // מבטיח שלכל משתמש יהיה רק פרופיל אחד
  },
  checking: { // עו"ש
    type: Number,
    default: 0,
  },
  cash: { // מזומן
    type: Number,
    default: 0,
  },
  deposits: { // פקדונות
    type: Number,
    default: 0,
  },
  stocks: { // מניות וקרנות
    type: Number,
    default: 0,
  },
}, {
  timestamps: true, // מוסיף אוטומטית תאריך יצירה ועדכון
});

export default mongoose.model('FinanceProfile', financeProfileSchema);