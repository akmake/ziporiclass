import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import {
    getAllUsers,
    updateUserPermissions,
    createUser,
    deleteUser
} from '../controllers/admin/userAdminController.js';

const router = express.Router();

// כל הפעולות כאן דורשות הרשאת מנהל
router.use(requireAuth, requireAdmin);

router.route('/')
    .get(getAllUsers)
    .post(createUser);

router.route('/:id')
    .put(updateUserPermissions)
    .delete(deleteUser);

export default router;