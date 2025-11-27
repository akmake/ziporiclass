// server/models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  // ◀️ --- שדה חדש ---
  // שומר את השם המקורי הגולמי כפי שהופיע בקובץ הייבוא
  rawDescription: {
    type: String,
    default: '',
  },
  // --- סוף ---
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['הוצאה', 'הכנסה'],
    required: true,
  },
  category: {
    type: String,
    default: 'כללי',
  },
  account: {
    type: String,
    enum: ['checking', 'cash', 'deposits', 'stocks'],
    required: true,
  }
}, {
  timestamps: true,
});

transactionSchema.index({ user: 1, date: 1, description: 1, amount: 1, type: 1 }, { unique: true });

export default mongoose.model('Transaction', transactionSchema);