import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { 
    getMyContacts, 
    getMessages, 
    sendMessage, 
    markAsRead, 
    deleteMessage 
} from '../controllers/chatController.js';

const router = express.Router();

// כל הפעולות דורשות משתמש מחובר
router.use(requireAuth);

router.get('/contacts', getMyContacts);       
router.get('/messages/:otherUserId', getMessages); 
router.post('/send', sendMessage);            

// --- נתיבים חדשים ---
router.put('/read', markAsRead); // סימון כנקרא
router.delete('/:messageId', deleteMessage); // מחיקת הודעה

export default router;