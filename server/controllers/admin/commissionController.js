import CommissionReport from '../../models/CommissionReport.js';
import CommissionHistory from '../../models/CommissionHistory.js';
import { catchAsync } from '../../middlewares/errorHandler.js';

// 1. שליפת רשימת IDs שכבר שולמו (לצורך סינון בקליינט)
export const getPaidCommissionIds = catchAsync(async (req, res) => {
  const paid = await CommissionHistory.find({}, 'masterId').lean();
  const ids = paid.map(p => p.masterId);
  res.json(ids);
});

// 2. הפקת דוח חדש (שמירה ב-DB)
export const createCommissionReport = catchAsync(async (req, res) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'לא נבחרו שורות לדוח.' });
  }

  // חישוב סה"כ לתשלום בדוח הזה
  const totalAmount = items.reduce((sum, item) => sum + (item.commissionToPay || 0), 0);

  // יצירת אובייקט הדוח
  const newReport = await CommissionReport.create({
    totalAmount,
    itemsCount: items.length,
    items: items.map(item => ({
      masterId: item.masterId,
      clerkName: item.clerk,
      guestName: item.guestName,
      
      // ✨ שמירת תאריך ההגעה
      arrivalDate: item.arrivalDate ? new Date(item.arrivalDate) : null,

      // המרת מחרוזת החשבוניות למערך
      invoiceNumbers: item.finalInvNum ? item.finalInvNum.toString().split('|').map(s => s.trim()) : [],

      orderAmount: item.totalOrderPrice || 0,
      expectedAmount: item.expectedWithVat || 0,
      paidAmount: item.finalInvoiceAmount || 0,
      commission: item.commissionToPay || 0,

      isManualFix: item.manualFix || false,
      // אם זה תיקון ידני, ההערה היא מה שכתבת ב-finalInvNum או "תיקון ידני"
      note: item.manualFix ? (item.finalInvNum || 'תיקון ידני') : ''
    }))
  });

  // עדכון טבלת ההיסטוריה (כדי שלא יופיעו שוב)
  // משתמשים ב-bulkWrite ליעילות
  const historyOperations = items.map(item => ({
    updateOne: {
      filter: { masterId: item.masterId },
      update: {
        $set: {
            masterId: item.masterId,
            reportId: newReport._id,
            paidAt: new Date()
        }
      },
      upsert: true // יוצר חדש אם לא קיים
    }
  }));

  if (historyOperations.length > 0) {
      await CommissionHistory.bulkWrite(historyOperations);
  }

  res.status(201).json(newReport);
});

// 3. קבלת היסטוריית דוחות (עבור הטאב השני באתר)
export const getAllReports = catchAsync(async (req, res) => {
  const reports = await CommissionReport.find({}).sort({ createdAt: -1 });
  res.json(reports);
});