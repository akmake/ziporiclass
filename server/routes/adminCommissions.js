import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getPaidCommissionIds,
  createCommissionReport,
  getAllReports,
  getMyLatestCommission // ✨ ייבוא הפונקציה החדשה
} from '../controllers/admin/commissionController.js';

const router = express.Router();

// כל הנתיבים דורשים חיבור ראשוני
router.use(requireAuth);

// ✨ נתיב פתוח למשתמש רגיל (לצפייה בנתונים של עצמו)
router.get('/my-latest', getMyLatestCommission);

// --- מכאן והלאה: רק למנהלים ---
router.use(requireAdmin);

router.get('/paid-ids', getPaidCommissionIds);
router.get('/reports', getAllReports);
router.post('/generate', createCommissionReport);

export default router;