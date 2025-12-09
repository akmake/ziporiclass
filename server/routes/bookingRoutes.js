import express from 'express';
import multer from 'multer';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { uploadSchedule } from '../controllers/bookingController.js';

const router = express.Router();

// שימוש בזיכרון לעיבוד מהיר (Buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.use(requireAuth);

// נתיב העלאה: שמרתי על השם המקורי '/upload'
router.post('/upload', requireAdmin, upload.single('file'), uploadSchedule);

export default router;