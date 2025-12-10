import webpush from 'web-push';
import Subscription from '../models/Subscription.js';

// =================================================================
// 🔑 הגדרות VAPID Keys
// =================================================================
const publicVapidKey = 'BK2xkowsIPCT8VCKEuioVCHmXa3kS10k3yoWh-uCoxKMwGyW4jRh5HdYjkg0RiS4ZOjylCIMSMSgvm23Cai7pFA';
const privateVapidKey = 'PkRNszG1kHw2RvhvuZwDd6YcZVrceyJgc_a18bk43Z0';
const adminEmail = 'mailto:admin@zipori.com';

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

export const getPublicKey = () => publicVapidKey;

/**
 * שולח התראה למשתמש ספציפי (עבור צ'אט)
 */
export const sendPushToUser = async (userId, payload) => {
    try {
        // מחפש את כל המכשירים הרשומים של המשתמש הזה
        const subscriptions = await Subscription.find({ user: userId });

        if (subscriptions.length === 0) return;

        const notificationPayload = JSON.stringify({
            title: payload.title || 'הודעה חדשה',
            body: payload.body || 'קיבלת הודעה חדשה',
            url: payload.url || '/chat',
            icon: '/favicon.svg'
        });

        const promises = subscriptions.map(sub => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: { auth: sub.keys.auth, p256dh: sub.keys.p256dh }
            };

            return webpush.sendNotification(pushConfig, notificationPayload)
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        Subscription.findByIdAndDelete(sub._id);
                    }
                });
        });

        await Promise.all(promises);
    } catch (error) {
        console.error('Error sending user push:', error);
    }
};

/**
 * שולח הודעת Push לכל המנויים (עבור לידים/הודעות מערכת)
 */
export const sendPushToAll = async (payload) => {
  const subscriptions = await Subscription.find({});
  if (subscriptions.length === 0) return;

  const notificationPayload = JSON.stringify({
    title: payload.title || 'הודעה חדשה',
    body: payload.body || 'יש לך עדכון במערכת',
    url: payload.url || '/',
    icon: '/favicon.svg'
  });

  const promises = subscriptions.map(sub => {
    const pushConfig = {
      endpoint: sub.endpoint,
      keys: { auth: sub.keys.auth, p256dh: sub.keys.p256dh }
    };

    return webpush.sendNotification(pushConfig, notificationPayload)
      .catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          return Subscription.findByIdAndDelete(sub._id);
        }
      });
  });

  await Promise.all(promises);
};