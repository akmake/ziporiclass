import CommissionReport from '../../models/CommissionReport.js';
import CommissionHistory from '../../models/CommissionHistory.js';
import { catchAsync } from '../../middlewares/errorHandler.js';

// 1. שליפת רשימת IDs שכבר שולמו
export const getPaidCommissionIds = catchAsync(async (req, res) => {
  const paid = await CommissionHistory.find({}, 'masterId').lean();
  const ids = paid.map(p => p.masterId);
  res.json(ids);
});

// 2. הפקת דוח חדש
export const createCommissionReport = catchAsync(async (req, res) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'לא נבחרו שורות לדוח.' });
  }

  const totalAmount = items.reduce((sum, item) => sum + (item.commissionToPay || 0), 0);

  const newReport = await CommissionReport.create({
    totalAmount,
    itemsCount: items.length,
    items: items.map(item => ({
      masterId: item.masterId,
      clerkName: item.clerk,
      guestName: item.guestName,
      arrivalDate: item.arrivalDate ? new Date(item.arrivalDate) : null,
      invoiceNumbers: item.finalInvNum ? item.finalInvNum.toString().split('|').map(s => s.trim()) : [],
      orderAmount: item.totalOrderPrice || 0,
      expectedAmount: item.expectedWithVat || 0,
      paidAmount: item.finalInvoiceAmount || 0,
      commission: item.commissionToPay || 0,
      isManualFix: item.manualFix || false,
      note: item.manualFix ? (item.finalInvNum || 'תיקון ידני') : ''
    }))
  });

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
      upsert: true
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

// 4. ✨ פונקציה חדשה: שליפת כל השמות שנמצאו בדוחות (עבור המנהל)
export const getCommissionClerkNames = catchAsync(async (req, res) => {
    // מונגו שולף את כל הערכים הייחודיים מהשדה clerkName בתוך מערך ה-items
    const names = await CommissionReport.distinct('items.clerkName');
    // מסננים ערכים ריקים וממיינים לפי א-ב
    const sortedNames = names.filter(n => n && n.trim().length > 0).sort();
    res.json(sortedNames);
});

// 5. ✨ פונקציה חדשה: שליפת סיכום אישי למשתמש (עבור דף הבית)
export const getMyReportSummary = catchAsync(async (req, res) => {
  const user = req.user;
  
  // השמות לחיפוש: השם הרשמי + השמות שהוגדרו בניהול
  const myNames = [user.name, ...(user.reportNames || [])].map(s => s.trim());

  // שליפת הדוח האחרון
  const lastReport = await CommissionReport.findOne({}).sort({ createdAt: -1 });

  if (!lastReport) {
    return res.json({ hasData: false, message: 'לא נמצאו דוחות במערכת.' });
  }

  // סינון השורות בדוח ששייכות למשתמש הזה
  const myItems = lastReport.items.filter(item => 
    item.clerkName && myNames.includes(item.clerkName.trim())
  );

  if (myItems.length === 0) {
    return res.json({ hasData: false, message: 'לא נמצאו עסקאות על שמך בדוח האחרון.' });
  }

  // חישוב סיכום
  const stats = {
    count: myItems.length,
    totalRevenue: myItems.reduce((sum, item) => sum + (item.paidAmount || 0), 0),
    totalCommission: myItems.reduce((sum, item) => sum + (item.commission || 0), 0)
  };

  res.json({
    hasData: true,
    reportDate: lastReport.createdAt,
    stats,
    items: myItems
  });
});