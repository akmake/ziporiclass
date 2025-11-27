// server/models/Account.js
import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:    { type: String, required: true },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Account = mongoose.model('Account', accountSchema);

/* יצוא כפול — לשני העולמות */
export default Account;          // ES-Modules
export { Account };              // ייבוא שמי אם תרצה
// CommonJS fallback (אם קוד ישן דורש):
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') module.exports = Account;