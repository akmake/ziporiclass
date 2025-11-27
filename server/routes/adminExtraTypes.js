import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { getExtraTypes, createExtraType, deleteExtraType } from '../controllers/admin/extraTypeController.js';

const router = express.Router();

// כולם יכולים לקרוא (כדי להציג בטופס הזמנה)
router.get('/', requireAuth, getExtraTypes);

// רק מנהל יכול ליצור/למחוק
router.post('/', requireAuth, requireAdmin, createExtraType);
router.delete('/:id', requireAuth, requireAdmin, deleteExtraType);

export default router;