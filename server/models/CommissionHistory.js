import mongoose from 'mongoose';

const commissionHistorySchema = new mongoose.Schema({
  masterId: { type: String, required: true, unique: true, index: true }, // מפתח ייחודי
  paidAt: { type: Date, default: Date.now },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommissionReport' } // קישור לדוח
}, { timestamps: true });

export default mongoose.model('CommissionHistory', commissionHistorySchema);