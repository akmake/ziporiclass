import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/Card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import api from '@/utils/api.js';
import { 
    Megaphone, CalendarClock, Wallet, FileSpreadsheet, 
    TrendingUp, AlertCircle, CheckCircle2, PlusCircle, ArrowLeft, Eye 
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore.js';

// --- הגדרות עיצוב ---
const BRAND_COLOR = '#bfa15f'; 
const BRAND_BG_LIGHT = '#fcfbf8'; // רקע כמעט לבן עם נגיעת בז'
const SERVER_ROOT = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/api$/, '');
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
        console.error("Failed to fetch stats", error);
        return {};
    }
};

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const [showCommissionDetails, setShowCommissionDetails] = useState(false);

  // 1. הודעות
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['myAnnouncements'],
    queryFn: fetchMyAnnouncements,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5
  });

  // 2. עמלות (השכר)
  const { data: commissionData } = useQuery({
    queryKey: ['myLatestCommission'],
    queryFn: fetchMyCommission,
    enabled: isAuthenticated && (user?.role === 'sales' || user?.canViewCommissions),
    staleTime: 1000 * 60 * 10
  });

  // 3. סטטיסטיקות (הפוטנציאל)
  const { data: stats } = useQuery({
    queryKey: ['myStats'],
    queryFn: fetchMyStats,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2
  });

  // אנימציה אחידה לכל הכרטיסים
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8" style={{ backgroundColor: BRAND_BG_LIGHT }}>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* --- כותרת אישית ולוגו --- */}
        <div className="text-center space-y-2 mb-8">
            <motion.div 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ duration: 0.6 }} 
                className="mb-6 flex justify-center"
            >
                <img
                    src={LOGO_URL}
                    alt="Company Logo"
                    className="h-28 object-contain drop-shadow-md"
                    onError={(e) => e.target.style.display = 'none'}
                    crossOrigin="anonymous"
                />
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                שלום, <span style={{ color: BRAND_COLOR }}>{user?.name || 'אורח'}</span>
            </h1>
            <p className="text-gray-500">זהו מרכז השליטה שלך. הנה תמונת המצב להיום.</p>
        </div>

        {isAuthenticated && (
            <>
                {/* --- שורת המדדים (Stats Row) - המניע לפעולה --- */}
                <motion.div 
                    initial="hidden" animate="visible" variants={cardVariants} transition={{ duration: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    {/* 1. כסף על הרצפה */}
                    <Card className="border-t-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderTopColor: '#f59e0b' }}>
                        <CardContent className="p-5 text-center">
                            <div className="flex justify-center mb-2 bg-amber-50 p-3 rounded-full w-fit mx-auto">
                                <AlertCircle className="text-amber-600 h-6 w-6" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">הזמנות בהמתנה (פוטנציאל)</p>
                            <div className="mt-1">
                                <span className="text-2xl font-bold text-gray-800">{stats?.pending?.count || 0}</span>
                                <span className="text-xs text-gray-400 block mt-1">שווי כולל: {(stats?.pending?.value || 0).toLocaleString()} ₪</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. ביצועים החודש */}
                    <Card className="border-t-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderTopColor: '#10b981' }}>
                        <CardContent className="p-5 text-center">
                            <div className="flex justify-center mb-2 bg-emerald-50 p-3 rounded-full w-fit mx-auto">
                                <TrendingUp className="text-emerald-600 h-6 w-6" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">עסקאות שסגרת החודש</p>
                            <div className="mt-1">
                                <span className="text-2xl font-bold text-gray-800">{stats?.monthly?.count || 0}</span>
                                <span className="text-xs text-gray-400 block mt-1">מכירות: {(stats?.monthly?.value || 0).toLocaleString()} ₪</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. לידים בטיפול */}
                    <Card className="border-t-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderTopColor: '#3b82f6' }}>
                        <CardContent className="p-5 text-center">
                            <div className="flex justify-center mb-2 bg-blue-50 p-3 rounded-full w-fit mx-auto">
                                <Megaphone className="text-blue-600 h-6 w-6" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">לידים פעילים בטיפולך</p>
                            <div className="mt-1">
                                <span className="text-2xl font-bold text-gray-800">{stats?.activeLeads || 0}</span>
                                <Link to="/leads" className="text-xs text-blue-600 hover:underline block mt-1">
                                    לחץ למעבר לטיפול &larr;
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* --- אזור העמלות (השכר) --- */}
                {commissionData?.hasData && (
                    <motion.div 
                        initial="hidden" animate="visible" variants={cardVariants} transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <Card className="shadow-lg border-none bg-white overflow-hidden relative">
                            {/* פס קישוטי צדדי */}
                            <div className="absolute right-0 top-0 bottom-0 w-2" style={{ backgroundColor: BRAND_COLOR }}></div>
                            
                            <CardHeader className="pb-2 border-b border-gray-100 bg-amber-50/30 pr-8">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <Wallet style={{ color: BRAND_COLOR }} className="h-5 w-5"/> דוח עמלות אחרון
                                    </CardTitle>
                                    <span className="text-xs text-gray-500 bg-white border px-2 py-1 rounded-md">
                                        נכון לתאריך: {format(new Date(commissionData.reportDate), 'dd/MM/yyyy')}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pr-8">
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-6 text-center sm:text-right">
                                    <div>
                                        <p className="text-sm text-gray-500">סה"כ לתשלום (נטו)</p>
                                        <p className="text-4xl font-black mt-1" style={{ color: BRAND_COLOR }}>
                                            {commissionData.stats.totalCommission.toLocaleString()} ₪
                                        </p>
                                    </div>
                                    <div className="h-px sm:h-12 w-full sm:w-px bg-gray-200"></div>
                                    <div>
                                        <p className="text-sm text-gray-500">עסקאות שאושרו</p>
                                        <p className="text-xl font-bold text-gray-800">{commissionData.stats.count}</p>
                                    </div>
                                    <div className="h-px sm:h-12 w-full sm:w-px bg-gray-200"></div>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setShowCommissionDetails(true)}
                                        className="gap-2 border-amber-200 text-amber-800 hover:bg-amber-50"
                                    >
                                        <FileSpreadsheet size={16}/> פירוט מלא
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* --- אזור הודעות --- */}
                {announcements.length > 0 && (
                    <motion.div 
                        initial="hidden" animate="visible" variants={cardVariants} transition={{ duration: 0.5, delay: 0.2 }}
                        className="space-y-4"
                    >
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 pr-2 border-b pb-2">
                            <Megaphone size={18} className="text-gray-400"/> הודעות ועדכונים
                        </h3>
                        {announcements.map((msg) => (
                            <Card key={msg._id} className="shadow-sm border border-gray-200 hover:border-amber-300 transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base font-bold text-gray-800">{msg.title}</CardTitle>
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <CalendarClock size={12}/> {format(new Date(msg.createdAt), 'dd/MM/yyyy')}
                                        </span>
                                    </div>
                                    <CardDescription className="text-xs">מאת: {msg.authorName}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none" 
                                         dangerouslySetInnerHTML={{ __html: msg.content }} />
                                </CardContent>
                            </Card>
                        ))}
                    </motion.div>
                )}

                {/* --- כפתור פעולה מהירה תחתון --- */}
                <div className="flex justify-center pt-4 pb-8">
                    <Button asChild size="lg" className="shadow-lg hover:shadow-xl transition-all gap-2 text-lg px-8 h-14 rounded-full"
                        style={{ backgroundColor: BRAND_COLOR }}>
                        <Link to="/new-order"><PlusCircle size={22}/> יצירת הזמנה חדשה</Link>
                    </Button>
                </div>

            </>
        )}

        {/* --- דיאלוג פירוט עמלות --- */}
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