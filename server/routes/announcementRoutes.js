// server/routes/announcementRoutes.js
import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getAllAnnouncements,
  getPublicAnnouncements,
  createAnnouncement,
  updateAnnouncement, // ✨ ייבוא הפונקציה החדשה
  deleteAnnouncement
} from '../controllers/announcementController.js';

const router = express.Router();

// נתיב פתוח לכל משתמש מחובר (לקריאת הודעות)
router.get('/', requireAuth, getPublicAnnouncements);

// --- אזור מוגן למנהלים בלבד ---
router.use(requireAuth, requireAdmin);

router.get('/all', getAllAnnouncements); // כל ההיסטוריה
router.post('/', createAnnouncement);    // יצירה
router.put('/:id', updateAnnouncement);  // ✨ עריכה
router.delete('/:id', deleteAnnouncement); // מחיקה

export default router;