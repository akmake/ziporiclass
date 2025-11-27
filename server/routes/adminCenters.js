import express from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import {
  getAllCenters,
  createCenter,
  deleteCenter,
} from '../controllers/admin/centerAdminController.js';

const router = express.Router();
router.use(requireAdmin);

router.get('/',    getAllCenters);
router.post('/',   createCenter);
router.delete('/:id', deleteCenter);

export default router;