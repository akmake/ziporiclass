import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { getReferralStats, updateReferralName } from '../controllers/admin/referralController.js';

const router = express.Router();

router.use(requireAuth, requireAdmin); // הגנה: מנהלים בלבד

router.get('/stats', getReferralStats);
router.post('/rename', updateReferralName);

export default router;