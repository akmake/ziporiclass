import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
    createOrder,
    getMyOrders,
    updateOrder,
    deleteOrder,
    getOrderById,
    getPublicQuoteById,
    sendOrderEmail,
    getMyOrderStats,
    searchAllOrders // ✨ התווסף
} from '../controllers/orderController.js';

// הגדרת אחסון זמני בזיכרון
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// ⬇️ --- נתיבים ציבוריים --- ⬇️
router.get('/public/:id', getPublicQuoteById);

// ⬇️ --- נתיבים מוגנים (דורשים כניסה) --- ⬇️
router.use(requireAuth);

router.route('/')
    .post(createOrder);

router.route('/my-orders')
    .get(getMyOrders);

router.get('/my-stats', getMyOrderStats);

// ✨ נתיב החיפוש החדש
router.get('/search', searchAllOrders);

router.route('/:id')
    .get(getOrderById)
    .put(updateOrder)
    .delete(deleteOrder);

router.post('/:id/email', upload.single('pdf'), sendOrderEmail); // שימוש ב-multer

export default router;