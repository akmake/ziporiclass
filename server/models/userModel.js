import mongoose from 'mongoose';

const MAX_FAILED = 5;
const LOCK_MS = 10 * 60 * 1000;

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'שם חובה'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'אימייל חובה'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'פורמט אימייל לא תקין'],
    },
    passwordHash: {
      type: String,
      required: [true, 'סיסמה חובה'],
    },
    role: {
      type: String,
      enum: ['admin', 'sales', 'maintenance'],
      default: 'sales',
    },
    canManagePriceLists: {
      type: Boolean,
      default: false,
    },
    canViewCommissions: {
      type: Boolean,
      default: false,
    },
    // ✨✨✨ השדה החדש: שעת ניתוק אוטומטי (למשל "23:00") ✨✨✨
    forcedLogoutTime: {
      type: String,
      default: null 
    },
    reportNames: {
      type: [String],
      default: []
    },
    cart: {
      type: [cartItemSchema],
      default: [],
    },
    twoFactorEnabled: { type: Boolean, default: false },
    totpSecret: { type: String, default: '' },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.methods.incrementLoginAttempts = function () {
  if (this.isLocked) return;
  const updates = { $inc: { failedLoginAttempts: 1 } };
  if (this.failedLoginAttempts + 1 >= MAX_FAILED) {
    updates.$set = { lockUntil: Date.now() + LOCK_MS };
  }
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function () {
  if (this.failedLoginAttempts || this.lockUntil) {
    return this.updateOne({ failedLoginAttempts: 0, lockUntil: null });
  }
};

export default mongoose.models.User || mongoose.model('User', userSchema);