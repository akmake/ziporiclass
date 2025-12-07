import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/Card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge.jsx"; // ודא שקיים, אם לא - הסר או החלף ב-div מעוצב
import api from '@/utils/api.js';
import {
    Megaphone, Wallet, TrendingUp, AlertCircle, 
    PlusCircle, ArrowLeft, Phone, User, Calendar, 
    ChevronLeft, LayoutDashboard, FileText, BellRing
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore.js';

// --- הגדרות עיצוב ---
const BRAND_COLOR = '#bfa15f';
const SERVER_ROOT = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/api$/, '');
// לוגו ברירת מחדל אם אין לוגו מהשרת
const LOGO_URL = `${SERVER_ROOT}/uploads/company-logo.png?t=${Date.now()}`;

// --- שליפת נתונים ---
const fetchMyAnnouncements = async () => {
  try {
    const { data } = await api.get('/announcements');
    return data;
  } catch (error) {
    console.error("Failed to fetch announcements", error);
    return [];
  }
};

const fetchMyCommission = async () => {
  try {
    const { data } = await api.get('/admin/commissions/my-summary');
    return data;
  } catch (error) {
    console.error("Failed to fetch commission", error);
    return { hasData: false };
  }
};

const fetchMyStats = async () => {
    try {
        const { data } = await api.get('/orders/stats');
        return data;
    } catch (error) {
        return {};
    }
};

