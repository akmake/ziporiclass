import webpush from 'web-push';
import Subscription from '../models/Subscription.js';

// =================================================================
// 🔑 הגדרות VAPID Keys - המפתחות שלך
// =================================================================
const publicVapidKey = 'BK2xkowsIPCT8VCKEuioVCHmXa3kS10k3yoWh-uCoxKMwGyW4jRh5HdYjkg0RiS4ZOjylCIMSMSgvm23Cai7pFA';
const privateVapidKey = 'PkRNszG1kHw2RvhvuZwDd6YcZVrceyJgc_a18bk43Z0';
const adminEmail = 'mailto:admin@zipori.com'; // כתובת המייל שלך למקרה של בעיות בשליחה

// הגדרת הספרייה עם המפתחות
try {
    webpush.setVapidDetails(
        adminEmail,
        publicVapidKey,
        privateVapidKey
    );
    console.log('✅ VAPID Keys configured successfully.');
} catch (error) {
    console.warn("❌ Warning: VAPID keys configuration failed:", error.message);
}

// ייצוא המפתח הציבורי כדי שהצד-לקוח יוכל להירשם אליו
export const getPublicKey = () => publicVapidKey;

/**
 * שולח הודעת Push לכל המנויים הרשומים במערכת
 * @param {Object} payload - { title, body, url, icon }
 */
export const sendPushToAll = async (payload) => {
  // שליפת כל המנויים מהדאטה-בייס
  const subscriptions = await Subscription.find({});
  
  if (subscriptions.length === 0) return;

  const notificationPayload = JSON.stringify({
    title: payload.title || 'הודעה חדשה',
    body: payload.body || 'יש לך עדכון במערכת',
    url: payload.url || '/',
    icon: '/favicon.svg'
  });

  console.log(`📤 Sending push notification to ${subscriptions.length} subscribers...`);

  const promises = subscriptions.map(sub => {
    const pushConfig = {
      endpoint: sub.endpoint,
      keys: {
        auth: sub.keys.auth,
        p256dh: sub.keys.p256dh
      }
    };

    return webpush.sendNotification(pushConfig, notificationPayload)
      .catch(err => {
        // קוד 410 או 404 אומר שהמנוי כבר לא קיים (המשתמש הסיר הרשאה)
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`🗑️ Subscription expired, deleting: ${sub._id}`);
          return Subscription.findByIdAndDelete(sub._id);
        }
        console.error('❌ Error sending push:', err.statusCode);
      });
  });

  await Promise.all(promises);
};