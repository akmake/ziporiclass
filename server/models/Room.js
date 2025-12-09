import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  isCompleted: { type: Boolean, default: false },
  
  // סוג המשימה:
  // standard = מהצ'ק ליסט הקבוע (ניקיון שירותים וכו')
  // special = תוספת חכמה מהאקסל (מיטה נוספת, לול)
  type: { 
    type: String, 
    enum: ['standard', 'special', 'maintenance', 'daily'], 
    default: 'standard' 
  },
  
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // מי הוסיף (אם ידני)
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date }
}, { _id: true });

const roomSchema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  roomNumber: { type: String, required: true, index: true }, // מספר חדר (טקסט)
  
  // סטטוס תפעולי (נקי/מלוכלך)
  status: {
    type: String,
    enum: ['clean', 'dirty', 'maintenance'],
    default: 'dirty',
    index: true
  },

  // מידע "חי" מהאקסל היומי (לתצוגה בדשבורד)
  currentGuest: {
    pax: { type: Number, default: 0 },      // סה"כ אנשים
    babies: { type: Number, default: 0 },   // סה"כ תינוקות
    status: { type: String, default: 'empty' }, // arrival, departure, stayover
    name: String, // שם האורח (אופציונלי לתצוגה)
    arrival: Date,
    departure: Date
  },

  // רשימת המשימות הנוכחית לחדרנית
  tasks: [taskSchema],

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastCleanedAt: { type: Date },
  lastCleanedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// מניעת כפילות חדרים באותו מלון
roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

export default mongoose.models.Room || mongoose.model('Room', roomSchema);
