import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Menu, X, LogOut, Home, PlusCircle, User, ChevronDown, FileText, ListOrdered, Shield,
  Mail, Calculator, Wrench, CalendarDays, Activity, Paintbrush, History, FileSpreadsheet, UploadCloud, UserCog, BedDouble
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore.js";
import { Button } from "@/components/ui/Button.jsx";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/Dropdown-menu";
import { LeadsBell } from './LeadsBell';

// לוגיקה לבניית התפריטים לפי הרשאות
const getNavGroups = (isAuthenticated, user) => {
  if (!isAuthenticated) return null;

  const role = user?.role;
  const groups = {
      sales: [],
      operations: [],
      admin: []
  };

  // 1. קבוצת מכירות (Sales)
  if (role === 'admin' || role === 'sales') {
      groups.sales = [
        { to: '/', label: 'ראשי (מכירות)', icon: Home },
        { to: '/new-order', label: 'הזמנה חדשה', icon: PlusCircle },
        { to: '/orders-history', label: 'הזמנות והצעות', icon: FileText },
        { to: '/leads', label: 'תיבת פניות', icon: Mail },
        { to: '/sales-guide', label: 'מחשבון ומדריך', icon: Calculator },
      ];
      if (user?.canManagePriceLists || role === 'admin') {
        groups.sales.push({ to: '/manage-pricelists', label: 'ניהול מחירונים', icon: ListOrdered });
      }
  }

  // 2. קבוצת תפעול (Shift Manager / Maintenance / Housekeeper)
  if (role === 'admin' || role === 'maintenance' || role === 'shift_manager' || role === 'housekeeper') {
      // קישור למסך עובד (חדרנית/איש אחזקה בשטח)
      groups.operations.push(
          { to: '/maintenance', label: 'מסך עובד שטח', icon: Paintbrush }
      );

      // רק מנהלים ואחראי משמרת - כלי ניהול
      if (role === 'admin' || role === 'shift_manager') {
          groups.operations.push(
              { to: '/bookings', label: 'קליטת סידור (אקסל)', icon: UploadCloud }, // ✅ תוקן: הנתיב הנכון הוא /bookings
              { to: '/admin/daily-plan', label: 'סידור עבודה', icon: CalendarDays },
              { to: '/admin/room-assignment', label: 'שיבוץ חדרים', icon: UserCog },
              { to: '/admin/rooms-status', label: 'תמונת מצב חדרים', icon: Activity }, // ✅ הוסף: תמונת מצב
              { to: '/admin/rooms/create', label: 'הקמת חדרים', icon: BedDouble },     // ✅ הוסף: הקמת חדרים
          );
      }
      
      // מנהלים ואנשי תחזוקה - דשבורד ניהולי לתחזוקה
      if (role === 'admin' || role === 'maintenance') {
           groups.operations.push({ to: '/admin/maintenance', label: 'מרכז תפעול', icon: Wrench });
      }
  }

  // 3. קבוצת אדמין כללי (Admin)
  if (role === 'admin') {
      groups.admin = [
          { to: '/admin/users', label: 'ניהול משתמשים', icon: User },
          { to: '/admin/hotels', label: 'ניהול מלונות', icon: Shield },
          { to: '/admin/commissions', label: 'דוח עמלות', icon: FileSpreadsheet },
          { to: '/admin/audit-logs', label: 'יומן פעילות', icon: History },
      ];
  }

  return groups;
};

