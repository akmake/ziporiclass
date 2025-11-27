// src/stores/authStore.js

import { create } from 'zustand';

// פונקציה שקוראת את פרטי המשתמש מהאחסון המקומי של הדפדפן
const getInitialState = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return {
      user: user,
      isAuthenticated: !!user, // הופך את התוצאה ל-true אם יש משתמש, ו-false אם אין
    };
  } catch (error) {
    return { user: null, isAuthenticated: false };
  }
};

export const useAuthStore = create((set) => ({
  ...getInitialState(), // קובע את המצב ההתחלתי כשהאפליקציה נטענת

  // פעולה שקוראים לה אחרי התחברות מוצלחת
  login: (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    set({ user: userData, isAuthenticated: true });
  },

  // פעולה שקוראים לה בעת התנתקות
  logout: () => {
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },
}));