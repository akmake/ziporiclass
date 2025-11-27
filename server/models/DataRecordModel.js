import mongoose from "mongoose";

const dataRecordSchema = new mongoose.Schema(
  {
    // ערך מספרי 3: מזהה המשתמש ששלח את הנתונים
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User", // קישור למודל המשתמש שלך
    },
    // ערך מספרי 1: מהלקוח
    value1: {
      type: Number,
      required: true,
    },
    // ערך מספרי 2: מהלקוח
    value2: {
      type: Number,
      required: true,
    },
  },
  {
    // ערך מספרי 4: חותמת זמן אוטומטית של מונגו
    timestamps: true, // מוסיף createdAt ו-updatedAt
  }
);

export default mongoose.model("DataRecord", dataRecordSchema);