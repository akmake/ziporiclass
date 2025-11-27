import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const PriceListManagerRoute = () => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // אם המשתמש הוא מנהל או שיש לו הרשאה מפורשת, אפשר לו לעבור
  if (user?.role === 'admin' || user?.canManagePriceLists) {
    return <Outlet />;
  }

  // אחרת, העבר אותו לדף הבית כי אין לו הרשאה
  return <Navigate to="/" replace />;
};

export default PriceListManagerRoute;