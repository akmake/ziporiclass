// client/src/stores/accountStore.js

import { create } from 'zustand';
// The import path has been changed to a relative path to avoid alias issues.
import api from '../utils/api';

export const useAccountStore = create((set) => ({
  accounts: [],
  loading: false,
  error: null,

  /**
   * Fetches accounts from the correct endpoint.
   * FIX: This now points to the correct API endpoint (`/dashboard/summary`)
   * and correctly extracts the `accounts` array from the response.
   */
  fetchAccounts: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/dashboard/summary');
      // Ensure we set an array, even if data.accounts is missing.
      set({ accounts: data?.accounts || [], loading: false });
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'שגיאה בטעינת החשבונות';
      set({ error: errorMsg, loading: false, accounts: [] });
      console.error("Failed to fetch accounts:", errorMsg);
    }
  },
}));
