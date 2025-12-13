import express from 'express';
import InboundEmail from '../models/InboundEmail.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { sendWhatsAppMessage, getWhatsAppStatus } from '../services/whatsappService.js';

const router = express.Router();

// כמו שאר הראוטים הרגישים אצלך: מחייב התחברות
router.use(requireAuth);

router.get('/status', (req, res) => {
  res.json(getWhatsAppStatus());
});

/**
 * POST /api/whatsapp/send
 * body:
 *  - leadId (מומלץ)  -> שולח לפי lead.waChatId
 *  - text (חובה)
 *  - chatId (אופציונלי) -> אם רוצים לשלוח בלי leadId
 */
router.post('/send', async (req, res) => {
  try {
    const { leadId, text, chatId } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'text חסר/ריק' });
    }

    let targetChatId = chatId;

    if (leadId) {
      const lead = await InboundEmail.findById(leadId).lean();
      if (!lead) return res.status(404).json({ message: 'ליד לא נמצא' });

      targetChatId = lead.waChatId || lead.waSenderId || null;
    }

    if (!targetChatId) {
      return res.status(400).json({ message: 'אין יעד לשליחה (waChatId/chatId חסר)' });
    }

    await sendWhatsAppMessage({ chatId: targetChatId, text });

    res.json({ ok: true, chatId: targetChatId });
  } catch (err) {
    res.status(500).json({ message: err.message || 'שגיאה בשליחת וואטסאפ' });
  }
});

export default router;
