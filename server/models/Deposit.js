// server/models/Deposit.js
import mongoose from 'mongoose';

const depositSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  principal: { type: Number, required: true, min: 0 },
  annualInterestRate: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['active', 'broken', 'matured'],
    default: 'active' 
  },
  sourceAccount: { type: String, trim: true },
  // --- הוספה ---
  exitPoints: {
    type: [Date], // הגדרה כשדה מסוג מערך של תאריכים
    default: []   // ערך ברירת מחדל הוא מערך ריק
  }
  // --- סוף הוספה ---
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

depositSchema.virtual('futureValue').get(function() {
  const years = (this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return this.principal * (1 + (this.annualInterestRate / 100) * years);
});

export default mongoose.model('Deposit', depositSchema);