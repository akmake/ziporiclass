import InboundEmail from '../../models/InboundEmail.js';
import ReferralAlias from '../../models/ReferralAlias.js';
import { catchAsync } from '../../middlewares/errorHandler.js';

// דוח סטטיסטיקה לאושיות
export const getReferralStats = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    // טווח תאריכים (ברירת מחדל: כל הזמן, או מה שנבחר)
    const matchStage = { referrer: { $ne: null } };
    if (startDate && endDate) {
        matchStage.receivedAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    const stats = await InboundEmail.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: "$referrer",
                totalLeads: { $sum: 1 },
                convertedLeads: { 
                    $sum: { $cond: [{ $in: ["$status", ["converted", "placed", "בוצע"]] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                referrerName: "$_id",
                totalLeads: 1,
                convertedLeads: 1,
                conversionRate: {
                    $multiply: [{ $divide: ["$convertedLeads", "$totalLeads"] }, 100]
                }
            }
        },
        { $sort: { totalLeads: -1 } }
    ]);

    res.json(stats);
});

// עדכון שם מפנה (Smart Rename)
export const updateReferralName = catchAsync(async (req, res) => {
    const { oldName, newName } = req.body;

    if (!oldName || !newName) {
        return res.status(400).json({ message: 'חובה לספק שם ישן ושם חדש' });
    }

    // 1. עדכון רטרואקטיבי של כל הלידים הקיימים
    await InboundEmail.updateMany(
        { referrer: oldName },
        { referrer: newName }
    );

    // 2. שמירת הכלל לעתיד (Alias)
    // בודקים אם כבר קיים חוק לשם הזה, אם כן מעדכנים, אם לא יוצרים חדש
    await ReferralAlias.findOneAndUpdate(
        { originalName: oldName },
        { targetName: newName },
        { upsert: true, new: true }
    );

    res.json({ message: `השם עודכן בהצלחה מ-${oldName} ל-${newName} בכל ההיסטוריה ולעתיד.` });
});