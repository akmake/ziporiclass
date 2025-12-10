import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { getMyContacts, getMessages, sendMessage } from '../controllers/chatController.js';

const router = express.Router();

// כל הפעולות דורשות משתמש מחובר
router.use(requireAuth);

router.get('/contacts', getMyContacts);       // קבלת רשימת משתמשים לשיחה
router.get('/messages/:otherUserId', getMessages); // קבלת היסטוריית שיחה
router.post('/send', sendMessage);            // שליחת הודעה

export default router;