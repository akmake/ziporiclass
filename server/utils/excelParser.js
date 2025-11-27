// server/utils/excelParser.js
import MerchantMap from '../models/MerchantMap.js';
import CategoryRule from '../models/CategoryRule.js';

/**
 * מפענח תאריך ממגוון פורמטים אפשריים (DD/MM/YYYY, ISO, וכו') לתאריך UTC תקני.
 * הפונקציה עמידה לקלט חלקי או לא תקין.
 * @param {Date|string|number} dateInput - הקלט שיש לפענח.
 * @returns {Date|null} אובייקט Date או null אם הפענוח נכשל.
 */
function parseDate(dateInput) {
  // אם הקלט הוא כבר אובייקט תאריך תקין, נחזיר אותו מיד.
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput;
  }
  if (!dateInput) return null;

  const dateStr = String(dateInput).trim();

  // נסיון פענוח של פורמט DD/MM/YYYY או DD-MM-YYYY
  const parts = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10);
    const year = parseInt(parts[3], 10);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      // שימוש ב-Date.UTC כדי למנוע בעיות אזור זמן.
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // נסיון פענוח כ-ISO או פורמט נתמך אחר של JavaScript.
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) return isoDate;

  return null;
}

/**
 * יוצר אובייקט עסקה גולמי משורת נתונים מהקובץ.
 * מטפל בהבדלים בין קבצי 'מקס' ו'כאל'.
 * @param {object} row - שורת נתונים מהקובץ המנוקה.
 * @param {string} userId - מזהה המשתמש.
 * @param {string} type - סוג הקובץ ('max' או 'cal').
 * @returns {object|null} אובייקט עסקה או null אם השורה לא תקינה.
 */
const createTransactionObject = (row, userId, type) => {
    const date = parseDate(row["תאריך עסקה"]);
    if (!date || !row["שם בית העסק"]) return null;

    let amount, transactionType;

    if (type === 'max') {
        // קובץ 'מקס' מכיל עמודות נפרדות לחיוב וזיכוי
        const chargeAmount = parseFloat(String(row["סכום חיוב"] || '0').replace(/,/g, ''));
        const creditAmount = parseFloat(String(row["סכום זיכוי"] || '0').replace(/,/g, ''));

        if (!isNaN(chargeAmount) && chargeAmount !== 0) {
            amount = Math.abs(chargeAmount);
            transactionType = chargeAmount > 0 ? 'הוצאה' : 'הכנסה';
        } else if (!isNaN(creditAmount) && creditAmount !== 0) {
            amount = Math.abs(creditAmount);
            transactionType = 'הכנסה';
        } else {
            return null; // שורה ללא סכום
        }
    } else { // 'cal'
        // קובץ 'כאל' משתמש בעמודה אחת עם מספר חיובי או שלילי
        const amountValue = row["סכום בש\"ח"] || row["סכום עסקה"] || row["סכום חיוב"];
        if (amountValue == null) return null;

        amount = parseFloat(String(amountValue).replace(/,/g, ''));
        if (isNaN(amount)) return null;

        transactionType = amount < 0 ? 'הכנסה' : 'הוצאה';
        amount = Math.abs(amount);
    }

    return {
        user: userId,
        date,
        description: String(row["שם בית העסק"]).trim(),
        rawDescription: String(row["שם בית העסק"]).trim(), // שמירת השם המקורי
        amount,
        type: transactionType,
        account: 'checking', // ברירת מחדל
        category: row['קטגוריה']?.trim() || 'כללי',
    };
};

/**
 * פונקציה ראשית: מנתחת נתונים מקובץ אקסל, מעשירה אותם עם חוקים ומיפויים,
 * ומחזירה רשימת עסקאות מוכנות להכנסה ורשימת סוחרים הדורשים מיפוי ידני.
 * @param {Array<object>} cleanedData - מערך אובייקטים של עסקאות לאחר ניקוי בסיסי.
 * @param {string} fileType - סוג הקובץ ('max' או 'cal').
 * @param {string} userId - מזהה המשתמש.
 * @returns {Promise<{transactions: Array<object>, unseenMerchants: Array<string>}>}
 */
export async function parseTransactions(cleanedData, fileType, userId) {
    // שלב 1: יצירת אובייקטים בסיסיים מהנתונים הגולמיים
    const mapper = (row) => createTransactionObject(row, userId, fileType);
    const initialTransactions = cleanedData.map(mapper).filter(Boolean);

    // שלב 2: טעינת כל המיפויים והחוקים מה-DB פעם אחת לטובת יעילות
    const [merchantMaps, categoryRules] = await Promise.all([
        MerchantMap.find({}).populate('category', 'name').lean(),
        CategoryRule.find({}).populate('category', 'name').lean(),
    ]);

    // יצירת מילון מהיר לגישה למיפויים
    const merchantMapCache = new Map(merchantMaps.map(m => [m.originalName, m]));

    // קבוצה שתכיל את כל שמות הסוחרים שהמערכת לא הצליחה לשייך להם קטגוריה
    const merchantsThatNeedMapping = new Set();

    // שלב 3: לולאה ראשית על כל עסקה כדי להעשיר אותה
    const transactions = initialTransactions.map(trx => {
        const originalDescription = trx.rawDescription;
        let finalDescription = trx.description;
        let finalCategoryName = 'כללי'; // ברירת מחדל
        let categoryApplied = false;

        // שלב 3.1: בדיקת מיפוי סוחרים (MerchantMap)
        // זה השלב הכי חזק. אם יש מיפוי, הוא קובע גם את השם וגם את הקטגוריה.
        const mapping = merchantMapCache.get(originalDescription);
        if (mapping) {
            finalDescription = mapping.newName;
            if (mapping.category) {
                finalCategoryName = mapping.category.name;
                categoryApplied = true;
            }
        }

        // שלב 3.2: אם לא נמצאה קטגוריה דרך מיפוי ישיר, נבדוק חוקי קטגוריות
        if (!categoryApplied) {
            for (const rule of categoryRules) {
                // החוקים רגישים לגודל אות, לכן נשווה הכל באותיות קטנות
                if (finalDescription.toLowerCase().includes(rule.keyword.toLowerCase())) {
                    if (rule.category) {
                        finalCategoryName = rule.category.name;
                        categoryApplied = true;
                        break; // מצאנו חוק מתאים, אין צורך להמשיך
                    }
                }
            }
        }

        // שלב 3.3: החלטה סופית - האם להציג למשתמש בדיאלוג?
        // אם אחרי כל הבדיקות האוטומטיות עדיין לא שויכה קטגוריה,
        // נוסיף את שם הסוחר המקורי לרשימה שתחזור למשתמש.
        // זה מכסה גם סוחרים חדשים לגמרי וגם סוחרים שמופו (השם שלהם שונה) אבל עדיין אין להם קטגוריה.
        if (!categoryApplied) {
            merchantsThatNeedMapping.add(originalDescription);
        }

        return { ...trx, description: finalDescription, category: finalCategoryName };
    });

    // שלב 4: החזרת התוצאה הסופית
    return {
        transactions,
        unseenMerchants: Array.from(merchantsThatNeedMapping)
    };
}