import CommissionHistory from '../../models/CommissionHistory.js';
import { catchAsync } from '../../middlewares/errorHandler.js';

// 1. קבלת רשימת כל ההזמנות שכבר שולמו (כדי לסנן בקליינט)
export const getPaidCommissionIds = catchAsync(async (req, res) => {
  // מחזירים רק את ה-IDs כדי להיות יעילים
  const paid = await CommissionHistory.find({}, 'masterId').lean();
  const ids = paid.map(p => p.masterId);
  res.json(ids);
});

// 2. שמירת רשימת הזמנות ששולמו כעת (סיום הפקה)
export const markCommissionsAsPaid = catchAsync(async (req, res) => {
  const { items } = req.body; // מערך של הזמנות שאושרו

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'לא נבחרו שורות לשמירה.' });
  }

  // הכנה לשמירה (מונע כפילויות במקרה של שליחה כפולה בטעות)
  const operations = items.map(item => ({
    updateOne: {
      filter: { masterId: item.masterId },
      update: { $set: item },
      upsert: true 
    }
  }));

  await CommissionHistory.bulkWrite(operations);

  res.json({ message: `נשמרו ${items.length} הזמנות כ"שולמו" בהצלחה.` });
});