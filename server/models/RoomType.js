// server/models/RoomType.js
import mongoose from 'mongoose';

const roomTypeSchema = new mongoose.Schema({
  // שיוך למלון ספציפי
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  // שם החדר (למשל: "רגיל", "סוויטה", "חדר גן")
  name: {
    type: String,
    required: true,
    trim: true
  },
  // תוספת תשלום בשקלים *ללילה* (מעבר למחיר הבסיס במחירון)
  supplementPerNight: {
    type: Number,
    default: 0,
    min: 0
  },
  // האם זה סוג החדר שייבחר אוטומטית כשפותחים הזמנה?
  isDefault: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// מניעת כפילויות: לא ייתכן אותו שם חדר פעמיים באותו מלון
roomTypeSchema.index({ hotel: 1, name: 1 }, { unique: true });

export default mongoose.model('RoomType', roomTypeSchema);