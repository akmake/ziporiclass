import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import csurf from 'csurf';
import http from 'http';
import { initSocket } from './socket.js';
import { initWhatsAppListener } from './services/whatsappService.js'; // ✨ הוחזר: ייבוא שירות הוואטסאפ

import path from 'path';
import { fileURLToPath } from 'url';

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
import uploadRoutes from './routes/uploadRoutes.js';
import referrerRoutes from './routes/referrerRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import pushRoutes from './routes/pushRoutes.js';
import adminAuditRoutes from './routes/adminAudit.js';
import adminCommissionRoutes from './routes/adminCommissions.js';
import bookingRoutes from './routes/bookingRoutes.js';
import userRoutes from './routes/userRoutes.js';
import chatRoutes from './routes/chatRoutes.js';

// --- חיבור למסד הנתונים ---
try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✔ Mongo connected');
} catch (err) {
  console.error('Mongo connection error:', err);
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
const httpServer = http.createServer(app);
initSocket(httpServer);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- אבטחה ו-Middlewares בסיסיים ---
app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'https://localhost:5173',
  "https://zipori-client.onrender.com",
  'https://www.ziporiteem.com', // ✅ גם עם www ליתר ביטחון
];

const filteredOrigins = allowedOrigins.filter(Boolean);

app.use(cors({
  origin: filteredOrigins,
  credentials: true
}));

app.use(express.json({ limit: '10kb' })); // הוספתי מגבלת גודל למניעת הצפה
app.use(cookieParser());
app.use(mongoSanitize());

// הגדרת תיקיית העלאות כסטטית
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// --- הגדרת CSRF ---
// שים לב: secure: true מחייב HTTPS. אם אתה עובד לוקאלית (http), הדפדפן עלול לחסום את הקוקי.
// ב-Production (Render) זה יעבוד מצוין אם יש להם תעודת SSL.
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: true, // שנה ל-false אם אתה בודק לוקאלית בלי HTTPS
    sameSite: 'None'
  },
});

// --- חיבור נתיבים ציבוריים (ללא CSRF) ---
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);

// --- נקודת קצה לקבלת הטוקן לקליינט ---
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  const token = req.csrfToken();
  // שליחת הטוקן גם בקוקי נגיש לקריאה (לפעמים עוזר לאקסיוס) וגם ב-JSON
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // חייב להיות false כדי שהקליינט יוכל לקרוא אותו אם צריך
    sameSite: 'None',
    secure: true
  });
  res.json({ csrfToken: token });
});

// --- החלת CSRF על כל שאר נתיבי ה-API ---
app.use('/api', (req, res, next) => {
  // החרגה נוספת ליתר ביטחון (למרות שהגדרנו למעלה)
  if (
    req.path.startsWith('/auth') ||
    req.path.startsWith('/webhooks') ||
    req.path === '/csrf-token'
  ) {
    return next();
  }
  csrfProtection(req, res, next);
});

// --- חיבור נתיבי API מוגנים ---
app.use('/api/users', userRoutes);
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
app.use('/api/upload', uploadRoutes);
app.use('/api/admin/extras', adminExtraTypesRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/referrers', referrerRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/admin/audit', adminAuditRoutes);
app.use('/api/admin/commissions', adminCommissionRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);

// --- הגשת קבצי הקליינט (React) ---
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

app.use('*', (req, res) => {
  // אם זו בקשת API שלא נמצאה - נחזיר 404 ולא את ה-HTML
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found.' });
  }

  const indexHtmlPath = path.resolve(clientBuildPath, 'index.html');

  res.sendFile(indexHtmlPath, (err) => {
    if (err) {
      if (!res.headersSent) {
          res.status(500).send(`Error serving index.html: ${err.message}.`);
      }
    }
  });
});

// --- הפעלת שירותים נוספים ---
initWhatsAppListener(); // ✨ הוחזר: הפעלת הבוט

// --- הרמת השרת ---
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`✔ Server & Socket running on port ${PORT}`));

export default app;