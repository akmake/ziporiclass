// server/models/Product.js

import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'שם מוצר הוא שדה חובה'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'מחיר הוא שדה חובה'],
      min: 0,
    },
    category: {
      type: String,
      enum: ['main_course', 'side_dish', 'salad', 'dessert', 'drink'],
      required: [true, 'קטגוריה היא שדה חובה'],
    },
    kashrut: {
      type: String,
      enum: ['parve', 'dairy', 'meat'],
      default: 'parve',
    },
    unit: {
      type: String,
      default: 'יחידה',
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true, // משמש למחיקה "רכה"
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// מונע שגיאות קומפילציה מחדש בסביבת פיתוח
export default mongoose.models.Product || mongoose.model('Product', productSchema);