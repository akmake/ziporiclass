import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog"; 
import api from '@/utils/api.js';
import { 
    Megaphone, CalendarClock, Wallet, Eye, 
    Hourglass, PlusCircle, TrendingUp, ChevronLeft 
} from 'lucide-react'; 
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore.js';

// --- הגדרות עיצוב מותג (זהב ושחור) ---
const THEME = {
    GOLD: '#bfa15f',
    GOLD_HOVER: '#a28e4d',
    DARK: '#1e293b', // Slate-800
    BLACK: '#0f172a', // Slate-900
};

const SERVER_ROOT = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/api$/, '');
const LOGO_URL = `${SERVER_ROOT}/uploads/company-logo.png?t=${Date.now()}`;

// --- שליפת נתונים ---
const fetchMyAnnouncements = async () => {
  try { return (await api.get('/announcements')).data; } 
  catch (error) { return []; }
};

const fetchMyCommission = async () => {
    try { return (await api.get('/admin/commissions/my-summary')).data; } 
    catch (error) { return { hasData: false }; }
};

const fetchMyStats = async () => {
    try { return (await api.get('/orders/stats')).data; } 
    catch (error) { return {}; }
};

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const [showDetails, setShowDetails] = useState(false);

  const { data: announcements = [] } = useQuery({
    queryKey: ['myAnnouncements'],
    queryFn: fetchMyAnnouncements,
    enabled: isAuthenticated
  });

  const { data: reportData } = useQuery({
    queryKey: ['myReportSummary'],
    queryFn: fetchMyCommission,
    enabled: isAuthenticated,
  });

  const { data: statsData } = useQuery({
    queryKey: ['myStats'],
    queryFn: fetchMyStats,
    enabled: isAuthenticated,
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } }
  };

  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto space-y-8"
      >

        {/* === Header: לוגו וברכה === */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border-t-4" style={{ borderColor: THEME.GOLD }}>
            <div className="flex items-center gap-6">
                <img
                    src={LOGO_URL}
                    alt="Logo"
                    className="h-20 object-contain"
                    onError={(e) => e.target.style.display = 'none'}
                    crossOrigin="anonymous"
                />
                <div className="border-r border-slate-200 pr-6 mr-2 h-16 flex flex-col justify-center">
                    <h1 className="text-3xl font-bold text-slate-900">
                        שלום {user?.name}
                    </h1>
                    <p className="text-slate-500">ברוך הבא למערכת הניהול</p>
                </div>
            </div>
            
            <Button 
                asChild 
                className="mt-4 md:mt-0 text-white px-8 h-12 text-lg shadow-lg hover:shadow-xl transition-all"
                style={{ backgroundColor: THEME.GOLD }}
                onMouseEnter={(e) => e.target.style.backgroundColor = THEME.GOLD_HOVER}
                onMouseLeave={(e) => e.target.style.backgroundColor = THEME.GOLD}
            >
                <Link to="/new-order" className="flex items-center gap-2">
                    <PlusCircle size={20}/> הזמנה חדשה
                </Link>
            </Button>
        </header>

        {/* === Grid הנתונים === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* עמודה ימנית: פיננסים (תופס 2/3) */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. כרטיס שחור: עמלות (הכסף בכיס) */}
                <motion.div variants={itemVariants} className="h-full">
                    <Card className="h-full bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden group">
                        {/* אפקט זהב ברקע */}
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#bfa15f] rounded-full opacity-10 blur-3xl group-hover:opacity-20 transition-opacity duration-700"></div>
                        
                        <CardHeader className="pb-2">
                            <CardTitle className="text-slate-400 text-sm font-medium uppercase tracking-wider flex justify-between">
                                <span>יתרה לתשלום (עמלות)</span>
                                <Wallet className="text-[#bfa15f] h-5 w-5"/>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <span className="text-4xl font-bold tracking-tight" style={{ color: THEME.GOLD }}>
                                    {reportData?.hasData ? reportData.stats.totalCommission.toLocaleString() : '0'} ₪
                                </span>
                                <p className="text-slate-400 text-xs mt-1">
                                    מתוך {reportData?.stats?.count || 0} עסקאות מאושרות
                                </p>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-800">
                                <button 
                                    onClick={() => setShowDetails(true)}
                                    className="text-sm flex items-center gap-2 hover:text-[#bfa15f] transition-colors w-full"
                                >
                                    <Eye size={16}/> צפה בפירוט המלא
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* 2. כרטיס לבן: פוטנציאל (הזמנות פתוחות) */}
                <motion.div variants={itemVariants} className="h-full">
                    <Card className="h-full bg-white border border-slate-200 shadow-md hover:border-[#bfa15f] transition-colors">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-slate-500 text-sm font-medium uppercase tracking-wider flex justify-between">
                                <span>הזמנות פתוחות (צפי)</span>
                                <Hourglass className="text-slate-400 h-5 w-5"/>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <span className="text-4xl font-bold text-slate-800">
                                    {(statsData?.pending?.value || 0).toLocaleString()} ₪
                                </span>
                                <p className="text-slate-500 text-xs mt-1">
                                    שווי {statsData?.pending?.count || 0} הזמנות שטרם נסגרו
                                </p>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <Link to="/orders-history" className="text-sm font-bold text-slate-700 flex items-center gap-2 hover:text-[#bfa15f] transition-colors">
                                    <TrendingUp size={16}/> עבור לניהול הזמנות
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* 3. סטטיסטיקה חודשית (רחב) */}
                <motion.div variants={itemVariants} className="md:col-span-2">
                    <Card className="bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-[#bfa15f]/10">
                                <CalendarClock className="h-8 w-8 text-[#bfa15f]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">ביצועים החודש</h3>
                                <p className="text-slate-500 text-sm">
                                    ביצעת <span className="font-bold text-slate-900">{statsData?.monthly?.count || 0}</span> הזמנות בהיקף כולל של:
                                </p>
                            </div>
                        </div>
                        <div className="text-3xl font-black text-slate-900 mt-4 md:mt-0">
                            {(statsData?.monthly?.value || 0).toLocaleString()} ₪
                        </div>
                    </Card>
                </motion.div>

            </div>

            {/* עמודה שמאלית: הודעות ועדכונים (1/3) */}
            <motion.div variants={itemVariants} className="h-full">
                <Card className="h-full bg-white border-slate-200 shadow-sm flex flex-col">
                    <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
                        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <Megaphone size={18} style={{ color: THEME.GOLD }}/> הודעות מערכת
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px]">
                        {announcements.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {announcements.map((msg) => (
                                    <div key={msg._id} className="p-4 hover:bg-[#bfa15f]/5 transition-colors group">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-sm text-slate-800 group-hover:text-[#bfa15f] transition-colors">{msg.title}</h4>
                                            <span className="text-[10px] text-slate-400 border px-1 rounded bg-white">
                                                {format(new Date(msg.createdAt), 'dd/MM')}
                                            </span>
                                        </div>
                                        <div 
                                            className="text-xs text-slate-600 line-clamp-4 leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: msg.content }} 
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                אין הודעות חדשות.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

        </div>

        {/* === דיאלוג פירוט עמלות (מעוצב מחדש לזהב/שחור) === */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 bg-slate-900 text-white">
                    <DialogTitle className="flex items-center gap-2">
                        <Wallet size={20} style={{ color: THEME.GOLD }}/> פירוט תגמול לדוח האחרון
                    </DialogTitle>
                    <p className="text-slate-400 text-sm font-normal">
                        תאריך הפקה: {reportData?.reportDate ? format(new Date(reportData.reportDate), 'dd/MM/yyyy') : '-'}
                    </p>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-100 text-slate-600 sticky top-0 shadow-sm font-bold">
                            <tr>
                                <th className="p-4 border-b">אורח</th>
                                <th className="p-4 border-b">תאריך הגעה</th>
                                <th className="p-4 border-b">סכום ששולם</th>
                                <th className="p-4 border-b text-[#bfa15f]">עמלה</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportData?.items?.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-medium text-slate-800">{item.guestName}</td>
                                    <td className="p-4 text-slate-500">{item.arrivalDate ? format(new Date(item.arrivalDate), 'dd/MM/yy') : '-'}</td>
                                    <td className="p-4 text-slate-600 font-mono">{item.paidAmount?.toLocaleString()} ₪</td>
                                    <td className="p-4 font-bold text-slate-900 bg-[#bfa15f]/10">{item.commission?.toLocaleString()} ₪</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50 border-t text-center text-xs text-slate-500">
                    * הנתונים סופיים ומבוססים על דוחות שאושרו ונסגרו על ידי הנהלת החשבונות.
                </div>
            </DialogContent>
        </Dialog>

      </motion.div>
    </main>
  );
}