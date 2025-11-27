import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const MaintenanceRoute = () => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // רק מנהל או איש תחזוקה מורשים
  if (user?.role === 'admin' || user?.role === 'maintenance') {
    return <Outlet />;
  }

  // אם זה איש מכירות שמנסה להיכנס לתחזוקה - נזרוק אותו לדף הבית הרגיל
  return <Navigate to="/" replace />;
};

export default MaintenanceRoute;