import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { getTriggers, addTrigger, deleteTrigger } from '../controllers/admin/triggerController.js';

const router = express.Router();

// הגנה: רק מנהל מחובר יכול לגשת
router.use(requireAuth, requireAdmin);

router.get('/', getTriggers);       // שליפת כל הטריגרים
router.post('/', addTrigger);       // הוספת טריגר חדש
router.delete('/:id', deleteTrigger); // מחיקת טריגר

export default router;