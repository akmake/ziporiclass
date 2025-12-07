import mongoose from 'mongoose';

const commissionReportSchema = new mongoose.Schema({
  reportDate: { type: Date, default: Date.now },
  totalAmount: { type: Number, required: true }, // סה"כ עמלה בדוח
  itemsCount: { type: Number, required: true },  // כמה עסקאות נכללו

  // מערך הפירוט - שומר בדיוק את מה שהיה בטבלה ברגע ההפקה
  items: [{
    masterId: String,       // מספר הזמנה
    clerkName: String,      // נציג
    guestName: String,      // שם האורח
    
    // ✨✨✨ השדה החדש: תאריך הגעה (מהאקסל) ✨✨✨
    arrivalDate: { type: Date },

    invoiceNumbers: [String], // מספרי חשבוניות

    orderAmount: Number,    // סכום הזמנה (ללא מע"מ)
    expectedAmount: Number, // סכום צפוי (כולל מע"מ)
    paidAmount: Number,     // שולם בפועל בחשבונית
    commission: Number,     // העמלה ששולמה

    isManualFix: Boolean,   // האם זה תוקן ידנית?
    note: String            // הערה / אסמכתא לתיקון
  }]
}, { timestamps: true });

export default mongoose.models.CommissionReport || mongoose.model('CommissionReport', commissionReportSchema);