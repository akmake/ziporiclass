import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

export default function AutoLogout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // אם אין משתמש או לא מוגדרת שעת ניתוק - אל תעשה כלום
    if (!user || !user.forcedLogoutTime || user.role === 'admin') return;

    const checkTime = () => {
      const now = new Date();
      const [logoutHour, logoutMinute] = user.forcedLogoutTime.split(':').map(Number);
      
      // יצירת אובייקט תאריך להיום עם שעת הניתוק
      const logoutDate = new Date();
      logoutDate.setHours(logoutHour, logoutMinute, 0, 0);

      // בדיקה: האם השעה הנוכחית גדולה משעת הניתוק?
      if (now >= logoutDate) {
        // ביצוע ניתוק
        logout();
        navigate('/login'); // זורק לדף ההתחברות
        toast.error('שעות הפעילות הסתיימו. נותקת מהמערכת.');
      }
    };

    // בדיקה ראשונית מיידית
    checkTime();

    // הגדרת בדיקה חוזרת כל 30 שניות
    const intervalId = setInterval(checkTime, 300000); 

    // ניקוי הזיכרון כשהרכיב יורד
    return () => clearInterval(intervalId);
  }, [user, logout, navigate]);

  return null; // הרכיב לא מציג כלום על המסך
}