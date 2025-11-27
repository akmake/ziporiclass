import mongoose from 'mongoose';

const rateHistorySchema = new mongoose.Schema(
  {
    // התאריך שממנו הריבית בתוקף
    date: {
      type: Date,
      required: true,
      unique: true, // לא נאפשר שני עדכונים באותו תאריך
    },
    // שיעור הריבית באחוזים (למשל, 6.25 עבור 6.25%)
    rate: {
      type: Number,
      required: true,
    },
    indexName: { // שם המדד, למקרה שתרצה להוסיף מדדים אחרים בעתיד
      type: String,
      default: 'prime',
      required: true,
    }
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

rateHistorySchema.index({ date: -1, indexName: 1 });

export default mongoose.model('RateHistory', rateHistorySchema);