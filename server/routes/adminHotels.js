import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { getAllHotels, createHotel, deleteHotel, updateMasterChecklist } from '../controllers/admin/hotelAdminController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAllHotels);
router.post('/', requireAdmin, createHotel);
// ✨ הנתיב החדש לעדכון הצ'ק ליסט הראשי
router.put('/:id/checklist', requireAdmin, updateMasterChecklist); 
router.delete('/:id', requireAdmin, deleteHotel);

export default router;
