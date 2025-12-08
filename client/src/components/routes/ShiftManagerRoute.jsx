import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const ShiftManagerRoute = () => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // רק מנהל או אחראי משמרת מורשים
  if (user?.role === 'admin' || user?.role === 'shift_manager') {
    return <Outlet />;
  }

  // אם זה משתמש אחר (למשל חדרנית), נזרוק אותו לדף הבית שלו
  return <Navigate to="/" replace />;
};

export default ShiftManagerRoute;