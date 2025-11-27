import mongoose from 'mongoose';

const referralAliasSchema = new mongoose.Schema({
  originalName: { type: String, required: true, unique: true, trim: true }, // השם השגוי/הישן
  targetName: { type: String, required: true, trim: true } // השם המתוקן
}, { timestamps: true });

export default mongoose.models.ReferralAlias || mongoose.model('ReferralAlias', referralAliasSchema);