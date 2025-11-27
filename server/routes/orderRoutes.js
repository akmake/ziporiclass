// server/routes/orderRoutes.js

import express from 'express';
import multer from 'multer'; // ודא שהתקנת: npm install multer
import {
    createOrder,
    getMyOrders,
    getAllOrders,
    getOrderById,
    updateOrder,
    deleteOrder,
    getPublicQuoteById,
    sendOrderEmail // ✨ הפונקציה החדשה
} from '../controllers/orderController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

// הגדרת אחסון זמני בזיכרון
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// ⬇️ --- נתיבים ציבוריים --- ⬇️
router.get('/public/:id', getPublicQuoteById);

// ⬇️ --- נתיבים מוגנים --- ⬇️
router.use(requireAuth);

router.route('/')
    .post(createOrder);

router.route('/my-orders')
    .get(getMyOrders);

router.get('/all', getAllOrders);

// ✨ נתיב שליחת מייל (חשוב שיהיה לפני הנתיב עם :id הכללי)
router.post('/:id/email', upload.single('pdf'), sendOrderEmail);

router.route('/:id')
    .get(getOrderById)
    .put(updateOrder)
    .delete(deleteOrder);

export default router;