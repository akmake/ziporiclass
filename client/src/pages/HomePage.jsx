// client/src/pages/HomePage.jsx (הקוד המלא והמתוקן)

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
    Hourglass, PlusCircle, TrendingUp, DollarSign, Users
} from 'lucide-react'; 
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore.js';

// --- הגדרות עיצוב מותג (זהב ושחור) ---
const THEME = {
    GOLD: '#bfa15f',
    GOLD_HOVER: '#a28e4d',
    DARK: '#1e293b', 
    BLACK: '#0f172a', 
};

const SERVER_ROOT = (import.meta.env.VITE_API_BASE_URL || 'https://ziporiteem.com').replace(/\/api$/, '');
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

// ✨ שינוי: קורא את הראוט החדש והמדויק (getMyOrderStats)
const fetchMyStats = async () => {
    try { 
        const { data } = await api.get('/orders/my-stats');
        return data; 
    } 
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
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto flex flex-col space-y-8"
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
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = THEME.GOLD_HOVER}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = THEME.GOLD}
            >
                <Link to="/new-order" className="flex items-center gap-2">
                    <PlusCircle size={20}/> יצירת הזמנה חדשה
                </Link>
            </Button>
        </header>

        {/* === שורת KPIs עליונה (3 כרטיסים) === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. כרטיס עמלות (הכרטיס הראשי הלבן החדש) - רקע בהיר לפי בקשתך */}
            <motion.div variants={itemVariants} className="h-full">
                <Card className="h-full bg-white text-slate-800 border border-slate-200 shadow-lg hover:shadow-xl transition-shadow relative">
                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: THEME.GOLD }}></div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-500 text-sm font-medium uppercase tracking-wider flex justify-between">
                            <span>יתרה לתשלום (עמלות)</span>
                            <Wallet className="h-5 w-5" style={{ color: THEME.GOLD }}/>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <span className="text-4xl font-black tracking-tight" style={{ color: THEME.GOLD }}>
                                {reportData?.hasData ? reportData.stats.totalCommission.toLocaleString() : '0'} ₪
                            </span>
                            <p className="text-slate-500 text-xs mt-1">
                                מתוך {reportData?.stats?.count || 0} עסקאות מאושרות
                            </p>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100">
                            <button 
                                onClick={() => setShowDetails(true)}
                                className="text-sm font-medium flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-colors w-full justify-end"
                            >
                                <Eye size={16}/> צפה בפירוט המלא
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* 2. כרטיס פוטנציאל (הזמנות פתוחות) - עכשיו אמור להציג נתונים */}
            <motion.div variants={itemVariants} className="h-full">
                <Card className="h-full bg-white border border-slate-200 shadow-md hover:border-slate-300 transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-500 text-sm font-medium uppercase tracking-wider flex justify-between">
                            <span>**שווי הזמנות בהמתנה**</span> {/* הכותרת המדויקת */}
                            <Hourglass className="text-slate-400 h-5 w-5"/>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <span className="text-4xl font-bold text-slate-800">
                                {(statsData?.pending?.value || 0).toLocaleString()} ₪
                            </span>
                            <p className="text-slate-500 text-xs mt-1">
                                סה"כ {statsData?.pending?.count || 0} הזמנות פתוחות
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <Link to="/orders-history" className="text-sm font-medium text-slate-700 flex items-center gap-2 hover:text-slate-900 transition-colors w-full justify-end">
                                <Users size={16}/> הזמנות בטיפול
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* 3. כרטיס מכירות חודשיות */}
            <motion.div variants={itemVariants} className="h-full">
                <Card className="h-full bg-white border border-slate-200 shadow-md hover:border-slate-300 transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-500 text-sm font-medium uppercase tracking-wider flex justify-between">
                            <span>מכירות החודש (סכום)</span>
                            <DollarSign className="text-slate-400 h-5 w-5"/>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <span className="text-4xl font-bold text-slate-800">
                                {(statsData?.monthly?.value || 0).toLocaleString()} ₪
                            </span>
                            <p className="text-slate-500 text-xs mt-1">
                                {statsData?.monthly?.count || 0} עסקאות סגורות
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <span className="text-sm font-medium text-slate-700 flex items-center gap-2 hover:text-slate-900 transition-colors w-full justify-end">
                                <TrendingUp size={16}/> ביצועים מצטברים
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

        </div>

        {/* === חלק תחתון: אזור הודעות (רוחב מלא) === */}
        {isAuthenticated && announcements.length > 0 && (
            <motion.div variants={itemVariants} className="w-full mt-8">
                <div className="flex items-center gap-2 mb-4 px-1">
                    <Megaphone className="text-gray-400 h-5 w-5" />
                    <h3 className="text-lg font-bold text-gray-700">עדכונים והודעות מערכת</h3>
                </div>
                
                <div className="grid gap-4">
                    {announcements.map((msg) => (
                        <Card key={msg._id} className="border-r-4 shadow-sm hover:shadow-md transition-all bg-white text-right" style={{ borderRightColor: THEME.GOLD }}>
                            <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-900 text-lg mb-1">{msg.title}</h4>
                                    <div 
                                        className="text-gray-600 text-sm line-clamp-4 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: msg.content }} 
                                    />
                                </div>
                                <div className="text-xs text-gray-400 flex flex-col items-end min-w-[80px] border-r md:border-r-0 md:border-l pr-4 md:pr-0 md:pl-4 border-gray-100">
                                    <span className="font-medium text-gray-500">{msg.authorName}</span>
                                    <span className="flex items-center gap-1 mt-1">
                                        <CalendarClock size={10} /> {format(new Date(msg.createdAt), 'dd/MM')} 
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </motion.div>
        )}

        {/* === דיאלוג פירוט עמלות (מעוצב מחדש) === */}
        {reportData?.hasData && (
            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 bg-slate-900 text-white">
                        <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: THEME.GOLD }}>
                            <Wallet size={24} style={{ color: THEME.GOLD }}/> פירוט תגמול לדוח האחרון 
                        </DialogTitle>
                        <p className="text-slate-400 text-sm font-normal">
                            []תאריך הפקה: {format(new Date(reportData.reportDate), 'dd/MM/yyyy')} 
                        </p>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-100 text-slate-600 sticky top-0 shadow-sm font-bold">
                                <tr>
                                    <th className="p-4 border-b">אורח</th>
                                    <th className="p-4 border-b">תאריך הגעה</th>
                                    <th className="p-4 border-b">סכום ששולם</th>
                                    <th className="p-4 border-b text-slate-900">עמלה</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reportData.items?.map((item, i) => (
                                    <tr key={i} className="hover:bg-[#bfa15f]/5 transition-colors">
                                        <td className="p-4 font-medium text-slate-800">{item.guestName}</td>
                                        <td className="p-4 text-slate-500">{item.arrivalDate ? format(new Date(item.arrivalDate), 'dd/MM/yy') : '-'}</td>
                                        <td className="p-4 text-slate-600 font-mono">{item.paidAmount?.toLocaleString()} ₪</td>
                                        <td className="p-4 font-bold text-slate-900 bg-[#bfa15f]/20">{item.commission?.toLocaleString()} ₪</td>
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
        )}
      </motion.div>
    </main>
  );
}