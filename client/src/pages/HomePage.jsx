// client/src/pages/HomePage.jsx

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card.jsx';
import api from '@/utils/api.js';
import { Megaphone, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore.js'; // ✨ 1. ייבוא ה-Store

// חישוב כתובת השרת לטובת הלוגו
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const SERVER_ROOT = API_BASE.replace(/\/api$/, '');
const LOGO_URL = `${SERVER_ROOT}/uploads/company-logo.png?t=${Date.now()}`;

// הגדרת צבעי המיתוג החדשים
const BRAND_COLOR = '#bfa15f';
const BRAND_COLOR_HOVER = '#a28e4d'; // גוון מעט כהה יותר ל-Hover

const fetchMyAnnouncements = async () => {
  try {
    const { data } = await api.get('/announcements');
    return data;
  } catch (error) {
    console.error("Failed to fetch announcements", error);
    return [];
  }
};

export default function HomePage() {
  // ✨ 2. בדיקה האם המשתמש מחובר
  const { isAuthenticated } = useAuthStore();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['myAnnouncements'],
    queryFn: fetchMyAnnouncements,
    staleTime: 1000 * 60 * 5, // לרענן כל 5 דקות
    enabled: isAuthenticated // ✨ 3. שולף נתונים רק אם המשתמש מחובר
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
    </main>
  );
}