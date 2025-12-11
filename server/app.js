import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// --- 1. טעינת משתני סביבה (חייב להיות ראשון!) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// טעינה מפורשת של קובץ .env מהתיקייה הנוכחית
dotenv.config({ path: path.join(__dirname, '.env') });

// בדיקה בטרמינל שהכתובת נטענה (לצורך דיבוג)
console.log('🔍 Mongo URI Status:', process.env.MONGO_URI ? '✅ Loaded' : '❌ MISSING');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import csurf from 'csurf';
import http from 'http'; 
import { initSocket } from './socket.js'; 

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
import { initWhatsAppListener } from './services/whatsappService.js'; // הבוט שלך

// --- 2. חיבור למסד הנתונים ---
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing in .env file');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✔ Mongo connected successfully');
  } catch (err) {
    console.error('❌ Mongo connection error:', err.message);
    // לא עוצרים את השרת כדי שתוכל לראות את השגיאה, אבל ה-DB לא יעבוד
  }
};
connectDB();

const app = express();
// יצירת שרת HTTP
const httpServer = http.createServer(app);
// הפעלת Socket.io
initSocket(httpServer);

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

// הגדרת תיקיית העלאות
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// הגנת CSRF
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true רק בפרודקשן
    sameSite: 'None'
  },
});

// נתיבים שלא דורשים CSRF (כמו וובהוקים)
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);

// קבלת טוקן CSRF
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  const token = req.csrfToken();
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    sameSite: 'None',
    secure: true
  });
  res.json({ csrfToken: token });
});

// החלת CSRF על שאר ה-API
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

// --- חיבור כל הראוטים ---
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

// הגשת קבצי הקליינט (React)
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

app.use('*', (req, res) => {
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

// --- 3. הפעלת הבוט ---
initWhatsAppListener();

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`✔ Server & Socket running on port ${PORT}`));

export default app;