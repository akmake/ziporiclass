import express from 'express';
import { getAllUsers } from '../controllers/userController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// מחייב התחברות כדי לגשת לרשימת המשתמשים
router.use(requireAuth);

router.get('/', getAllUsers);

export default router;