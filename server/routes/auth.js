// server/routes/auth.js

import express from 'express';

// ✨ 1. ייבוא של פונקציות הוולידציה שיצרת
import { loginValidator, registerValidator } from '../utils/validators.js';

// ✨ 2. ייבוא כל הפונקציות הנדרשות מהקונטרולר
import {
  loginUser,
  logout,
  refresh,
  registerUser, // ✨ הוספת ייבוא פונקציית ההרשמה
} from '../controllers/authController.js';

const router = express.Router();

// --- נתיבים ציבוריים ---

// ✨ 3. הוספת מידלוור הוולידציה לנתיב ההרשמה
router.post('/register', registerValidator, registerUser);

// ✨ 4. הוספת מידלוור הוולידציה לנתיב ההתחברות
router.post('/login', loginValidator, loginUser);

router.post('/logout', logout);
router.post('/refresh', refresh);

export default router;