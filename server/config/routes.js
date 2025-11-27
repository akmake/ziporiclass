import csurf              from 'csurf';
import authRoutes         from '../routes/auth.js';
import tzitzitRoutes      from '../routes/tzitzitRoutes.js';

/* חדש */
import projectRoutes      from '../routes/projectRoutes.js';

import { requireAuth }    from '../middlewares/authMiddleware.js';

export const configureRoutes = (app) => {
  /* ---------- מסלולים ציבוריים ---------- */
  app.use('/api/auth', authRoutes);

  /* ---------- הגנת CSRF ---------- */
  const csrfProtection = csurf({
    cookie: {
      httpOnly : true,
      secure   : process.env.NODE_ENV === 'production',
      sameSite : 'strict',
    },
  });

  // נקודת קבלת טוקן
  app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // להחיל CSRF על כל מה שמתחת
  app.use(csrfProtection);

  /* ---------- מסלולים מוגנים ---------- */
  app.use('/api/tzitzit',  requireAuth, tzitzitRoutes);

  /* ---------- מסלול מוגן חדש: פרויקטים כספיים ---------- */
  app.use('/api/projects', requireAuth, projectRoutes);
};