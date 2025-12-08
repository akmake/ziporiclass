import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  isCompleted: { type: Boolean, default: false },
  
  // סיווג המשימה
  type: {
    type: String,
    enum: ['standard', 'daily', 'maintenance'],
    default: 'standard'
  },

  // תאריך (רלוונטי למשימות יומיות כדי לדעת מתי למחוק אותן)
  date: { type: Date, default: null },

  // מידע טכני
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },

  // שדה legacy
  isSystemTask: { type: Boolean, default: false },
});

const roomSchema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  roomNumber: { type: String, required: true, trim: true },
  roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },

  status: {
    type: String,
    enum: ['clean', 'dirty', 'maintenance'],
    default: 'dirty',
    index: true
  },

  // ✨ למי החדר מוקצה כרגע (עבור חדרנית ספציפית)
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },

  // ✨ תאריך השיבוץ (כדי לוודא שהשיבוץ הוא להיום בלבד)
  assignmentDate: {
    type: Date,
    default: null,
    index: true
  },

  tasks: [taskSchema],

  lastCleanedAt: { type: Date },
  lastCleanedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true }
}, { timestamps: true });

// מונע יצירת שני חדרים עם אותו מספר באותו מלון
roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

export default mongoose.models.Room || mongoose.model('Room', roomSchema);