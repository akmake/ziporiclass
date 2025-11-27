// client/src/utils/phone.js

/**
 * מנקה ומפרמט מספר טלפון ישראלי לפורמט בינלאומי (ללא +)
 * @param {string} phone - מספר טלפון (למשל 050-1234567)
 * @returns {string|null} - מספר בפורמט (972501234567) או null אם לא תקין
 */
export function formatPhoneForWhatsApp(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // הסרת כל תו שאינו ספרה
  let digits = phone.replace(/\D/g, '');

  // טיפול בקידומת
  if (digits.startsWith('0')) {
    // הפיכת 050... ל- 97250...
    digits = '972' + digits.substring(1);
  } else if (digits.startsWith('972')) {
    // המספר כבר בפורמט הנכון
  } else if (digits.length === 9 && !digits.startsWith('0')) {
    // מקרה של מספר ללא 0 התחלתי (למשל 501234567)
    digits = '972' + digits;
  } else {
    // מספר לא מזוהה
    return null;
  }

  // בדיקת אורך סופי (972 + 9 ספרות = 12)
  if (digits.length === 12) {
    return digits;
  }
  
  return null;
}