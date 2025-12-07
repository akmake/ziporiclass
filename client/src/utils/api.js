import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';
console.log(`Connecting to API at: ${API_URL}`);

let authStoreApi = {
  login: () => console.error('Auth store not initialized for API utility.'),
  logout: () => console.error('Auth store not initialized for API utility.'),
};

export function injectAuthStore(store) {
  authStoreApi = store;
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let csrfTokenPromise = null;

const getCsrfToken = () => {
  if (!csrfTokenPromise) {
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

    // ✨✨✨ טיפול בשגיאת 401 (לא מורשה / שעות פעילות הסתיימו) ✨✨✨
    if (error.response?.status === 401 && originalRequest.url !== '/auth/login') {
      
      // אם זה ניסיון לרענון שנכשל, או שהשרת אמר מפורשות שהזמן עבר
      if (originalRequest._retry || error.response.data?.message?.includes('שעות הפעילות')) {
          authStoreApi.logout();
          window.location.href = '/login'; // זריקה חזקה לדף ההתחברות
          return Promise.reject(error);
      }

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
        window.location.href = '/login'; // זריקה לדף ההתחברות במקרה של כישלון
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;