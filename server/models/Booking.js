import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  
  // מספר החדר בטקסט (לצורך חיפוש מהיר וגיבוי)
  roomNumber: { type: String, required: true },

  arrivalDate: { type: Date, required: true, index: true },
  departureDate: { type: Date, required: true, index: true },

  // פרטי האורחים (קריטי לסידור החדר)
  pax: { type: Number, default: 1 }, // סה"כ מבוגרים + ילדים
  babies: { type: Number, default: 0 }, // כמות לולים/מיטות תינוק

  // סטטוס השיבוץ
  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active'
  },

  // מאיפה הגיע הנתון?
  source: {
    type: String,
    enum: ['excel', 'manual'],
    default: 'excel'
  },

  notes: { type: String, default: '' }
}, { timestamps: true });

// אינדקסים לביצועים מהירים בשליפת טווחי תאריכים
bookingSchema.index({ room: 1, arrivalDate: 1, departureDate: 1 });

export default mongoose.model('Booking', bookingSchema);