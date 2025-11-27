// server/routes/adminDashboard.js
import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { getDashboardStats } from '../controllers/admin/dashboardController.js';

const router = express.Router();

// הגן על כל הנתיבים כאן
router.use(requireAuth, requireAdmin);

router.get('/stats', getDashboardStats);

export default router;