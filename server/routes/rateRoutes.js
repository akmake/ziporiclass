// server/routes/rateRoutes.js

import express from 'express';
import { updatePrimeRate } from '../controllers/rateController.js';

// --- התיקון כאן: מייבאים גם את requireAuth ---
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// --- והתיקון כאן: מוסיפים את requireAuth לפני requireAdmin ---
router.post('/prime', requireAuth, requireAdmin, updatePrimeRate);

export default router;