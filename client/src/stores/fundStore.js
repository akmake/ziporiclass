import { create } from 'zustand';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';

export const useFundStore = create((set, get) => ({
  funds: [],
  loading: false,
  error: null,

  fetchFunds: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/funds');
      set({ funds: data, loading: false });
    } catch (err) {
      toast.error('שגיאה בטעינת הקרנות');
      set({ error: err.message, loading: false });
    }
  },

  addFund: async (fundData) => {
    try {
      const { data: newFund } = await api.post('/funds', fundData);
      set((state) => ({ funds: [newFund, ...state.funds] }));
      toast.success('הקרן נוספה בהצלחה!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בהוספת הקרן');
    }
  },

  refreshPrices: async () => {
    const originalFunds = get().funds;
    set({ loading: true });
    toast.loading('מרענן מחירים...');
    try {
      const { data } = await api.post('/funds/refresh');
      set({ funds: data, loading: false });
      toast.dismiss();
      toast.success('המחירים עודכנו!');
    } catch (err) {
      toast.dismiss();
      toast.error('שגיאה ברענון המחירים');
      set({ funds: originalFunds, loading: false });
    }
  },
  
  sellFund: async (fundId) => {
     // ... לוגיקה דומה עם קריאת API ל-POST /api/funds/:id/sell
  },

  deleteFund: async (fundId) => {
    // ... לוגיקה דומה עם קריאת API ל-DELETE /api/funds/:id
  }
}));