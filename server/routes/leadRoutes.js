import express from 'express';
import { 
    getAllLeads, 
    processLead, 
    updateLeadStatus, 
    deleteLead // ✨ ייבוא הפונקציה החדשה
} from '../controllers/leadController.js'; 
import { 
    requireAuth, 
    requireAdmin // ✨ ייבוא Middleware לבדיקת מנהל
} from '../middlewares/authMiddleware.js'; 

const router = express.Router();

// מאבטחים את כל הנתיבים בקובץ זה
router.use(requireAuth);

router.get('/', getAllLeads); 
router.post('/:id/process', processLead); 
router.patch('/:id/status', updateLeadStatus); 

// ✨ נתיב חדש למחיקה - מוגן בהרשאת מנהל בלבד
router.delete('/:id', requireAdmin, deleteLead);

export default router;