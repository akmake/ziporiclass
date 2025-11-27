import jwt from 'jsonwebtoken';

export default function requireAdmin(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'לא מחובר' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin')
      return res.status(403).json({ message: 'הרשאת מנהל נדרשת' });

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'טוקן לא תקף/פג' });
  }
}