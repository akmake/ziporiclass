import mongoose from 'mongoose';

const TzitzitOrderSchema = new mongoose.Schema(
  {
    user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    supplier:   { type: String,  required: true, trim: true },
    date:       { type: Date,    required: true },
    type:       { type: String,  enum: ['ציצית', 'טלית'], required: true },

    quantity:   { type: Number,  required: true, min: 1 },
    unitPrice:  { type: Number,  required: true, min: 0 },

    /* ‼️  השדה שהיה חסר  – כמה כבר שולם */
    paidMoney:  { type: Number,  default: 0,     min: 0 },
  },
  {
    timestamps: true,
    toJSON:  { virtuals: true },
    toObject:{ virtuals: true },
  }
);

/* virtual – totalPrice מחושב אוטומטית */
TzitzitOrderSchema.virtual('totalPrice').get(function () {
  return (this.quantity ?? 0) * (this.unitPrice ?? 0);
});

export default mongoose.model('TzitzitOrder', TzitzitOrderSchema);
