import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const MaintenanceRoute = () => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ✨ התיקון: הוספנו את housekeeper לתנאי
  if (user?.role === 'admin' || user?.role === 'maintenance' || user?.role === 'housekeeper') {
    return <Outlet />;
  }

  // אם זה משתמש אחר, נזרוק אותו לדף הבית
  return <Navigate to="/" replace />;
};

export default MaintenanceRoute;