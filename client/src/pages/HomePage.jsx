// client/src/pages/HomePage.jsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/Card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog"; 
import api from '@/utils/api.js';
import { Megaphone, CalendarClock, Wallet, Eye } from 'lucide-react'; 
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore.js';

// חישוב כתובת השרת לטובת הלוגו
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const SERVER_ROOT = API_BASE.replace(/\/api$/, '');
const LOGO_URL = `${SERVER_ROOT}/uploads/company-logo.png?t=${Date.now()}`;

const BRAND_COLOR = '#bfa15f';
const BRAND_COLOR_HOVER = '#a28e4d';

const fetchMyAnnouncements = async () => {
  try {
    const { data } = await api.get('/announcements');
    return data;
  } catch (error) {
    console.error("Failed to fetch announcements", error);
    return [];
  }
};

const fetchMyReportSummary = async () => {
    try {
        const { data } = await api.get('/admin/commissions/my-summary');
        return data;
    } catch (error) {
        console.error("Failed to fetch summary", error);
        return { hasData: false };
    }
};

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const [showDetails, setShowDetails] = useState(false);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['myAnnouncements'],
    queryFn: fetchMyAnnouncements,
    staleTime: 1000 * 60 * 5,
    enabled: isAuthenticated
  });

  const { data: reportData } = useQuery({
    queryKey: ['myReportSummary'],
    queryFn: fetchMyReportSummary,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10
  });

  return (
    <main className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-6 text-center py-10 bg-slate-50/50">

      {/* --- לוגו החברה --- */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="mb-6"
      >
        <img
            src={LOGO_URL}
            alt="Company Logo"
            className="h-32 md:h-40 object-contain mx-auto drop-shadow-md"
            onError={(e) => e.target.style.display = 'none'}
            crossOrigin="anonymous"
        />
      </motion.div>

      {/* --- כותרת --- */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
        className="text-4xl sm:text-5xl font-extrabold mb-6 leading-tight text-gray-900"
      >
        רשת מלונות צפורי קלאס
        <br />
        <span style={{ color: BRAND_COLOR }}>ניהול ומעקב אחרי לידים ופניות</span>
      </motion.h1>

      {/* ✨✨✨ הווידג'ט החדש ✨✨✨ */}
      {isAuthenticated && reportData?.hasData && (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mb-8 px-4"
        >
          <Card className="border-t-4 border-purple-600 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-purple-50 pb-2 border-b border-purple-100">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Wallet className="text-purple-600" /> סיכום עמלות אחרון
                    </CardTitle>
                    <span className="text-sm text-gray-500 font-medium bg-white px-2 py-1 rounded border">
                        נכון לתאריך: {format(new Date(reportData.reportDate), 'dd/MM/yyyy')}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 text-center py-4 bg-slate-50 rounded-xl mb-4 border border-slate-100">
                <div>
                  <span className="block text-sm text-gray-500 mb-1">כמות עסקאות</span>
                  <span className="block text-2xl font-bold text-slate-800">{reportData.stats.count}</span>
                </div>
                <div className="border-r border-gray-300"> 
                  <span className="block text-sm text-gray-500 mb-1">סך הכנסות</span>
                  <span className="block text-2xl font-bold text-slate-800">{reportData.stats.totalRevenue.toLocaleString()} ₪</span>
                </div>
                <div className="border-r border-gray-300">
                  <span className="block text-sm text-purple-600 font-bold mb-1">עמלה לתשלום</span>
                  <span className="block text-3xl font-extrabold text-purple-700">{reportData.stats.totalCommission.toLocaleString()} ₪</span>
                </div>
              </div>

              <Button variant="outline" className="w-full border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => setShowDetails(true)}>
                <Eye className="ml-2 h-4 w-4"/> צפה בפירוט מלא
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* --- הודעות --- */}
      {isAuthenticated && (
          <div className="w-full max-w-2xl mb-10">
            <AnimatePresence>
              {!isLoading && announcements.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 text-left"
                >
                  {announcements.map((msg, idx) => (
                      <motion.div
                          key={msg._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + (idx * 0.1) }}
                      >
                          <Card className="bg-white shadow-sm hover:shadow-md transition-all border-l-4" style={{ borderLeftColor: BRAND_COLOR }}>
                              <CardHeader className="pb-2">
                                  <div className="flex justify-between items-start">
                                      <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                                          <Megaphone className="h-5 w-5" style={{ color: BRAND_COLOR }} />
                                          {msg.title}
                                      </CardTitle>
                                      <span className="text-xs text-gray-400 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-full">
                                          <CalendarClock size={12} />
                                          {format(new Date(msg.createdAt), 'dd/MM/yyyy')}
                                      </span>
                                  </div>
                                  <CardDescription className="text-xs mt-1">מאת: {msg.authorName}</CardDescription>
                              </CardHeader>
                              <CardContent>
                                  <div className="text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: msg.content }} />
                              </CardContent>
                          </Card>
                      </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
      )}

      {/* --- כפתור יצירת הזמנה --- */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <Button
            asChild
            size="lg"
            className="text-white shadow-lg transition-colors"
            style={{
                backgroundColor: BRAND_COLOR,
                boxShadow: `0 10px 15px -3px ${BRAND_COLOR}66`
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = BRAND_COLOR_HOVER}
            onMouseLeave={(e) => e.target.style.backgroundColor = BRAND_COLOR}
        >
          <Link to="/new-order">צור הזמנה חדשה</Link>
        </Button>
      </motion.div>

      {/* ✨ דיאלוג הפירוט */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2 bg-slate-50 border-b">
                <DialogTitle>פירוט תגמול חודשי</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 shadow-sm font-semibold">
                        <tr>
                            <th className="p-3 border-b">שם האורח</th>
                            <th className="p-3 border-b">תאריך הגעה</th>
                            <th className="p-3 border-b">סכום ששולם</th>
                            <th className="p-3 border-b text-purple-700">עמלה</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {reportData?.items?.map((item, i) => (
                            <tr key={i} className="hover:bg-purple-50/30 transition-colors">
                                <td className="p-3 font-medium text-slate-800">{item.guestName}</td>
                                <td className="p-3 text-slate-500">{item.arrivalDate ? format(new Date(item.arrivalDate), 'dd/MM/yy') : '-'}</td>
                                <td className="p-3 text-slate-600">{item.paidAmount?.toLocaleString()} ₪</td>
                                <td className="p-3 font-bold text-purple-700">{item.commission?.toLocaleString()} ₪</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-slate-50 border-t text-center text-xs text-gray-400">
                * הנתונים מבוססים על דוחות שאושרו ונסגרו במערכת
            </div>
        </DialogContent>
      </Dialog>

    </main>
  );
}