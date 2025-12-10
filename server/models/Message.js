import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // מי שלח ולמי
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // תוכן ההודעה
  text: { type: String, default: '' }, // יכול להיות ריק אם רק מצרפים הזמנה

  // === הקאץ': הקשר להזמנה (אופציונלי) ===
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

  // סטטוסים
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

// אינדקסים לשליפה מהירה
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isRead: 1 });

export default mongoose.model('Message', messageSchema);