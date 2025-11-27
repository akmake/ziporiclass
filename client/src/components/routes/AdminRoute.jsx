import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const AdminRoute = () => {
  const { user, isAuthenticated } = useAuthStore();

  // If the user is not authenticated, redirect to the login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If the user is authenticated but is not an admin, redirect to the home page
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // If the user is an authenticated admin, show the requested page
  return <Outlet />;
};

export default AdminRoute;