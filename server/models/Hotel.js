import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema({
  text: { type: String, required: true },
  order: { type: Number, default: 0 }
}, { _id: false });

const hotelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'שם המלון הוא שדה חובה'],
    unique: true,
    trim: true,
  },

  // === שינוי: מבנה חדש ל-3 סוגי צ'ק ליסטים ===
  checklists: {
    // 1. הגעה / עזיבה (הכנת החדר לאורח הבא)
    departure: { type: [checklistItemSchema], default: [] },
    
    // 2. שהייה (ניקיון שוטף לחדר תפוס)
    stayover: { type: [checklistItemSchema], default: [] },
    
    // 3. הגעה (בדיקה לפני כניסה - אופציונלי) או שימוש כללי
    arrival: { type: [checklistItemSchema], default: [] }
  },

  // שדה legacy (נשמר לתמיכה לאחור במידת הצורך, אך המערכת תשתמש בחדשים)
  masterChecklist: [checklistItemSchema],
  defaultTasks: [String]
}, { timestamps: true });

const Hotel = mongoose.models.Hotel || mongoose.model('Hotel', hotelSchema);

export default Hotel;