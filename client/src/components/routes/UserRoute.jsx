import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

// ✨ 1. הקומפוננטה צריכה לקבל את ה-children שלה
export default function UserRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    // הוספנו בדיקה אם החנות סיימה להיטען, למניעת קפיצות
    isLoading: state.isInitialized === false,
  }));

  // בזמן שהחנות נטענת, נחכה
  if (isLoading) {
    return <div>טוען...</div>;
  }

  // ✨ 2. הבדיקה צריכה להיות על isAuthenticated
  return isAuthenticated
    ? children // ✨ 3. אם מחובר, הצג את ה-children (את הדף עצמו)
    : <Navigate to="/login" replace />;
}