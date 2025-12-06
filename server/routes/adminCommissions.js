import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { 
    getPaidCommissionIds, 
    createCommissionReport, 
    getAllReports
} from '../controllers/admin/commissionController.js';

const router = express.Router();

// הגנה: רק מנהל מחובר יכול לגשת
router.use(requireAuth, requireAdmin);

router.get('/paid-ids', getPaidCommissionIds);
router.get('/reports', getAllReports);
router.post('/generate', createCommissionReport);

export default router;