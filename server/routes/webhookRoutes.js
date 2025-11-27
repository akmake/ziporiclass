import express from 'express';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';

const router = express.Router();

// פונקציית חילוץ נקייה
async function extractReferrerName(text) {
    if (!text) return null;
    const regex = /(?:הגעתי|פניתי|באתי)\s*(?:דרך|מ|מה|בהמלצת|ע"י)\s+(.+)/i;
    const match = text.match(regex);
    
    if (match && match[1]) {
        let rawName = match[1].trim().split(/\s+/).slice(0, 2).join(' ');
        rawName = rawName.replace(/[.,;!?-]$/, '');
        
        // בדיקת נרמול מול המילון
        const alias = await ReferrerAlias.findOne({ alias: rawName });
        return alias ? alias.officialName : rawName;
    }
    return null;
}

const verifySecret = (req, res, next) => {
  const providedSecret = req.query.secret || req.headers['x-webhook-secret'];
  const expectedSecret = process.env.WEBHOOK_SECRET_KEY;
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

router.post('/email-inbound', verifySecret, async (req, res) => {
  try {
    const { from, type, body, parsedName, parsedPhone, parsedNote, conversationLink } = req.body;

    // 1. סריקה שקטה
    const textToScan = (parsedNote || '') + ' ' + (body || '');
    const detectedReferrer = await extractReferrerName(textToScan);

    // 2. שמירה (הליד נשאר נקי למוכר, המפנה נשמר בנסתר)
    const newEmail = new InboundEmail({
      from: from || 'Connectop Bot',
      type: type || 'פנייה חדשה',
      body: body || '',
      status: 'new', // משאירים כ-new כדי שהמוכר יראה
      
      parsedName: parsedName,
      parsedPhone: parsedPhone,
      parsedNote: parsedNote, // נשאר מקורי!
      conversationLink: conversationLink,
      
      referrer: detectedReferrer, // נשמר בצד לדוחות
      
      hotel: type ? type.trim() : null,
      handledBy: null
    });

    await newEmail.save();
    res.status(201).json({ message: 'Saved', referrer: detectedReferrer });

  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;