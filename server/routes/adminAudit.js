import express from 'express';
import AuditLog from '../models/AuditLog.js';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, entity, user } = req.query;
    
    const query = {};
    if (entity && entity !== 'all') query.entity = entity;
    if (user) query.userName = { $regex: user, $options: 'i' }; // חיפוש לפי שם

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AuditLog.countDocuments(query);

    res.json({
      logs,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Error fetching logs' });
  }
});

export default router;