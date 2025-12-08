import express from 'express';
import multer from 'multer';
import { requireAuth, requireShiftManager } from '../middlewares/authMiddleware.js'; // ✨ ייבוא Middleware חדש
import { 
    uploadSchedule, 
    getDailyDashboard, 
    resolveConflict,
    assignRoomsToHousekeeper
} from '../controllers/bookingController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

// העלאת קובץ ופתרון התנגשויות - מוגבל לאחראי משמרת ומעלה
router.post('/upload', requireShiftManager, upload.single('file'), uploadSchedule);
router.post('/resolve', requireShiftManager, resolveConflict);

// הקצאת חדרים - מוגבל לאחראי משמרת ומעלה
router.post('/assign', requireShiftManager, assignRoomsToHousekeeper);

// דשבורד יומי - פתוח לכולם (התוכן מותאם בקליינט/קונטרולר לפי הצורך)
router.get('/daily', getDailyDashboard);

export default router;