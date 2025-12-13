import mongoose from 'mongoose';

const inboundEmailSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    receivedAt: { type: Date, default: Date.now, index: true },

    status: {
      type: String,
      enum: ['new', 'processed', 'closed', 'in_progress', 'not_relevant', 'converted'],
      default: 'new',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    parsedName: { type: String, trim: true },
    parsedPhone: { type: String, trim: true },
    parsedNote: { type: String, trim: true }, // המוכר רואה רק את זה
    conversationLink: { type: String, trim: true },

    // 🔥 שדה נסתר (אינדקס לביצועים מהירים)
    referrer: { type: String, trim: true, index: true, default: null },

    hotel: { type: String, trim: true, default: null },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    internalNotes: { type: String, trim: true }
  },
  { timestamps: true }
);

export default mongoose.models.InboundEmail || mongoose.model('InboundEmail', inboundEmailSchema);