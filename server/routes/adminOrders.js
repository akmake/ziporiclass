import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { 
    getAllOrders, 
    updateOrder, 
    deleteOrder,
    getOrdersForCommissionMap // ✨ התווסף
} from '../controllers/admin/orderAdminController.js';

const router = express.Router();

// כל הנתיבים כאן דורשים הרשאת מנהל
router.use(requireAuth, requireAdmin);

router.get('/', getAllOrders); // מחזיר את כל ההזמנות

// ✨ נתיב חדש למפת עמלות (היברידית)
router.get('/commission-map', getOrdersForCommissionMap);

router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);

export default router;