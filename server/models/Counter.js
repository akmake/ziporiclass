import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence_value: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

// פונקציית עזר לקבלת המספר הבא בסדרה
export async function getNextSequenceValue(sequenceName) {
  const sequenceDocument = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true } // new:true מחזיר את המסמך המעודכן, upsert:true יוצר אותו אם לא קיים
  );
  return sequenceDocument.sequence_value;
}