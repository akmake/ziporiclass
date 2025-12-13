// server/models/LeadTrigger.js
import mongoose from 'mongoose';

const leadTriggerSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true // נשמור באותיות קטנות להשוואה קלה
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

export default mongoose.model('LeadTrigger', leadTriggerSchema);