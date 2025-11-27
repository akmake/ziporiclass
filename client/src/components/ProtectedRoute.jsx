import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * This component protects routes that require authentication.
 * It uses the modern "wrapper route" pattern from react-router-dom v6.
 * * - If the user is authenticated, it renders an <Outlet />, which displays
 * whatever child route is currently active.
 * - If the user is not authenticated, it redirects them to the /login page.
 */
const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to so we can send them there after login.
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the child route component via the Outlet.
  return <Outlet />;
};

export default ProtectedRoute;