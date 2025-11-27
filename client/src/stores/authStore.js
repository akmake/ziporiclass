// client/src/stores/authStore.js

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
// Import the injector function from api.js. Using a relative path for safety.
import { injectAuthStore } from '../utils/api';

const getInitialState = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return { user, isAuthenticated: !!user };
  } catch (error) {
    return { user: null, isAuthenticated: false };
  }
};

export const useAuthStore = create(
  devtools(
    (set) => ({
      ...getInitialState(),

      login: (userData) => {
        if (!userData || !userData._id) {
          console.error("Login action called with invalid user data:", userData);
          return;
        }
        localStorage.setItem('user', JSON.stringify(userData));
        set({ user: userData, isAuthenticated: true }, false, 'LOGIN_ACTION');
      },

      logout: () => {
        localStorage.removeItem('user');
        set({ user: null, isAuthenticated: false }, false, 'LOGOUT_ACTION');
      },
    }),
    { name: "Auth Store" }
  )
);

// --- THIS IS THE FIX ---
// After the store is created, we inject its API into the api.js module.
// This breaks the circular dependency.
injectAuthStore(useAuthStore.getState());

// We also subscribe to future changes, although it's less critical for login/logout
// which don't change at runtime.
useAuthStore.subscribe(state => {
  injectAuthStore(state);
});