import { Routes, Route } from "react-router-dom";

/* Layout & Route Protection */
import Layout from "@/components/Layout.jsx";
import AdminRoute from "@/components/routes/AdminRoute.jsx";
import SalesRoute from "@/components/routes/SalesRoute.jsx";
import MaintenanceRoute from "@/components/routes/MaintenanceRoute.jsx";
import PriceListManagerRoute from "@/components/routes/PriceListManagerRoute.jsx";
import ShiftManagerRoute from "@/components/routes/ShiftManagerRoute.jsx";
import UserRoute from "@/components/routes/UserRoute.jsx"; // וודא שיש לך כזה, או השתמש ב-ProtectedRoute

/* Public Pages */
import HomePage from "@/pages/HomePage.jsx";
import LoginPage from "@/pages/LoginPage.jsx";
import QuotePage from '@/pages/QuotePage.jsx';
import NotFoundPage from "@/pages/NotFoundPage.jsx";

/* Sales Pages */
import OrdersPage from '@/pages/OrdersPage.jsx';
import OrderPage from '@/pages/OrderPage.jsx';
import EditOrderPage from '@/pages/EditOrderPage.jsx';
import LeadsPage from '@/pages/LeadsPage.jsx';
import PricingLogicPage from '@/pages/PricingLogicPage.jsx';

/* Chat Page - ✨ חדש */
import ChatPage from '@/pages/ChatPage.jsx';

/* Maintenance Pages */
import HousekeeperView from '@/pages/maintenance/HousekeeperView.jsx';

/* Admin Pages */
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage.jsx";
import AdminMaintenanceDashboard from "@/pages/admin/AdminMaintenanceDashboard.jsx";
import ManagePhysicalRoomsPage from '@/pages/admin/ManagePhysicalRoomsPage.jsx';
import RoomStatusPage from '@/pages/admin/RoomStatusPage.jsx';
import AdminDailyDashboard from '@/pages/admin/AdminDailyDashboard.jsx';
import ManagePriceListsPage from '@/pages/admin/ManagePriceListsPage.jsx';
import ManageOrdersPage from '@/pages/admin/ManageOrdersPage.jsx';
import ManageUsersPage from "@/pages/admin/ManageUsersPage.jsx";
import ManageHotelsPage from './pages/admin/ManageHotelsPage.jsx';
import AffiliateReportsPage from '@/pages/admin/AffiliateReportsPage.jsx';
import ManageAnnouncementsPage from '@/pages/admin/ManageAnnouncementsPage.jsx';
import ManageReferrersPage from '@/pages/admin/ManageReferrersPage.jsx';
import ManageExtrasPage from '@/pages/admin/ManageExtrasPage.jsx';
import AuditLogsPage from "@/pages/admin/AuditLogsPage.jsx";
import CommissionsPage from "@/pages/admin/CommissionsPage.jsx";
import BookingManagementPage from "@/pages/admin/BookingManagementPage.jsx";
import RoomAssignmentPage from './pages/admin/RoomAssignmentPage';

import PushNotificationManager from "@/components/PushNotificationManager.jsx";
import AutoLogout from "@/components/AutoLogout.jsx";

export default function App() {
  return (
    <>
      <PushNotificationManager />
      <AutoLogout />

      <Routes>
        <Route path="/quote/:orderId" element={<QuotePage />} />

        <Route path="/" element={<Layout />}>
          <Route path="login" element={<LoginPage />} />

          {/* --- ✨ מסך הצ'אט (זמין לכל משתמש מחובר) --- */}
          <Route path="chat" element={
             // אם אין לך UserRoute, תשתמש ב-ProtectedRoute או פשוט תוודא שה-Layout מטפל בזה
             <ChatPage />
          } />

          {/* --- Sales & General Admin --- */}
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
             <Route path="maintenance" element={<HousekeeperView />} />
          </Route>

          <Route element={<PriceListManagerRoute />}>
            <Route path="manage-pricelists" element={<ManagePriceListsPage />} />
          </Route>

          {/* --- Shift Manager & Admin --- */}
          <Route element={<ShiftManagerRoute />}>
             <Route path="bookings" element={<BookingManagementPage />} />
          </Route>

          {/* --- Admin Panel --- */}
          <Route path="admin" element={<AdminRoute />}>
            <Route index element={<AdminDashboardPage />} />

            <Route path="maintenance" element={<AdminMaintenanceDashboard />} />
            <Route path="rooms/create" element={<ManagePhysicalRoomsPage />} />

            <Route path="rooms-status" element={<RoomStatusPage />} />
            <Route path="daily-plan" element={<AdminDailyDashboard />} />
            <Route path="room-assignment" element={<RoomAssignmentPage />} />

            <Route path="orders" element={<ManageOrdersPage />} />
            <Route path="users" element={<ManageUsersPage />} />
            <Route path="hotels" element={<ManageHotelsPage />} />
            <Route path="affiliates" element={<AffiliateReportsPage />} />
            <Route path="extras" element={<ManageExtrasPage />} />
            <Route path="referrers" element={<ManageReferrersPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="announcements" element={<ManageAnnouncementsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}