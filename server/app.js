import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import http from 'http'; 
import { initSocket } from './socket.js'; 

// --- 1. טעינת הגדרות ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// טעינת משתני סביבה
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const httpServer = http.createServer(app);

// === תיקון קריטי ל-Render ===
// אומר לאקספרס לסמוך על ה-Proxy של Render (כדי לזהות HTTPS)
app.enable('trust proxy'); 

// --- 2. אבטחת כותרות ---
app.use(helmet({ 
  crossOriginResourcePolicy: false // מאפשר טעינת תמונות
}));

// --- 3. הגדרת CORS מקצועית ---
const allowedOrigins = [
  process.env.CLIENT_URL,            // הכתובת מה-ENV
  'http://localhost:5173',           // פיתוח מקומי
  'https://zipori-client.onrender.com' // הכתובת של הקליינט שלך
];

app.use(cors({
  origin: function (origin, callback) {
    // מאפשר בקשות ללא origin (כמו Postman) או אם ה-origin ברשימה
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // חובה בשביל שהקוקי יעבור!
}));

app.use(express.json({ limit: '10kb' })); 
app.use(cookieParser());
app.use(mongoSanitize());

// --- 4. חיבור למסד הנתונים ---
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✔ Mongo connected successfully');
  } catch (err) {
    console.error('❌ Mongo connection error:', err.message);
  }
};
connectDB();

// --- 5. ייבוא נתיבים ---
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
import { initWhatsAppListener } from './services/whatsappService.js';

// הגדרת תיקיית העלאות
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// --- 6. הגדרת הנתיבים (Routes) ---
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
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

// --- 7. הגשה ב-Production (React) ---
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// כל בקשה שלא טופלה ע"י ה-API מופנית ל-React
app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found.' });
  }
  const indexHtmlPath = path.resolve(clientBuildPath, 'index.html');
  res.sendFile(indexHtmlPath, (err) => {
    if (err && !res.headersSent) {
         res.status(500).send(`Error serving index.html: ${err.message}.`);
    }
  });
});

// --- 8. הפעלת שירותים ---
initWhatsAppListener();
initSocket(httpServer);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`✔ Server running on port ${PORT}`));

export default app;