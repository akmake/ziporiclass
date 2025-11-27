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
  applyDailyPlan // ✨ הפונקציה החדשה לסידור עבודה
} from '../controllers/roomController.js';

const router = express.Router();

router.use(requireAuth);

// 1. נתיבים סטטיים (חייבים להיות ראשונים!)
// -------------------------------------------
router.get('/all', requireAdmin, getAllRooms);
router.post('/bulk', requireAdmin, createBulkRooms);
router.post('/daily-plan', requireAdmin, applyDailyPlan); // ✨ הנתיב החדש

// 2. נתיבים דינמיים לפי ID של חדר
// -------------------------------------------
router.patch('/:id/status', requireMaintenance, updateRoomStatus);
router.post('/:id/tasks', requireMaintenance, addTask);
router.patch('/:id/tasks/:taskId', requireMaintenance, toggleTask);
router.delete('/:id', requireAdmin, deleteRoom);


// 3. נתיב פרמטרי כללי (חייב להיות אחרון חביב!)
// -------------------------------------------
router.get('/:hotelId', getRoomsByHotel);

export default router;
