// server/models/PriceList.js
import mongoose from 'mongoose';

const priceListSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // --- שדה חדש ---
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: [true, 'חובה לשייך מחירון למלון'],
  },
  couple: {
    type: Number,
    default: 0,
    min: 0
  },
  teen: {
    type: Number,
    default: 0,
    min: 0
  },
  child: {
    type: Number,
    default: 0,
    min: 0
  },
  baby: {
    type: Number,
    default: 0,
    min: 0
  },
  single_room: {
    type: Number,
    default: 0,
    min: 0
  },
  // ✨ תוספת קיימת: הגבלת מקסימום לילות ✨
  maxNights: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // ✨✨ תוספות חדשות לשליטה בתצוגה ✨✨
  
  // האם המחירון מוצג למוכר בדף ההזמנה? (ברירת מחדל: כן)
  isVisible: {
    type: Boolean,
    default: true
  },
  
  // סדר תצוגה (נמוך = ראשון, גבוה = אחרון)
  displayOrder: {
    type: Number,
    default: 0
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const PriceList = mongoose.models.PriceList || mongoose.model('PriceList', priceListSchema);

export default PriceList;