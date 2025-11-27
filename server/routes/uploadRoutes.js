// server/routes/uploadRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// הגדרת אחסון: שומרים בתיקיית uploads בשם קבוע
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    // תמיד נשמור בשם קבוע כדי שיהיה קל למצוא אותו
    cb(null, 'company-logo.png');
  },
});

const upload = multer({ storage });

// נתיב העלאה (רק למנהלים)
router.post('/logo', requireAuth, requireAdmin, upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'לא נבחר קובץ' });
  }
  res.json({ 
    message: 'הלוגו עלה בהצלחה', 
    path: `/uploads/company-logo.png?t=${Date.now()}` // הוספנו זמן כדי למנוע Cache בדפדפן
  });
});

export default router;