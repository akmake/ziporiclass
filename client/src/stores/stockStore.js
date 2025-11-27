// client/src/stores/stockStore.js

import { create } from 'zustand';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';

export const useStockStore = create((set, get) => ({
  stocks: [],
  loading: false,
  error: null,

  // Helper functions to manage state
  _startLoading: () => set({ loading: true, error: null }),
  _setError: (error) => set({ loading: false, error }),

  // Actions
  fetchStocks: async () => {
    get()._startLoading();
    try {
      const { data } = await api.get('/stocks');
      set({ stocks: data, loading: false });
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'שגיאה בטעינת המניות';
      get()._setError(errorMsg);
      toast.error(errorMsg);
    }
  },

  addStock: async (stockData) => {
    get()._startLoading();
    try {
      const { data: newStock } = await api.post('/stocks', stockData);
      set((state) => ({ stocks: [newStock, ...state.stocks], loading: false }));
      toast.success(`מניית ${newStock.ticker} נוספה בהצלחה!`);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'שגיאה בהוספת מניה';
      get()._setError(errorMsg);
      toast.error(errorMsg);
    }
  },

  deleteStock: async (stockId) => {
    const originalStocks = get().stocks;
    // Optimistic update
    set((state) => ({
      stocks: state.stocks.filter((s) => s._id !== stockId),
    }));
    try {
      await api.delete(`/stocks/${stockId}`);
      toast.success('המניה נמחקה.');
    } catch (err) {
      toast.error('שגיאה במחיקת המניה.');
      set({ stocks: originalStocks }); // Revert on error
    }
  },
  
  sellStock: async (stockId) => {
    try {
      const { data } = await api.post(`/stocks/${stockId}/sell`);
      toast.success(data.message);
      get().fetchStocks(); // Refetch all stocks and potentially account balances
    } catch(err) {
      const errorMsg = err.response?.data?.message || 'שגיאה במכירת המניה';
      toast.error(errorMsg);
    }
  },

  refreshPrices: async () => {
    try {
      const { data } = await api.post('/stocks/refresh-prices');
      set({ stocks: data.stocks });
      toast.success(data.message);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'שגיאה בעדכון מחירים';
      toast.error(errorMsg);
    }
  },
}));