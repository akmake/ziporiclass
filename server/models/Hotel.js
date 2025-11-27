import mongoose from 'mongoose';

const hotelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'שם המלון הוא שדה חובה'],
    unique: true,
    trim: true,
  },
  
  // ✨ שכבה א': התבנית הראשית (הגדרות המנהל)
  masterChecklist: [{
    text: { type: String, required: true }, // תוכן המשימה (למשל: "החלפת מצעים")
    order: { type: Number, default: 0 }     // סדר תצוגה
  }],

  // שדה legacy (נשמר לתמיכה לאחור במידת הצורך)
  defaultTasks: [String] 
}, { timestamps: true });

const Hotel = mongoose.models.Hotel || mongoose.model('Hotel', hotelSchema);

export default Hotel;
