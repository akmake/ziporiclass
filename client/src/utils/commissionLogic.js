// client/src/utils/commissionLogic.js

// --- הגדרות עמודות קשיחות (הועתק במדויק כדי לשמור על הלוגיקה) ---
// חשבוניות (442)
export const INV_COL_ID = "c_folio_number";
export const INV_COL_NAME = "guest_name";
export const INV_COL_AMOUNT = "invoice_amount";
export const INV_COL_NUM = "c_invoice_number";

// הזמנות (250) - שמות עמודות קשיחים לדיוק מירבי
export const RES_COL_CLERK = "c_taken_clerk";
export const RES_COL_MASTER = "c_master_id";
export const RES_COL_PRICE = "price_local"; // זה המחיר הקובע (נטו)
export const RES_COL_NAME = "guest_name";
export const RES_COL_STATUS = "c_reservation_status";
export const RES_COL_CODE = "c_price_code";

// עמודות תאריך אפשריות
export const ARRIVAL_KEYWORDS = ["מתאריך", "c_arrival", "arrival", "checkin", "arrival_date", "תאריך הגעה"];

// --- פונקציות עזר (הועתקו בשלמותן) ---

export function parseMoney(val) {
    if (!val) return 0;
    let cleanStr = val.toString().replace(/,/g, '').trim();
    let num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
}

export function cleanStr(val) {
    if (val === undefined || val === null) return "";
    return val.toString().trim();
}

// ✨ הפונקציה הקריטית לזיהוי תאריך - לא שונתה אות
export function findArrivalDate(row) {
    // תמיכה בטעינה מה-DB
    if (row.eventDate) return new Date(row.eventDate);

    // סריקת המפתחות באובייקט השורה
    const keys = Object.keys(row);
    for (const key of keys) {
        const lowerKey = key.toLowerCase();
        // בדיקה אם שם העמודה מכיל את אחת ממילות המפתח
        if (ARRIVAL_KEYWORDS.some(k => lowerKey.includes(k))) {
            const val = row[key];

            if (!val) continue;

            // אם זה כבר אובייקט תאריך
            if (val instanceof Date && !isNaN(val)) return val;

            // Excel Serial Date (מספרים מעל 20000)
            if (typeof val === 'number' && val > 20000) {
                return new Date(Math.round((val - 25569) * 86400 * 1000));
            }

            // מחרוזות
            if (typeof val === 'string') {
                const dateStr = val.trim().replace(/\./g, '/').replace(/-/g, '/');

                // פורמט עם לוכסנים: DD/MM/YYYY או DD/MM/YY
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        let day = parseInt(parts[0]);
                        let month = parseInt(parts[1]);
                        let year = parseInt(parts[2]);
                        // השלמת שנה (24 -> 2024)
                        if (year < 100) year += 2000;

                        const d = new Date(year, month - 1, day);
                        if (!isNaN(d.getTime())) return d;
                    }
                }

                // פורמט סטנדרטי אחר
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) return d;
            }
        }
    }
    return null;
}

export function getReportSummary(items) {
    const summary = {};
    items.forEach(item => {
        const name = item.clerkName || 'לא ידוע';
        if (!summary[name]) {
            summary[name] = { count: 0, totalRevenue: 0, totalCommission: 0 };
        }
        summary[name].count += 1;
        summary[name].totalRevenue += item.paidAmount || 0;
        summary[name].totalCommission += item.commission || 0;
    });

    return Object.entries(summary)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.totalCommission - a.totalCommission);
}