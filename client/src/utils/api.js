import axios from 'axios';

// --- ✨ זהו החלק החשוב ✨ ---
// 1. קבע את כתובת ה-API המלאה מתוך משתנה הסביבה
//    אם המשתנה הוא '.../api', אז API_URL יהיה '.../api'
//    אם המשתנה לא קיים (למשל ב-build), ה-URL יהיה '/api'
const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 2. הדפס ל-console כדי לוודא שזה עובד
console.log(`Connecting to API at: ${API_URL}`);
// ----------------------

let authStoreApi = {
  login: () => console.error('Auth store not initialized for API utility.'),
  logout: () => console.error('Auth store not initialized for API utility.'),
};

export function injectAuthStore(store) {
  authStoreApi = store;
}

const api = axios.create({
  // 3. השתמש בכתובת המלאה (שכבר כוללת /api)
  baseURL: API_URL, 
  withCredentials: true,
});

let csrfTokenPromise = null;

const getCsrfToken = () => {
  if (!csrfTokenPromise) {
    // הקריאה הזו תוסיף '/csrf-token' ל-baseURL
    // וייצר: https://zipori.onrender.com/api/csrf-token
    csrfTokenPromise = api.get('/csrf-token')
      .then(response => {
        const csrfToken = response.data.csrfToken;
        api.defaults.headers.common['X-CSRF-Token'] = csrfToken;
        return csrfToken;
      })
      .catch(error => {
        console.error('Could not get CSRF token', error);
        csrfTokenPromise = null;
        return Promise.reject(error);
      });
  }
  return csrfTokenPromise;
};

api.interceptors.request.use(async (config) => {
  if (config.url === '/csrf-token') {
    return config;
  }
  if (!api.defaults.headers.common['X-CSRF-Token']) {
    await getCsrfToken();
  }
  return config;
}, (error) => Promise.reject(error));

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config;

    // ----------------------------------------------------------------
    // 🎯 התיקון נמצא כאן 🎯
    // הוספנו תנאי שמוודא שהבקשה שנכשלה היא *לא* בקשת הלוגין.
    // אם בקשת הלוגין נכשלת עם 401, זה אומר שהסיסמה שגויה,
    // ואנחנו לא רוצים לנסות "לרענן" טוקן במצב כזה.
    // ----------------------------------------------------------------
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/login' // <-- 🎯 זו השורה שהוספנו
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        authStoreApi.login(data.user);
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        authStoreApi.logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;