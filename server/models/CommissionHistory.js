import mongoose from 'mongoose';

const commissionHistorySchema = new mongoose.Schema({
  masterId: { type: String, required: true, index: true }, // מזהה ההזמנה (מתוך דוח הזמנות)
  clerkName: { type: String, required: true },
  guestName: { type: String },
  commissionAmount: { type: Number, required: true },
  paymentDate: { type: Date, default: Date.now }, // מתי הפקנו את הדוח
  invoiceNumbers: [String], // מספרי חשבוניות שקושרו (לתיעוד)
  status: { type: String, default: 'paid' }
}, { timestamps: true });

// מניעת כפילויות: לא נשלם על אותו Master ID פעמיים (אלא אם נחליט למחוק ידנית)
commissionHistorySchema.index({ masterId: 1 }, { unique: true });

export default mongoose.model('CommissionHistory', commissionHistorySchema);