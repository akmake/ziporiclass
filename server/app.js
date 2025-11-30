import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import csurf from 'csurf';

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
import pushRoutes from './routes/pushRoutes.js'; // ✨ ייבוא החדש

try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✔ Mongo connected');
} catch (err) {
  console.error('Mongo connection error:', err);
  process.exit(1);
}

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'None'
  },
});

app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  const token = req.csrfToken();
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    sameSite: 'None',
    secure: true
  });
  res.json({ csrfToken: token });
});

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

// --- חיבור נתיבי API ---
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
app.use('/api/push', pushRoutes); // ✨ הפעלת הנתיב החדש

const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found.' });
  }

  const indexHtmlPath = path.resolve(clientBuildPath, 'index.html');

  res.sendFile(indexHtmlPath, (err) => {
    if (err) {
      res.status(500).send(`Error serving index.html: ${err.message}.`);
    }
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✔ Server is booming on port ${PORT}`));

export default app;