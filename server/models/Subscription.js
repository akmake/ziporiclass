import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  // קישור למשתמש (אופציונלי, כדי לדעת מי נרשם)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // אובייקט ה-Push שהדפדפן מייצר
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Subscription', subscriptionSchema);