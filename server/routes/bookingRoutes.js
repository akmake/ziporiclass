
import express from 'express';
import multer from 'multer';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js'; // או requireShiftManager
import { uploadDailyReport } from '../controllers/bookingController.js';

const router = express.Router();

// הגדרת Multer לשמירה בזיכרון (RAM) לעיבוד מהיר
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

// הנתיב: POST /api/bookings/upload-daily
// מקבל קובץ בשם 'file' ו-hotelId ב-body
router.post('/upload-daily', requireAdmin, upload.single('file'), uploadDailyReport);

export default router;
