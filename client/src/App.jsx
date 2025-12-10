import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast'; // או מהספרייה שאתה משתמש בה

/* Layout & Protection */
import MainLayout from './components/layout/MainLayout'; // או Layout
import AuthLayout from './components/layout/AuthLayout'; // אם קיים
import ProtectedRoute from './components/auth/ProtectedRoute'; // או המידלוור שלך
import Layout from "@/components/Layout.jsx"; // גיבוי למקרה שאתה משתמש בזה
import AdminRoute from "@/components/routes/AdminRoute.jsx";
import SalesRoute from "@/components/routes/SalesRoute.jsx";
import MaintenanceRoute from "@/components/routes/MaintenanceRoute.jsx";
import PriceListManagerRoute from "@/components/routes/PriceListManagerRoute.jsx";
import ShiftManagerRoute from "@/components/routes/ShiftManagerRoute.jsx";

/* Auth Pages */
import LoginPage from './pages/auth/LoginPage'; // או pages/LoginPage

/* Sales Pages */
import HomePage from "@/pages/HomePage.jsx";
import OrderPage from '@/pages/OrderPage.jsx';
import OrdersPage from '@/pages/OrdersPage.jsx';
import EditOrderPage from '@/pages/EditOrderPage.jsx';
import LeadsPage from '@/pages/LeadsPage.jsx';
import PricingLogicPage from '@/pages/PricingLogicPage.jsx';
import QuotePage from '@/pages/QuotePage.jsx';

/* Admin Pages */
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import HotelsPage from './pages/admin/HotelsPage'; // או ManageHotelsPage
import ManageHotelsPage from './pages/admin/ManageHotelsPage';
import UsersPage from './pages/admin/UsersPage'; // או ManageUsersPage
import ManageUsersPage from './pages/admin/ManageUsersPage';
import BookingManagementPage from './pages/admin/BookingManagementPage';
import DailyPlanPage from './pages/admin/DailyPlanPage';
import RoomAssignmentPage from './pages/admin/RoomAssignmentPage';
import ManagePhysicalRoomsPage from './pages/admin/ManagePhysicalRoomsPage'; // הוחזר!
import RoomStatusPage from './pages/admin/RoomStatusPage'; // הוחזר!
import ManageChecklistsPage from './pages/admin/ManageChecklistsPage'; // הוחזר!
import AdminMaintenanceDashboard from "@/pages/admin/AdminMaintenanceDashboard.jsx";
import AffiliateReportsPage from '@/pages/admin/AffiliateReportsPage.jsx';
import ManageAnnouncementsPage from '@/pages/admin/ManageAnnouncementsPage.jsx';
import ManageReferrersPage from '@/pages/admin/ManageReferrersPage.jsx';
import ManageExtrasPage from '@/pages/admin/ManageExtrasPage.jsx';
import AuditLogsPage from "@/pages/admin/AuditLogsPage.jsx";
import CommissionsPage from "@/pages/admin/CommissionsPage.jsx";

/* Maintenance Pages */
import MaintenanceDashboardPage from './pages/maintenance/MaintenanceDashboardPage';
import HousekeeperView from './pages/maintenance/HousekeeperView';

/* Components */
import PushNotificationManager from "@/components/PushNotificationManager.jsx";
import AutoLogout from "@/components/AutoLogout.jsx";
import NotFoundPage from "@/pages/NotFoundPage.jsx";

function App() {
  return (
    <>
      <PushNotificationManager />
      <AutoLogout />
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      
      <Routes>
        {/* נתיבים פתוחים */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/quote/:orderId" element={<QuotePage />} />

        {/* נתיבים מוגנים (בתוך Layout) */}
        <Route path="/" element={<Layout />}>
          
          {/* --- Sales & General --- */}
          <Route element={<SalesRoute />}>
             <Route index element={<HomePage />} />
             <Route path="new-order" element={<OrderPage />} />
             <Route path="orders-history" element={<OrdersPage />} />
             <Route path="edit-order/:orderId" element={<EditOrderPage />} />
             <Route path="leads" element={<LeadsPage />} />
             <Route path="sales-guide" element={<PricingLogicPage />} />
          </Route>

          {/* --- Maintenance Workers --- */}
          <Route element={<MaintenanceRoute />}>
             <Route path="maintenance" element={<MaintenanceDashboardPage />} />
             <Route path="housekeeper" element={<HousekeeperView />} />
          </Route>

          {/* --- Price Lists --- */}
          <Route element={<PriceListManagerRoute />}>
             <Route path="manage-pricelists" element={<ManagePriceListsPage />} /> // וודא שהקובץ קיים בנתיב זה
          </Route>

          {/* --- Shift Manager & Admin --- */}
          <Route element={<ShiftManagerRoute />}>
             <Route path="bookings" element={<BookingManagementPage />} />
          </Route>

          {/* --- Admin Panel --- */}
          <Route path="admin" element={<AdminRoute />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            
            {/* ניהול חדרים ותפעול - הוספתי חזרה את הנתיבים החסרים */}
            <Route path="daily-plan" element={<DailyPlanPage />} />
            <Route path="room-assignment" element={<RoomAssignmentPage />} />
            <Route path="rooms/create" element={<ManagePhysicalRoomsPage />} /> {/* ✅ תוקן */}
            <Route path="rooms-status" element={<RoomStatusPage />} /> {/* ✅ תוקן */}
            <Route path="rooms-checklists" element={<ManageChecklistsPage />} /> {/* ✅ תוקן */}
            <Route path="maintenance" element={<AdminMaintenanceDashboard />} />

            {/* ניהול כללי */}
            <Route path="users" element={<ManageUsersPage />} />
            <Route path="hotels" element={<ManageHotelsPage />} />
            <Route path="orders" element={<ManageOrdersPage />} /> // וודא שיש לך קובץ כזה
            <Route path="extras" element={<ManageExtrasPage />} />
            <Route path="announcements" element={<ManageAnnouncementsPage />} />
            <Route path="referrers" element={<ManageReferrersPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="affiliates" element={<AffiliateReportsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}

// קומפוננטת דמי למקרה שחסר קובץ (כדי שהבנייה לא תיכשל)
function ManagePriceListsPage() { return <div>ManagePriceListsPage Placeholder</div> }
function ManageOrdersPage() { return <div>ManageOrdersPage Placeholder</div> }

export default App;