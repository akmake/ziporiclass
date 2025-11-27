import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from "@/utils/api";
import { useAuthStore } from "@/stores/authStore.js";
import { Button } from '@/components/ui/Button.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, LoaderCircle, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const loginAction = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/csrf-token').catch((err) => {
      console.error("Failed to fetch CSRF token", err);
      setError("שגיאת אבטחה. רענן את הדף ונסה שוב.");
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });

      if (data && data.user) {
        loginAction(data.user);
        navigate('/');
      } else {
        throw new Error("תגובת השרת אינה מכילה פרטי משתמש.");
      }

    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה לא צפויה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 space-y-6"
      >
        <motion.div variants={itemVariants} className="text-center">
          <Link to="/" className="text-3xl font-bold text-amber-700 inline-block mb-2">ניהול הזמנות</Link>
          <h1 className="text-2xl font-bold text-gray-900">ברוכים הבאים</h1>
          <p className="text-gray-600">התחבר לחשבון שלך כדי להמשיך</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div variants={itemVariants}>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">כתובת אימייל</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3"><Mail className="h-5 w-5 text-gray-400" /></span>
              <input id="email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition"/>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3"><Lock className="h-5 w-5 text-gray-400" /></span>
              <input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition"/>
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3" aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}>
                {showPassword ? <EyeOff className="h-5 w-5 text-gray-500 hover:text-gray-800" /> : <Eye className="h-5 w-5 text-gray-500 hover:text-gray-800" />}
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2 overflow-hidden"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0"/>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={itemVariants}>
            <Button type="submit" className="w-full flex justify-center items-center gap-2" disabled={loading}>
              {loading && <LoaderCircle className="animate-spin h-5 w-5" />}
              {loading ? 'מתחבר...' : 'התחברות'}
            </Button>
          </motion.div>
        </form>

        {/* ✨ הקישור להרשמה הוסר מכאן */}
        <motion.div variants={itemVariants} className="text-sm text-center text-gray-600">
            <p>מערכת זו מיועדת למשתמשים מורשים בלבד.</p>
        </motion.div>
      </motion.div>
    </div>
  );
}