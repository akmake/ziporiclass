import ReferrerAlias from '../models/ReferrerAlias.js';
import InboundEmail from '../models/InboundEmail.js';
import { catchAsync } from '../middlewares/errorHandler.js';

// === 1. דוח ביצועים מהיר (ללא סריקת טקסט) ===
export const getReferrerStats = catchAsync(async (req, res) => {
  // אגרגציה ישירה מהדאטהבייס - הכי מהיר שיש
  const stats = await InboundEmail.aggregate([
    { $match: { referrer: { $ne: null } } }, // רק לידים עם מפנה
    { 
      $group: { 
        _id: "$referrer", 
        count: { $sum: 1 },
        sales: { 
            $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } 
        }
      } 
    },
    { $sort: { count: -1 } }
  ]);

  // מיפוי לפורמט שהקליינט צריך
  const formattedStats = stats.map(s => ({
      name: s._id,
      count: s.count,
      sales: s.sales,
      isOfficial: true // הנחה: מה שנשמר ב-referrer כבר עבר נרמול
  }));

  res.json(formattedStats);
});

// === 2. כפתור הקסם: סריקת היסטוריה ותיקון רטרואקטיבי ===
export const scanHistory = catchAsync(async (req, res) => {
    const leads = await InboundEmail.find({});
    const aliases = await ReferrerAlias.find({});
    const aliasMap = aliases.reduce((acc, curr) => ({ ...acc, [curr.alias]: curr.officialName }), {});

    let updatedCount = 0;

    for (const lead of leads) {
        // לוגיקת החילוץ (אותה לוגיקה כמו ב-Webhook)
        const text = (lead.parsedNote || '') + ' ' + (lead.body || '');
        const match = text.match(/(?:הגעתי|פניתי|באתי)\s*(?:דרך|מ|מה|בהמלצת|ע"י)\s+(.+)/i);
        
        if (match && match[1]) {
            let rawName = match[1].trim().split(/\s+/).slice(0, 2).join(' ');
            rawName = rawName.replace(/[.,;!?-]$/, '');
            
            // נרמול
            const finalName = aliasMap[rawName] || rawName;

            // עדכון השדה הנסתר בלבד
            if (lead.referrer !== finalName) {
                lead.referrer = finalName;
                await lead.save();
                updatedCount++;
            }
        }
    }

    res.json({ message: `סריקה הסתיימה. ${updatedCount} לידים היסטוריים תויגו מחדש.` });
});

// === 3. יצירת חוק ===
export const upsertAlias = catchAsync(async (req, res) => {
  const { alias, officialName } = req.body;
  if (!alias || !officialName) return res.status(400).json({ message: 'חסר מידע' });

  await ReferrerAlias.findOneAndUpdate(
    { alias: alias.trim() },
    { officialName: officialName.trim() },
    { new: true, upsert: true }
  );

  // עדכון מיידי של כל הלידים הקיימים עם השם הישן
  await InboundEmail.updateMany(
      { referrer: alias.trim() },
      { $set: { referrer: officialName.trim() } }
  );

  res.json({ message: 'החוק נשמר והלידים עודכנו.' });
});