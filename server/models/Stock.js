// server/models/Stock.js

import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    purchasePrice: {
      type: Number,
      required: true,
    },
    investedAmount: {
      type: Number,
      required: true,
    },
    currentPrice: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property to calculate shares on the fly
stockSchema.virtual('shares').get(function () {
  if (this.purchasePrice > 0) {
    return this.investedAmount / this.purchasePrice;
  }
  return 0;
});

// Virtual property for current value in ILS
stockSchema.virtual('currentValueILS').get(function () {
  const USD_TO_SHEKEL = 3.7; // It's better to manage this rate globally
  return this.shares * this.currentPrice * USD_TO_SHEKEL;
});

// Virtual property for profit/loss in USD
stockSchema.virtual('profitUSD').get(function () {
  return (this.currentPrice - this.purchasePrice) * this.shares;
});


export default mongoose.model('Stock', stockSchema);