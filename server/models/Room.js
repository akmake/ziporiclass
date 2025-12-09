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

  // תאריך (רלוונטי למשימות יומיות)
  date: { type: Date, default: null },

  // מידע טכני
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // מי ביצע בפועל
  completedAt: { type: Date }, // מתי בוצע
  createdAt: { type: Date, default: Date.now },

  isSystemTask: { type: Boolean, default: false },
});

// סכמה להיסטוריה (ארכיון)
const historySchema = new mongoose.Schema({
  cycleDate: { type: Date, default: Date.now }, // מתי נסגר הסבב הזה
  cleanedBy: { type: String }, // שם המנקה
  tasksSnapshot: [taskSchema]  // העתק של המשימות שבוצעו
}, { _id: false });

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

  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },

  assignmentDate: {
    type: Date,
    default: null,
    index: true
  },

  // המשימות הפעילות כרגע
  tasks: [taskSchema],

  // === חדש: היסטוריית ביצועים ===
  history: [historySchema],

  lastCleanedAt: { type: Date },
  lastCleanedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true }
}, { timestamps: true });

roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

export default mongoose.models.Room || mongoose.model('Room', roomSchema);