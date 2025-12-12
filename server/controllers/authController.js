import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
// import { createAndSendTokens } from '../utils/tokenHandler.js'; // ביטלנו את זה כדי לשלוט בקוקיז מכאן
import { logAction } from '../utils/auditLogger.js';

// --- פונקציות עזר ליצירת טוקנים (פנימי בתוך הקונטרולר לביטחון) ---

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '90d'
  });
};

const signRefreshToken = (id, tokenVersion) => {
  return jwt.sign({ id, v: tokenVersion }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d'
  });
};

// הפונקציה שקובעת את הקוקיז עם ההגדרות הנכונות ל-Render
const setAuthCookies = (res, user) => {
  const token = signToken(user._id);
  const refreshToken = signRefreshToken(user._id, user.tokenVersion);

  // הגדרות קריטיות ל-Render ולכרום
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction || true, // חובה ב-Render
    sameSite: isProduction ? 'none' : 'lax', // חובה לתקשורת בין דומיינים שונים
    path: '/'
  };

  // קוקי של ה-Access Token
  res.cookie('jwt', token, {
    ...cookieOptions,
    expires: new Date(Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRES_IN) || 90) * 24 * 60 * 60 * 1000)
  });

  // קוקי של ה-Refresh Token
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 ימים
  });

  return { token, refreshToken };
};

// --- הסוף של פונקציות העזר ---

export const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: 'שם, אימייל וסיסמה הם שדות חובה' });

  const exists = await User.findOne({ email });
  if (exists)
    return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים' });

  // בדיקת חוזק סיסמה
  const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
  if (!strong.test(password))
    return res.status(400).json({ message: 'הסיסמה חלשה מדי. נדרשים 8 תווים, אות גדולה, קטנה, מספר ותו מיוחד.' });

  const hash = await bcrypt.hash(password, 12);

  let finalRole = 'sales';
  const validRoles = ['admin', 'sales', 'maintenance'];

  if (role && validRoles.includes(role)) {
    finalRole = role;
  }

  const user = await User.create({
    name,
    email,
    passwordHash: hash,
    role: finalRole
  });

  // ✨ שליחת ההרשאות החדשות לקליינט
  const userPayload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      canManagePriceLists: user.canManagePriceLists,
      canViewCommissions: user.canViewCommissions
  };

  // שימוש בפונקציה הפנימית שלנו שמגדירה את הקוקיז נכון
  setAuthCookies(res, user);
  
  // ✨ תיעוד הרשמה
  req.user = user;
  await logAction(req, 'CREATE', 'User', user._id, `משתמש חדש נרשם: ${user.name}`);

  return res.status(201).json({ message: "ההרשמה הושלמה בהצלחה", user: userPayload });
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'חסר אימייל או סיסמה' });

  const user = await User.findOne({ email });
  if (!user)
    return res.status(401).json({ message: 'משתמש לא קיים' });

  if (user.isLocked)
    return res.status(423).json({ message: 'החשבון נעול זמנית' });

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    await user.incrementLoginAttempts();
    return res.status(401).json({ message: 'סיסמה שגויה' });
  }

  await user.resetLoginAttempts();

  const userPayload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      canManagePriceLists: user.canManagePriceLists,
      canViewCommissions: user.canViewCommissions
  };

  // הגדרת הקוקיז
  setAuthCookies(res, user);

  // ✨ תיעוד התחברות
  req.user = user; 
  await logAction(req, 'LOGIN', 'System', null, 'התחברות למערכת');

  return res.status(200).json({ message: "התחברת בהצלחה", user: userPayload });
};

export const logout = async (req, res) => {
    if (req.user) {
        await logAction(req, 'LOGOUT', 'System', null, 'יציאה מהמערכת');
    }

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
    };

    res.clearCookie('jwt', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    return res.sendStatus(204);
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    // בדיקת גרסת טוקן (חשוב לאבטחה - ניתוק מכל המכשירים)
    if (!user || user.tokenVersion !== decoded.v) {
      return res.status(403).json({ message: 'Forbidden. Please log in again.' });
    }
    
    // חידוש הקוקיז
    setAuthCookies(res, user);

    const userPayload = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        canManagePriceLists: user.canManagePriceLists,
        canViewCommissions: user.canViewCommissions
    };
    return res.status(200).json({ message: "Tokens refreshed successfully", user: userPayload });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired refresh token.' });
  }
};