export default function Navbar() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { isAuthenticated, user, logout } = useAuthStore();

    const navGroups = getNavGroups(isAuthenticated, user);

    return (
        <>
            {/* Sidebar for Desktop */}
            <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
                <SidebarContent
                    groups={navGroups}
                    user={user}
                    isAuthenticated={isAuthenticated}
                    logout={logout}
                />
            </div>

            {/* Mobile Top Bar */}
            <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-900 border-b h-16 px-4">
               <Link to="/" className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent">
                      ZIPORI CLASS
                </Link>

                <div className="flex items-center gap-4">
                  {/* פעמון בנייד - לא לעובדי ניקיון/תחזוקה */}
                  {isAuthenticated && user?.role !== 'maintenance' && user?.role !== 'housekeeper' && <LeadsBell />}

                  <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                      <Menu className="h-6 w-6" />
                  </Button>
                </div>
            </div>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed inset-y-0 right-0 z-50 w-64 md:hidden"
                    >
                        <SidebarContent
                            groups={navGroups}
                            user={user}
                            isAuthenticated={isAuthenticated}
                            logout={logout}
                            onClose={() => setSidebarOpen(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
      );
}

function SidebarContent({ groups, user, isAuthenticated, logout, onClose }) {
    const handleLogout = () => {
        logout();
        if (onClose) onClose();
    };

    return (
        <div className="flex flex-col flex-grow border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto h-full shadow-xl">
            {/* Header / Logo */}
            <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 bg-slate-50 border-b">
                <Link to="/" onClick={onClose} className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent">
                    ZIPORI CLASS
                </Link>

                <div className="flex items-center gap-3">
                    {isAuthenticated && user?.role !== 'maintenance' && user?.role !== 'housekeeper' && <LeadsBell />}

                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-6 w-6" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Nav Items Section */}
            <div className="flex-1 flex flex-col py-4 px-3 gap-6">

                {/* 1. קבוצת מכירות */}
                {groups?.sales?.length > 0 && (
                    <div>
                        <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">מערכת הזמנות</h3>
                        <nav className="space-y-1">
                            {groups.sales.map((item) => (
                                <NavItem key={item.to} item={item} onClick={onClose} />
                            ))}
                        </nav>
                    </div>
                )}

                {/* 2. קבוצת תפעול */}
                {groups?.operations?.length > 0 && (
                    <div>
                        {(groups.sales?.length > 0) && <div className="my-2 border-t border-gray-100"></div>}
                        <h3 className="px-3 text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2 mt-2">תפעול וניקיון</h3>
                        <nav className="space-y-1">
                            {groups.operations.map((item) => (
                                <NavItem key={item.to} item={item} onClick={onClose} />
                            ))}
                        </nav>
                    </div>
                )}

                {/* 3. קבוצת אדמין */}
                {groups?.admin?.length > 0 && (
                    <div>
                        {(groups.sales?.length > 0 || groups.operations?.length > 0) && <div className="my-2 border-t border-gray-100"></div>}
                        <h3 className="px-3 text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2 mt-2">ניהול ראשי</h3>
                        <nav className="space-y-1">
                            {groups.admin.map((item) => (
                                <NavItem key={item.to} item={item} onClick={onClose} />
                            ))}
                        </nav>
                    </div>
                )}
            </div>

            {/* Footer User Area */}
            <div className="px-2 py-4 border-t dark:border-slate-800 bg-gray-50">
                {isAuthenticated ? (
                    <UserNav user={user} logout={handleLogout} />
                ) : (
                    <div className="space-y-2">
                        <Button variant="ghost" asChild className="w-full justify-start">
                            <Link to="/login" onClick={onClose}><User className="ml-2 h-4 w-4" />התחברות</Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function NavItem({ item, onClick }) {
    const navLinkClass = "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors";
    const activeClass = "bg-slate-100 dark:bg-slate-800 text-primary dark:text-white";
    const inactiveClass = "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-white";
    return (
        <NavLink
            to={item.to}
            onClick={onClick}
            className={({ isActive }) => `${navLinkClass} ${isActive ? activeClass : inactiveClass}`}
          >
            <item.icon className="ml-3 flex-shrink-0 h-5 w-5" />
            {item.label}
        </NavLink>
    );
}

function UserNav({ user, logout }) {
    const getInitials = (name) => {
        if (!name) return 'U';
        const names = name.split(' ');
        return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name[0].toUpperCase();
    };
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
                <div className="flex items-center gap-3 text-sm font-medium p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        {getInitials(user?.name)}
                    </div>
                    <div className="text-start flex-1 truncate">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{user?.name || 'משתמש'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    </div>
                    <ChevronDown size={16} className="text-slate-500" />
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>התנתק</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}