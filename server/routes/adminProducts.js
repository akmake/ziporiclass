// server/routes/adminProducts.js

import express from 'express';
import { requireAdmin } from '../middlewares/authMiddleware.js';
import {
    getAllProducts,
    createProduct,
    updateProduct,
    deleteProduct,
} from '../controllers/admin/productAdminController.js';

const router = express.Router();

// הגנה על כל הראוטים בקובץ - דורש הרשאת מנהל
router.use(requireAdmin);

router.route('/')
    .get(getAllProducts)
    .post(createProduct);

router.route('/:id')
    .put(updateProduct)
    .delete(deleteProduct);

export default router;