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
  applyDailyPlan // <--- הפונקציה החשובה ל"הפץ"
} from '../controllers/roomController.js';

const router = express.Router();

router.use(requireAuth);

// --- ניהול מערכתי ---
router.get('/all', requireAdmin, getAllRooms);
router.post('/bulk', requireAdmin, createBulkRooms);

// --- נתיב ההפצה (מחבר בין האקסל לחדרים) ---
router.post('/daily-plan', requireAdmin, applyDailyPlan);

// --- עבודה שוטפת על חדר ---
router.patch('/:id/status', requireMaintenance, updateRoomStatus);
router.post('/:id/tasks', requireMaintenance, addTask);
router.patch('/:id/tasks/:taskId', requireMaintenance, toggleTask);
router.delete('/:id', requireAdmin, deleteRoom);

// --- שליפת חדרים למלון (בסוף) ---
router.get('/:hotelId', getRoomsByHotel);

export default router;