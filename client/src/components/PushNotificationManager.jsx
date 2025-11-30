import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore.js';
import api from '@/utils/api.js';

// פונקציית עזר להמרת מפתח VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // 1. האם הדפדפן תומך?
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return; 
    }

    // 2. האם המשתמש מחובר?
    if (!isAuthenticated) return;

    const registerPush = async () => {
      try {
        // רישום ה-Service Worker
        const register = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        // בדיקה האם כבר רשום
        let subscription = await register.pushManager.getSubscription();

        if (!subscription) {
            // אם לא רשום, צריך לקבל את המפתח הציבורי מהשרת
            const { data } = await api.get('/push/key');
            const publicVapidKey = data.publicKey;

            // הרשמה ל-Push Service של הדפדפן
            subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
        }

        // שליחת המינוי לשרת שלנו לשמירה
        await api.post('/push/subscribe', subscription);
        console.log('✅ Push notification registered successfully');

      } catch (error) {
        console.error('❌ Failed to register push notification:', error);
      }
    };

    // בקשת הרשאה (אם טרם ניתנה)
    if (Notification.permission === 'default') {
        // מחכה לאינטראקציה ראשונית כדי לא "להפציץ" את המשתמש מיד
        const timer = setTimeout(() => {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    registerPush();
                }
            });
        }, 3000);
        return () => clearTimeout(timer);
    } else if (Notification.permission === 'granted') {
        registerPush();
    }

  }, [isAuthenticated]);

  return null; // רכיב לוגי בלבד, ללא תצוגה
}