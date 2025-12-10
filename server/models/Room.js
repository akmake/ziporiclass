import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  isCompleted: { type: Boolean, default: false },
  
  // זה השדה הקריטי להפרדה:
  // standard = צ'ק ליסט קבוע (שכבה 1)
  // daily = מיטות/עריסות/הערות מיוחדות להיום (שכבה 2)
  // maintenance = תקלות (שכבה 3)
  type: {
    type: String,
    enum: ['standard', 'daily', 'maintenance'],
    default: 'standard'
  },
  
  date: { type: Date, default: null }, // רלוונטי ל-daily
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date },
  isSystemTask: { type: Boolean, default: false },
  isHighlight: { type: Boolean, default: false } 
});

const historySchema = new mongoose.Schema({
  cycleDate: { type: Date, default: Date.now },
  cleanedBy: { type: String },
  tasksSnapshot: [taskSchema]
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

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignmentDate: { type: Date, default: null, index: true },
  
  tasks: [taskSchema],
  history: [historySchema],
  
  lastCleanedAt: { type: Date },
  lastCleanedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true }
}, { timestamps: true });

roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

export default mongoose.models.Room || mongoose.model('Room', roomSchema);