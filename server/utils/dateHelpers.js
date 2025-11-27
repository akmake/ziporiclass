// server/utils/dateHelpers.js

/**
 * מוסיף מספר חודשים לתאריך נתון.
 * מטפל במקרי קצה כמו הוספת חודש ל-31 בינואר.
 * @param {Date} baseDate - תאריך ההתחלה
 * @param {number} months - מספר החודשים להוספה
 * @returns {Date} - התאריך החדש
 */
export function add_months(baseDate, months) {
  const d = new Date(baseDate);
  const originalDay = d.getDate();

  // setMonth מטפל אוטומטית במעבר לשנה הבאה
  d.setMonth(d.getMonth() + months);

  // אם היום בחודש השתנה (למשל, הוספת חודש ל-31.1 הפכה ל-2.3 במקום סוף פברואר),
  // אנחנו מתקנים את זה ליום האחרון של החודש הקודם.
  if (d.getDate() !== originalDay) {
    d.setDate(0);
  }
  return d;
}