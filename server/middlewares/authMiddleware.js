import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

/**
 * מוודא שהמשתמש מחובר (יש טוקן תקין).
 * מוסיף את אובייקט המשתמש ל-req.user.
 * ✨ כולל בדיקת שעת ניתוק אוטומטית ✨
 */
export const requireAuth = async (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) {
    return res.status(401).json({ message: 'לא מחובר' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // שליפת המשתמש מה-DB
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'משתמש לא נמצא' });
    }

    // ✨✨✨ בדיקת שעת ניתוק כפוי ✨✨✨
    if (user.forcedLogoutTime && user.role !== 'admin') { // מנהלים לא מוגבלים בדרך כלל
        const now = new Date();
        const [logoutHour, logoutMinute] = user.forcedLogoutTime.split(':').map(Number);
        
        // יצירת תאריך להיום עם שעת הניתוק
        const logoutDate = new Date();
        logoutDate.setHours(logoutHour, logoutMinute, 0, 0);

        // אם השעה עכשיו מאוחרת יותר משעת הניתוק
        if (now > logoutDate) {
            // טיפול במקרה קצה: אם השעה היא 01:00 בלילה והניתוק ב-23:00, זה נחשב שעברנו.
            // (ההנחה היא שהניתוק הוא לאותו יום קלנדרי)
            return res.status(401).json({ message: 'שעות הפעילות שלך הסתיימו להיום.' });
        }
    }
    // ✨✨✨ סוף בדיקה ✨✨✨

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'טוקן לא חוקי / פג תוקף' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'גישה נדחתה: הרשאת מנהל נדרשת' });
  }
  next();
};

export const requireSales = (req, res, next) => {
  const allowedRoles = ['admin', 'sales'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'גישה נדחתה: אזור זה מיועד לאנשי מכירות בלבד' });
  }
  next();
};

export const requireMaintenance = (req, res, next) => {
  const allowedRoles = ['admin', 'maintenance'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'גישה נדחתה: אזור זה מיועד לצוות אחזקה בלבד' });
  }
  next();
};