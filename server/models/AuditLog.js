import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: { type: String, required: true }, // שמירת השם למקרה שהמשתמש יימחק בעתיד
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT']
  },
  entity: {
    type: String,
    required: true, 
    // למשל: 'Order', 'User', 'PriceList'
  },
  entityId: { type: String }, // המזהה של האובייקט ששונה
  description: { type: String, required: true }, // תיאור קריא ("שינוי שם לקוח מ-X ל-Y")
  changes: { type: Object }, // אופציונלי: אובייקט שמראה את הערך הישן והחדש
  ipAddress: { type: String },
  userAgent: { type: String }
}, {
  timestamps: true // נותן לנו את createdAt אוטומטית
});

// אינדקסים לחיפוש מהיר
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityId: 1 });
auditLogSchema.index({ user: 1 });

export default mongoose.model('AuditLog', auditLogSchema);