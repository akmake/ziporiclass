import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { getReferrerStats, upsertAlias, scanHistory } from '../controllers/referrerController.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', getReferrerStats);
router.post('/', upsertAlias);
router.post('/scan', scanHistory); // הנתיב החדש לכפתור התיקון

export default router;