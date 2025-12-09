import express from 'express';
import { requireAuth, requireAdmin, requireMaintenance } from '../middlewares/authMiddleware.js';
import {
  getRoomsByHotel,
  getAllRooms,
  createBulkRooms,
  updateRoomStatus,
  addTask,
  toggleTask,
  deleteRoom,
  applyDailyPlan,
  getMyTasks // ✨ וודא שזה מיובא כאן!
} from '../controllers/roomController.js';

const router = express.Router();

router.use(requireAuth);

// --- 1. נתיבים ספציפיים (חייבים להיות ראשונים כדי לא ליפול לתוך ה-ID) ---
router.get('/my-tasks', getMyTasks); // ✅ התיקון: זה חייב להיות לפני /:hotelId

router.get('/all', requireAdmin, getAllRooms);
router.post('/bulk', requireAdmin, createBulkRooms);
router.post('/daily-plan', requireAdmin, applyDailyPlan);

// --- 2. נתיבים דינמיים עם ID ---
router.patch('/:id/status', requireMaintenance, updateRoomStatus);
router.post('/:id/tasks', requireMaintenance, addTask);
router.patch('/:id/tasks/:taskId', requireMaintenance, toggleTask);
router.delete('/:id', requireAdmin, deleteRoom);

// --- 3. נתיב פרמטרי כללי (חייב להיות אחרון!) ---
// אם זה היה למעלה, הוא היה "בולע" את my-tasks וגורם לקריסה
router.get('/:hotelId', getRoomsByHotel);

export default router;