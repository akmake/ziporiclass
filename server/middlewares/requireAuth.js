import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export default async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      return res.status(401).json({ msg: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ msg: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    // שלח בחזרה את הודעת השגיאה המדויקת מהספרייה לצורך אבחון
    return res.status(401).json({ msg: `Unauthorized: ${error.message}` });
  }
}