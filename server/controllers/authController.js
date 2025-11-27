import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { createAndSendTokens } from '../utils/tokenHandler.js';

export const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: 'שם, אימייל וסיסמה הם שדות חובה' });

  const exists = await User.findOne({ email });
  if (exists)
    return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים' });

  const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
  if (!strong.test(password))
    return res.status(400).json({ message: 'הסיסמה חלשה מדי. נדרשים 8 תווים, אות גדולה, קטנה, מספר ותו מיוחד.' });

  const hash = await bcrypt.hash(password, 12);

  // ✨ לוגיקה מעודכנת לבחירת תפקיד ✨
  // אם נשלח תפקיד חוקי מהקליינט - נשתמש בו. אחרת - נגדיר כ-sales.
  // הערה: במערכת אמיתית, בדרך כלל רק מנהל יכול ליצור משתמשים עם תפקידים ספציפיים,
  // אבל כאן אנחנו מאפשרים גמישות בהרשמה לצורך הפיתוח.
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

  const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
  createAndSendTokens(user, res);
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

  // כאן אנחנו מחזירים את ה-role המעודכן לקליינט
  const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
  
  createAndSendTokens(user, res);
  return res.status(200).json({ message: "התחברת בהצלחה", user: userPayload });
};

export const logout = async (req, res) => {
    res.clearCookie('jwt');
    res.clearCookie('refreshToken');
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
    if (!user || user.tokenVersion !== decoded.v) {
      return res.status(403).json({ message: 'Forbidden. Please log in again.' });
    }
    createAndSendTokens(user, res);
    
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    return res.status(200).json({ message: "Tokens refreshed successfully", user: userPayload });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired refresh token.' });
  }
};