import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { getPaidCommissionIds, markCommissionsAsPaid } from '../controllers/admin/commissionController.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/paid-ids', getPaidCommissionIds);
router.post('/mark-paid', markCommissionsAsPaid);

export default router;