import mongoose from 'mongoose';

const referrerAliasSchema = new mongoose.Schema({
  // השם כפי שהלקוח כתב (למשל: "מושיקו")
  alias: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // השם הרשמי במערכת (למשל: "משה כהן")
  officialName: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('ReferrerAlias', referrerAliasSchema);