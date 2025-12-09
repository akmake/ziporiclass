import express from 'express';
import multer from 'multer';
import { requireAuth, requireShiftManager } from '../middlewares/authMiddleware.js';
import {
    uploadSchedule,
    getDailyDashboard,
    resolveConflict,
    assignRoomsToHousekeeper
} from '../controllers/bookingController.js';

const router = express.Router();
// שימוש בזיכרון (RAM) לעיבוד מהיר של האקסל בלי לשמור בדיסק
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

// העלאת אקסל - ניתוח ויצירת משימות
// דורש הרשאת אחראי משמרת ומעלה
router.post('/upload', requireShiftManager, upload.single('file'), uploadSchedule);

// נתיבים נוספים
router.post('/resolve', requireShiftManager, resolveConflict);
router.post('/assign', requireShiftManager, assignRoomsToHousekeeper);
router.get('/daily', getDailyDashboard);

export default router;
