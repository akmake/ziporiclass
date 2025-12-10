import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // מי שלח ולמי
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // תוכן ההודעה
  text: { type: String, default: '' },

  // === הקאץ': הקשר להזמנה (אופציונלי) ===
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

  // סטטוסים
  isRead: { type: Boolean, default: false }, // וי כחול
  isDeleted: { type: Boolean, default: false }, // מחיקה
  isForwarded: { type: Boolean, default: false }, // הועבר

}, { timestamps: true });

// אינדקסים לשליפה מהירה
messageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
messageSchema.index({ recipient: 1, isRead: 1 });

export default mongoose.model('Message', messageSchema);