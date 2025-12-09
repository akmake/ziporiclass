import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema({
  text: { type: String, required: true }, // תיאור המשימה
  order: { type: Number, default: 0 }     // סדר תצוגה
}, { _id: false });

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  
  // שלושת סוגי הנהלים
  checklists: {
    departure: [checklistItemSchema], // נוהל עזיבה (יסודי)
    stayover: [checklistItemSchema],  // נוהל שוהים (רענון)
    arrival: [checklistItemSchema]    // נוהל כניסה (בדיקה) - אופציונלי
  }
}, { timestamps: true });

export default mongoose.models.Hotel || mongoose.model('Hotel', hotelSchema);
