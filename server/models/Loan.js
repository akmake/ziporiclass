import mongoose from 'mongoose';

const loanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'שם ההלוואה הוא שדה חובה'],
      trim: true,
    },
    principal: {
      type: Number,
      required: [true, 'סכום הקרן הוא שדה חובה'],
    },
    // שדה הריבית שונה כדי לשמור רק את המרווח מעל הפריים
    interestMargin: {
      type: Number,
      required: true,
      default: 0,
    },
    termInMonths: {
      type: Number,
      required: [true, 'תקופת ההלוואה בחודשים הוא שדה חובה'],
    },
    startDate: {
      type: Date,
      required: [true, 'תאריך תחילת ההלוואה הוא שדה חובה'],
    },
    repaymentType: {
      type: String,
      enum: ['שפיצר', 'קרן שווה'],
      required: true,
    },
    // ----- שדה זה מוסר -----
    // amortizationSchedule: [paymentSchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Loan', loanSchema);