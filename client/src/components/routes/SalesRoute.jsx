import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const SalesRoute = () => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // רק מנהל או איש מכירות מורשים
  if (user?.role === 'admin' || user?.role === 'sales') {
    return <Outlet />;
  }

  // אם זה איש תחזוקה שמנסה להיכנס למכירות - נזרוק אותו לדף הבית שלו
  return <Navigate to="/maintenance" replace />;
};

export default SalesRoute;