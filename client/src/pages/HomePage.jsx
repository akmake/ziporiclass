// client/src/pages/HomePage.jsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/Card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog"; // ✨ Dialog
import api from '@/utils/api.js';
import { Megaphone, CalendarClock, Wallet, FileSpreadsheet } from 'lucide-react'; // ✨ Icons
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore.js';

// חישוב כתובת השרת לטובת הלוגו
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const SERVER_ROOT = API_BASE.replace(/\/api$/, '');
const LOGO_URL = `${SERVER_ROOT}/uploads/company-logo.png?t=${Date.now()}`;

// הגדרת צבעי המיתוג החדשים
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

// ✨ פונקציה חדשה לשליפת עמלות
const fetchMyCommission = async () => {
  try {
    const { data } = await api.get('/admin/commissions/my-latest');
    return data;
  } catch (error) {
    console.error("Failed to fetch commission", error);
    return null;
  }
};

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const [showCommissionDetails, setShowCommissionDetails] = useState(false);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['myAnnouncements'],
    queryFn: fetchMyAnnouncements,
    staleTime: 1000 * 60 * 5,
    enabled: isAuthenticated
  });

  // ✨ שליפת עמלה אחרונה - רק אם מחובר ויש הרשאה
  const { data: commissionData } = useQuery({
    queryKey: ['myLatestCommission'],
    queryFn: fetchMyCommission,
    enabled: isAuthenticated && (user?.role === 'sales' || user?.canViewCommissions),
    staleTime: 1000 * 60 * 10 // לשמור בזיכרון ל-10 דקות
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

      {/* ✨✨✨ כרטיסיית עמלה אחרונה (מופיעה מעל ההודעות) ✨✨✨ */}
      {isAuthenticated && commissionData?.found && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-2xl mb-8"
        >
          <Card className="border-t-4 border-t-purple-600 shadow-md bg-white overflow-hidden text-right">
            <CardHeader className="bg-purple-50/50 pb-3 border-b border-purple-100">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-purple-900 text-lg">
                  <Wallet className="h-5 w-5" /> עדכון עמלות אחרון
                </CardTitle>
                <span className="text-xs text-purple-700 bg-white px-2 py-1 rounded-full border border-purple-200 font-medium">
                  נכון לתאריך: {format(new Date(commissionData.reportDate), 'dd/MM/yyyy')}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-2">
              <div className="flex justify-around items-center text-center">
                <div>
                  <p className="text-sm text-gray-500 mb-1">מספר עסקאות</p>
                  <p className="text-2xl font-bold text-gray-800">{commissionData.itemsCount}</p>
                </div>
                <div className="border-l h-12 border-gray-200"></div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">סה"כ לתשלום</p>
                  <p className="text-4xl font-extrabold text-purple-700">
                    {commissionData.totalCommission.toLocaleString()} ₪
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 p-3 justify-center border-t border-gray-100 mt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-purple-700 hover:text-purple-900 hover:bg-purple-100 w-full gap-2 transition-colors"
                onClick={() => setShowCommissionDetails(true)}
              >
                <FileSpreadsheet size={16}/> לחץ לפירוט מלא
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      )}

      {/* --- אזור ההודעות (מוצג רק למחוברים) --- */}
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
                          <Card
                            className="bg-white shadow-sm hover:shadow-md transition-all border-l-4"
                            style={{ borderLeftColor: BRAND_COLOR }}
                          >
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
                                  <div
                                     className="text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none"
                                     dangerouslySetInnerHTML={{ __html: msg.content }}
                                 />
                              </CardContent>
                          </Card>
                      </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
      )}

      {/* --- טקסט וכפתור --- */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="text-lg sm:text-xl text-gray-600 max-w-2xl mb-10"
      >
        כל הכלים לניהול הצעות מחיר, מעקב אחר הזמנות וחישוב עמלות במקום אחד.
        <br />
        פשוט, מהיר ויעיל.
      </motion.p>

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

      {/* ✨ דיאלוג פירוט עמלות (המופיע בלחיצה) */}
      <Dialog open={showCommissionDetails} onOpenChange={setShowCommissionDetails}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 bg-slate-50 border-b">
            <DialogTitle>פירוט תגמול לדוח הנוכחי</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 shadow-sm font-semibold">
                <tr>
                  <th className="p-3 border-b w-1/4">שם האורח</th>
                  <th className="p-3 border-b text-center">תאריך הגעה</th>
                  <th className="p-3 border-b">סכום עסקה</th>
                  <th className="p-3 border-b text-purple-700">עמלה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissionData?.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                    <td className="p-3 font-medium text-slate-800">{item.guestName}</td>
                    <td className="p-3 text-slate-500 text-center">
                      {item.arrivalDate ? format(new Date(item.arrivalDate), 'dd/MM/yy') : '-'}
                    </td>
                    <td className="p-3 text-slate-600">{item.paidAmount?.toLocaleString()} ₪</td>
                    <td className="p-3 font-bold text-purple-700">{item.commission?.toLocaleString()} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-sm font-medium">
            <div className="text-gray-500">* הנתונים מבוססים על דוחות שאושרו ונסגרו</div>
            <div className="flex gap-4">
                <span>סה"כ מכירות: <span className="text-slate-800">{commissionData?.totalSales?.toLocaleString()} ₪</span></span>
                <span className="text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded">סה"כ לתשלום: {commissionData?.totalCommission?.toLocaleString()} ₪</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </main>
  );
}