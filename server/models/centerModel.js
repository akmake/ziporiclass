import mongoose from 'mongoose';

const centerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'שם מרכז חובה'],
      unique: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    capacity: {
      type: Number,
      default: 0, // 0 = ללא הגבלה
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default mongoose.model('Center', centerSchema);