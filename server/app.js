import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import csurf from 'csurf';

// ⬇️ --- ייבואים קריטיים להגשת האפליקציה --- ⬇️
import path from 'path';
import { fileURLToPath } from 'url';
// ⬆️ ------------------------------------- ⬆️

// --- ייבוא נתיבים ---
import authRoutes from './routes/auth.js';
import priceListRoutes from './routes/priceListRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminOrderRoutes from './routes/adminOrders.js';
import adminUserRoutes from './routes/adminUsers.js';
import adminProductRoutes from './routes/adminProducts.js';
import adminHotelRoutes from './routes/adminHotels.js';
import webhookRoutes from './routes/webhookRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import adminDashboardRoutes from './routes/adminDashboard.js';
import adminRoomTypeRoutes from './routes/adminRoomTypes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import adminExtraTypesRoutes from './routes/adminExtraTypes.js';
import uploadRoutes from './routes/uploadRoutes.js'; // <--- הוסף את זה למעלה
import referrerRoutes from './routes/referrerRoutes.js';// --- ייבוא מידלוורים ---
import rateLimiter from './middlewares/rateLimiter.js';
import roomRoutes from './routes/roomRoutes.js'; // <--- הוסף את זה למעלה
// --- חיבור למסד הנתונים ---
try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✔ Mongo connected');
} catch (err) {
  console.error('Mongo connection error:', err);
  process.exit(1);
}

const app = express();

// ⬇️ --- הגדרות נתיבים (Path) --- ⬇️
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ⬆️ --------------------------- ⬆️

// --- מידלוורים כלליים ---
app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'https://localhost:5173',
  "https://zipori-client.onrender.com"
];

const filteredOrigins = allowedOrigins.filter(Boolean);

app.use(cors({
  origin: filteredOrigins,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(mongoSanitize());

// ⬇️ --- הגשת תיקיית 'uploads' (כדי שלוגואים יעבדו) --- ⬇️
// ודא שתיקייה זו קיימת בשרת שלך במיקום 'server/uploads'
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));
// ⬆️ ------------------------------------------------ ⬆️

// --- הגדרת פונקציית הגנת CSRF ---
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'None'
  },
});

// =================================================================
// --- הגדרת נתיבי API ---
// =================================================================

// 1. נתיבים ציבוריים (ללא CSRF)
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);

// 2. נתיב קבלת טוקן CSRF (עם CSRF)
app.get('/api/csrf-token', rateLimiter, csrfProtection, (req, res) => {
  const token = req.csrfToken();
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    sameSite: 'None',
    secure: true
  });
  res.json({ csrfToken: token });
});

// 3. הפעלת הגנת CSRF באופן מותנה על כל שאר הנתיבים
app.use('/api', (req, res, next) => {
  if (
    req.path.startsWith('/auth') ||
    req.path.startsWith('/webhooks') ||
    req.path === '/csrf-token'
  ) {
    return next();
  }
  csrfProtection(req, res, next);
});

// 4. נתיבים מוגנים
app.use('/api/pricelists', priceListRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/hotels', adminHotelRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/room-types', adminRoomTypeRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/upload', uploadRoutes); // <--- הוסף את זה
app.use('/api/admin/extras', adminExtraTypesRoutes);
app.use('/api/rooms', roomRoutes); // <--- הוסף את זה (לפני או אחרי orders)
app.use('/api/referrers', referrerRoutes);
// 5. הגשת קבצי ה-Build של הקליינט (React App)
//    זה מחפש את תיקיית 'dist' שנבנתה
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// 6. נתיב "תפוס הכל" (Catch-all)
//    מגיש את האפליקציה של ריאקט עבור כל נתיב שאינו API
//    זה מה שמתקן את ה-404 ב- /quote/:orderId
app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found.' });
  }

  const indexHtmlPath = path.resolve(clientBuildPath, 'index.html');

  // הגש את האפליקציה הראשית
  res.sendFile(indexHtmlPath, (err) => {
    if (err) {
      // אם הקובץ לא קיים (כמו שקורה ב-dev או ב-build שגוי), שלח הודעת שגיאה ברורה
      res.status(500).send(`Error serving index.html: ${err.message}. 'client/dist' folder not found. Did you run 'npm run build' in the client directory?`);
    }
  });
});

// ⬆️ === סוף התיקון === ⬆️

// --- הפעלת השרת ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✔ Server is booming on port ${PORT}`));

export default app;