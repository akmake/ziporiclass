import express from 'express';
import Subscription from '../models/Subscription.js';
import { getPublicKey } from '../utils/pushHandler.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// קבלת המפתח הציבורי (כדי שהקליינט יוכל להירשם)
router.get('/key', (req, res) => {
  res.json({ publicKey: getPublicKey() });
});

// שמירת מנוי חדש (Subscribe)
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const subscription = req.body;
    
    // בדיקה אם קיים כבר
    const exists = await Subscription.findOne({ endpoint: subscription.endpoint });
    if (!exists) {
      await Subscription.create({
        user: req.user._id,
        endpoint: subscription.endpoint,
        keys: subscription.keys
      });
    }
    
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error subscribing' });
  }
});

export default router;