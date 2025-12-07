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

      // שמירת תאריך ההגעה
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

// 3. קבלת היסטוריית דוחות
export const getAllReports = catchAsync(async (req, res) => {
  const reports = await CommissionReport.find({}).sort({ createdAt: -1 });
  res.json(reports);
});

// ✨ 4. קבלת נתוני העמלה האחרונה למשתמש המחובר (דף הבית)
export const getMyLatestCommission = catchAsync(async (req, res) => {
  const user = req.user;
  
  // בניית רשימת שמות לחיפוש: השם הרשמי + הכינויים שהוגדרו
  const searchNames = [user.name, ...(user.commissionAliases || [])];

  // שליפת הדוח האחרון ביותר
  const lastReport = await CommissionReport.findOne({}).sort({ createdAt: -1 });

  if (!lastReport) {
    return res.json({ found: false, message: 'טרם הופקו דוחות עמלה.' });
  }

  // סינון השורות בדוח ששייכות למשתמש הזה (לפי השמות)
  const myItems = lastReport.items.filter(item => 
    searchNames.some(alias => alias.trim() === item.clerkName?.trim())
  );

  if (myItems.length === 0) {
    return res.json({ found: false, message: 'לא נמצאו עמלות בדוח האחרון.' });
  }

  // חישוב סה"כ
  const totalCommission = myItems.reduce((sum, item) => sum + (item.commission || 0), 0);
  const totalSales = myItems.reduce((sum, item) => sum + (item.paidAmount || 0), 0);

  res.json({
    found: true,
    reportDate: lastReport.createdAt,
    totalCommission,
    totalSales,
    itemsCount: myItems.length,
    items: myItems // שולחים את הפירוט לקליינט
  });
});