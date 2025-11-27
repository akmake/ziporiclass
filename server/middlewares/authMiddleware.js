import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

/**
 * מוודא שהמשתמש מחובר (יש טוקן תקין).
 * מוסיף את אובייקט המשתמש ל-req.user.
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

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'טוקן לא חוקי / פג תוקף' });
  }
};

/**
 * הרשאת מנהל בלבד.
 */
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'גישה נדחתה: הרשאת מנהל נדרשת' });
  }
  next();
};

/**
 * ✨ חדש: הרשאת מכירות (או מנהל).
 * מאפשר גישה ל: Admin, Sales.
 * חוסם גישה ל: Maintenance.
 */
export const requireSales = (req, res, next) => {
  const allowedRoles = ['admin', 'sales'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'גישה נדחתה: אזור זה מיועד לאנשי מכירות בלבד' });
  }
  next();
};

/**
 * ✨ חדש: הרשאת אחזקה/נקיון (או מנהל).
 * מאפשר גישה ל: Admin, Maintenance.
 * חוסם גישה ל: Sales.
 */
export const requireMaintenance = (req, res, next) => {
  const allowedRoles = ['admin', 'maintenance'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'גישה נדחתה: אזור זה מיועד לצוות אחזקה בלבד' });
  }
  next();
};