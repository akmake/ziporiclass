import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  description: { type: String, required: true }, // "להוסיף לול", "לנקות שירותים"
  isCompleted: { type: Boolean, default: false },
  type: {
    type: String,
    enum: ['standard', 'special', 'maintenance'], // special = חוסם (מיטות/לולים)
    default: 'standard'
  },
  isBlocking: { type: Boolean, default: false } // אם true - אי אפשר לסיים חדר בלי זה
});

const roomSchema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  roomNumber: { type: String, required: true }, // מספר חדר כטקסט (למשל '101')

  // סטטוס תפעולי שרואה המנהל/חדרנית
  status: {
    type: String,
    enum: ['clean', 'dirty', 'maintenance', 'inspection'],
    default: 'clean'
  },

  // נתונים "חיים" מהאקסל היומי (לתצוגה בלבד)
  currentGuest: {
    name: String,
    pax: Number,      // סה"כ אנשים
    babies: Number,   // סה"כ תינוקות
    arrivalDate: Date,
    departureDate: Date,
    reservationStatus: { type: String, enum: ['arrival', 'departure', 'stayover', 'empty', 'back_to_back'] }
  },

  // רשימת המשימות להיום (מתאפסת כל בוקר בקליטת האקסל)
  dailyTasks: [taskSchema],

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // חדרנית
  lastUpdated: { type: Date, default: Date.now }
});

// מניעת כפילות חדרים באותו מלון
roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

export default mongoose.model('Room', roomSchema);
