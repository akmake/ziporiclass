import AuditLog from '../models/AuditLog.js';

/**
 * מתעד פעולה ביומן המערכת
 * @param {Object} req - אובייקט הבקשה (כדי לשלוף משתמש ו-IP)
 * @param {String} action - סוג הפעולה (CREATE, UPDATE...)
 * @param {String} entity - על מה בוצעה הפעולה (Order, User...)
 * @param {String} entityId - המזהה של האובייקט
 * @param {String} description - תיאור מילולי
 * @param {Object} [changes] - (אופציונלי) אובייקט עם before/after
 */
export const logAction = async (req, action, entity, entityId, description, changes = null) => {
  try {
    if (!req.user) return; // לא מתעדים פעולות אנונימיות (אלא אם זה לוגין שבו מכניסים user ידנית)

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      action,
      entity,
      entityId: entityId ? entityId.toString() : null,
      description,
      changes,
      ipAddress,
      userAgent
    });
  } catch (error) {
    console.error('❌ Error saving audit log:', error);
    // אנחנו לא רוצים שכישלון בתיעוד יפיל את הבקשה כולה, לכן רק מדפיסים שגיאה
  }
};