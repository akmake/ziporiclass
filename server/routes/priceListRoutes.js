import express from 'express';
import {
  getAllPriceLists,
  createPriceList,
  updatePriceList,
  deletePriceList,
} from '../controllers/priceListController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

// מידלוור פנימי לבדיקת הרשאות ניהול מחירונים
const canManage = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.canManagePriceLists === true) {
    return next();
  }
  return res.status(403).json({ message: 'אין לך הרשאה לנהל מחירונים.' });
};

// נתיב לקבלת כל המחירונים - פתוח לכל משתמש מחובר
router.get('/', getAllPriceLists);

// נתיבים ליצירה, עדכון ומחיקה - מוגנים
router.post('/', canManage, createPriceList);
router.put('/:id', canManage, updatePriceList);
router.delete('/:id', canManage, deletePriceList);

export default router;