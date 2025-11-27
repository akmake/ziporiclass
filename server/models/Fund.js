import mongoose from 'mongoose';

const fundSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fund_number: {
      type: String,
      required: true,
      trim: true,
    },
    purchase_price: {
      type: Number,
      required: true,
    },
    invested_amount: {
      type: Number,
      required: true,
    },
    current_price: {
      type: Number,
      default: 0,
    },
    last_updated: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual properties לחישובים דינמיים, בדומה לקוד הפייתון
fundSchema.virtual('units').get(function () {
  if (this.purchase_price > 0) {
    return this.invested_amount / this.purchase_price;
  }
  return 0;
});

fundSchema.virtual('current_value').get(function () {
  return this.units * this.current_price;
});

fundSchema.virtual('profit').get(function () {
  return (this.current_price - this.purchase_price) * this.units;
});

export default mongoose.model('Fund', fundSchema);