// שליפת הלידים האחרונים (חדש לדשבורד)
const fetchRecentLeads = async () => {
    try {
        const { data } = await api.get('/leads');
        // מחזיר רק את ה-5 החדשים ביותר שטרם נסגרו
        return data.filter(l => l.status === 'new' || l.status === 'in_progress').slice(0, 5);
    } catch (error) {
        return [];
    }
};

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const [showCommissionDetails, setShowCommissionDetails] = useState(false);

  // 1. הודעות
  const { data: announcements = [] } = useQuery({
    queryKey: ['myAnnouncements'],
    queryFn: fetchMyAnnouncements,
    enabled: isAuthenticated,
  });

  // 2. עמלות
  const { data: commissionData } = useQuery({
    queryKey: ['myLatestCommission'],
    queryFn: fetchMyCommission,
    enabled: isAuthenticated && (user?.role === 'sales' || user?.canViewCommissions),
  });

  // 3. סטטיסטיקות כלליות
  const { data: stats } = useQuery({
    queryKey: ['myStats'],
    queryFn: fetchMyStats,
    enabled: isAuthenticated,
  });

  // 4. לידים אחרונים (חדש)
  const { data: recentLeads = [] } = useQuery({
      queryKey: ['recentLeadsDashboard'],
      queryFn: fetchRecentLeads,
      enabled: isAuthenticated,
      refetchInterval: 30000 // רענון כל חצי דקה
  });

  // Variants לאנימציה
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  if (!isAuthenticated) return null; // או הפניה ללוגין

  return (
    <main className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* === Header Section === */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-amber-100 to-orange-50 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                     {/* אם יש לוגו אישי למשתמש או סתם אות ראשונה */}
                     <span className="text-2xl font-bold text-amber-600">{user?.name?.[0]?.toUpperCase()}</span>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        בוקר טוב, {user?.name?.split(' ')[0]} 👋
                    </h1>
                    <p className="text-slate-500 text-sm">
                        יש לך <span className="font-bold text-amber-600">{recentLeads.length}</span> לידים שממתינים לטיפול ו-<span className="font-bold text-blue-600">{stats?.pending?.count || 0}</span> הזמנות פתוחות.
                    </p>
                </div>
            </div>
            
            <div className="flex gap-3">
                {user?.canManagePriceLists && (
                    <Button variant="outline" asChild className="gap-2 hidden md:flex">
                        <Link to="/manage-pricelists"><FileText size={16}/> מחירונים</Link>
                    </Button>
                )}
                <Button asChild className="gap-2 bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200">
                    <Link to="/new-order"><PlusCircle size={18}/> הזמנה חדשה</Link>
                </Button>
            </div>
        </header>

        {/* === KPI Cards Grid === */}
        <motion.div 
            variants={containerVariants} initial="hidden" animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
            {/* Card 1: Revenue (Monthly) */}
            <motion.div variants={itemVariants}>
                <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-all">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">מכירות החודש</p>
                                <h3 className="text-2xl font-bold text-emerald-700 mt-1">
                                    {(stats?.monthly?.value || 0).toLocaleString()} ₪
                                </h3>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-1 rounded-full">
                            {stats?.monthly?.count || 0} עסקאות סגורות
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Card 2: Commission (Salary) */}
            <motion.div variants={itemVariants}>
                <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-all relative overflow-hidden">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">עמלות לתשלום</p>
                                <h3 className="text-2xl font-bold text-purple-700 mt-1">
                                    {commissionData?.hasData ? commissionData.stats.totalCommission.toLocaleString() : '0'} ₪
                                </h3>
                            </div>
                            <div className="p-2 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100" onClick={() => setShowCommissionDetails(true)}>
                                <Wallet className="h-5 w-5 text-purple-600" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                             <span className="text-xs text-slate-400">דוח אחרון: {commissionData?.reportDate ? format(new Date(commissionData.reportDate), 'dd/MM') : '-'}</span>
                             {commissionData?.hasData && (
                                 <button onClick={() => setShowCommissionDetails(true)} className="text-[10px] text-purple-600 font-bold hover:underline">
                                     לפירוט המלא
                                 </button>
                             )}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Card 3: Pending (Pipeline) */}
            <motion.div variants={itemVariants}>
                <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-all">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">הצעות פתוחות</p>
                                <h3 className="text-2xl font-bold text-amber-700 mt-1">
                                    {stats?.pending?.count || 0}
                                </h3>
                            </div>
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <AlertCircle className="h-5 w-5 text-amber-600" />
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                            שווי פוטנציאלי: <span className="font-bold">{(stats?.pending?.value || 0).toLocaleString()} ₪</span>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Card 4: Active Leads */}
            <motion.div variants={itemVariants}>
                <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-all">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">לידים בטיפול</p>
                                <h3 className="text-2xl font-bold text-blue-700 mt-1">
                                    {stats?.activeLeads || 0}
                                </h3>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <BellRing className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                        <Link to="/leads" className="mt-3 text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                            עבור לתיבת הפניות <ChevronLeft size={10}/>
                        </Link>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>

        {/* === Main Content Grid === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column (2/3): Actionable Items */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* 1. Recent Leads Widget */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-50">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User className="text-blue-500 h-5 w-5"/> פניות אחרונות לטיפול
                            </CardTitle>
                            <CardDescription>לידים חדשים שנכנסו למערכת ודורשים התייחסות</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="text-blue-600">
                            <Link to="/leads">לכל הפניות</Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentLeads.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {recentLeads.map(lead => (
                                    <div key={lead._id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2 w-2 rounded-full ${lead.status === 'new' ? 'bg-blue-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{lead.parsedName || 'ללא שם'}</p>
                                                <p className="text-xs text-slate-500 truncate max-w-[200px]">{lead.parsedNote || 'אין הערות'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-slate-400 hidden sm:block">{format(new Date(lead.receivedAt), 'HH:mm dd/MM')}</span>
                                            {lead.parsedPhone && (
                                                <a 
                                                    href={`https://wa.me/${lead.parsedPhone}`} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="bg-green-50 text-green-700 p-2 rounded-full hover:bg-green-100 transition-colors"
                                                    title="שלח וואטסאפ"
                                                >
                                                    <Phone size={16} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-500">
                                <p>אין פניות חדשות כרגע (איזה כיף, אפשר לנוח!)</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>

            {/* Right Column (1/3): Info & Updates */}
            <div className="space-y-8">
                
                {/* Announcements Feed */}
                <Card className="shadow-sm border-slate-200 h-full max-h-[500px] flex flex-col">
                    <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Megaphone className="text-amber-500 h-4 w-4"/> לוח מודעות
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                        {announcements.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {announcements.map((msg) => (
                                    <div key={msg._id} className="p-4 hover:bg-amber-50/30 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-sm text-slate-800">{msg.title}</h4>
                                            <span className="text-[10px] text-slate-400 bg-white border px-1.5 rounded">
                                                {format(new Date(msg.createdAt), 'dd/MM')}
                                            </span>
                                        </div>
                                        <div 
                                            className="text-xs text-slate-600 line-clamp-3 prose prose-sm leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: msg.content }} 
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-xs text-gray-400">
                                אין הודעות חדשות.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Shortcuts */}
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-lg">
                    <CardContent className="p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <LayoutDashboard size={18} className="text-amber-400"/> ניווט מהיר
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="secondary" className="w-full justify-start gap-2 text-xs h-10 bg-white/10 hover:bg-white/20 text-white border-0" asChild>
                                <Link to="/orders-history"><FileText size={14}/> כל ההזמנות</Link>
                            </Button>
                            <Button variant="secondary" className="w-full justify-start gap-2 text-xs h-10 bg-white/10 hover:bg-white/20 text-white border-0" asChild>
                                <Link to="/sales-guide"><Calendar size={14}/> מחשבון</Link>
                            </Button>
                            {/* אפשר להוסיף כאן עוד כפתורים בעתיד */}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>

        {/* --- דיאלוג פירוט עמלות (ללא שינוי מהקוד המקורי, רק שמירה על הפונקציונליות) --- */}
        <Dialog open={showCommissionDetails} onOpenChange={setShowCommissionDetails}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 bg-slate-50 border-b">
                    <DialogTitle>פירוט תגמול לדוח האחרון</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-100 text-slate-700 sticky top-0 shadow-sm font-semibold">
                            <tr>
                                <th className="p-3 border-b">אורח</th>
                                <th className="p-3 border-b">תאריך הגעה</th>
                                <th className="p-3 border-b">סכום ששולם</th>
                                <th className="p-3 border-b" style={{ color: BRAND_COLOR }}>עמלה</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {commissionData?.items?.map((item, i) => (
                                <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                                    <td className="p-3 font-medium text-slate-800">{item.guestName}</td>
                                    <td className="p-3 text-slate-500">{item.arrivalDate ? format(new Date(item.arrivalDate), 'dd/MM/yy') : '-'}</td>
                                    <td className="p-3 text-slate-600">{item.paidAmount?.toLocaleString()} ₪</td>
                                    <td className="p-3 font-bold" style={{ color: '#a28e4d' }}>{item.commission?.toLocaleString()} ₪</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50 border-t text-center text-xs text-gray-400">
                    * הנתונים סופיים ומבוססים על דוחות שאושרו ונסגרו על ידי הנהלת החשבונות.
                </div>
            </DialogContent>
        </Dialog>

      </div>
    </main>
  );
}