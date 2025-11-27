import { Routes, Route } from "react-router-dom";

/* Layout & Route Protection */
import Layout from "@/components/Layout.jsx";
import AdminRoute from "@/components/routes/AdminRoute.jsx";
import SalesRoute from "@/components/routes/SalesRoute.jsx";
import MaintenanceRoute from "@/components/routes/MaintenanceRoute.jsx";
import PriceListManagerRoute from "@/components/routes/PriceListManagerRoute.jsx";

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

/* Maintenance Pages */
import MaintenanceDashboardPage from '@/pages/maintenance/MaintenanceDashboardPage.jsx';

/* Admin Pages */
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage.jsx";
import AdminMaintenanceDashboard from "@/pages/admin/AdminMaintenanceDashboard.jsx";
import ManagePhysicalRoomsPage from '@/pages/admin/ManagePhysicalRoomsPage.jsx';
import RoomStatusPage from '@/pages/admin/RoomStatusPage.jsx';
import DailyPlanPage from '@/pages/admin/DailyPlanPage.jsx'; // ✨ הוספנו את ייבוא דף סידור העבודה
import ManagePriceListsPage from '@/pages/admin/ManagePriceListsPage.jsx';
import ManageOrdersPage from '@/pages/admin/ManageOrdersPage.jsx';
import ManageUsersPage from "@/pages/admin/ManageUsersPage.jsx";
import ManageHotelsPage from './pages/admin/ManageHotelsPage.jsx';
import AffiliateReportsPage from '@/pages/admin/AffiliateReportsPage.jsx';
import ManageAnnouncementsPage from '@/pages/admin/ManageAnnouncementsPage.jsx';
import ManageReferrersPage from '@/pages/admin/ManageReferrersPage.jsx';
import ManageExtrasPage from '@/pages/admin/ManageExtrasPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/quote/:orderId" element={<QuotePage />} />

      <Route path="/" element={<Layout />}>
        <Route path="login" element={<LoginPage />} />

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
           <Route path="maintenance" element={<MaintenanceDashboardPage />} />
        </Route>

        <Route element={<PriceListManagerRoute />}>
            <Route path="manage-pricelists" element={<ManagePriceListsPage />} />
        </Route>

        {/* --- Admin Panel --- */}
        <Route path="admin" element={<AdminRoute />}>
          <Route index element={<AdminDashboardPage />} />

          <Route path="maintenance" element={<AdminMaintenanceDashboard />} />
          <Route path="rooms/create" element={<ManagePhysicalRoomsPage />} />

          {/* דפי תפעול וניהול חדרים */}
          <Route path="rooms-status" element={<RoomStatusPage />} />
          <Route path="daily-plan" element={<DailyPlanPage />} /> {/* ✨ הנתיב החדש לסידור עבודה */}

          {/* שאר דפי הניהול */}
          <Route path="orders" element={<ManageOrdersPage />} />
          <Route path="users" element={<ManageUsersPage />} />
          <Route path="hotels" element={<ManageHotelsPage />} />
          <Route path="affiliates" element={<AffiliateReportsPage />} />
          <Route path="extras" element={<ManageExtrasPage />} />
          <Route path="referrers" element={<ManageReferrersPage />} />
          <Route path="announcements" element={<ManageAnnouncementsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}