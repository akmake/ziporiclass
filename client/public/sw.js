// client/public/sw.js

self.addEventListener('push', function(event) {
  // קבלת הנתונים מהשרת
  const data = event.data ? JSON.parse(event.data.text()) : {};
  
  const options = {
    body: data.body || 'יש לך הודעה חדשה במערכת',
    icon: data.icon || '/favicon.svg',
    badge: '/favicon.svg', // אייקון קטן בשורת ההתראות (אנדרואיד)
    data: {
        url: data.url || '/' // ה-URL שנפתח בלחיצה
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'התראה חדשה', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // לחיצה על ההתראה פותחת את האתר
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // אם יש טאב פתוח, תעבור אליו
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // אם אין טאב, פתח חדש עם הכתובת שהגיעה מהשרת
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});