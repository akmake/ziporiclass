// server/routes/adminRoomTypes.js
import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getRoomTypesByHotel,
  createRoomType,
  updateRoomType,
  deleteRoomType
} from '../controllers/admin/roomTypeController.js';

const router = express.Router();

// 1. כל הנתיבים דורשים שהמשתמש יהיה מחובר למערכת
router.use(requireAuth);

// 2. נתיב קריאה (GET) - פתוח לכל משתמש מחובר (כדי שיוכלו ליצור הזמנות)
router.get('/by-hotel/:hotelId', getRoomTypesByHotel);

// 3. מכאן והלאה - הנתיבים דורשים הרשאת מנהל בלבד (יצירה, עריכה, מחיקה)
router.use(requireAdmin);

router.post('/', createRoomType);
router.put('/:id', updateRoomType);
router.delete('/:id', deleteRoomType);

export default router;