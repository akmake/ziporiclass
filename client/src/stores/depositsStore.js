// client/src/stores/depositsStore.js

import { create } from 'zustand';
import api from '../utils/api';
import toast from 'react-hot-toast';

export const useDepositsStore = create((set, get) => ({
  deposits: [],
  loading: false,
  error: null,

  // פעולה לטעינת כל הפיקדונות מהשרת
  fetchDeposits: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/deposits');
      set({ deposits: data || [], loading: false });
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'שגיאה בטעינת הפיקדונות';
      set({ error: errorMsg, loading: false });
      toast.error(errorMsg);
    }
  },

  // פעולה להוספת פיקדון חדש
  addDeposit: async (depositData) => {
    try {
      await api.post('/deposits', depositData);
      toast.success('הפיקדון נוסף בהצלחה!');
      get().fetchDeposits(); // רענון הרשימה המלאה מהשרת
      return true; // להודיע לטופס שהפעולה הצליחה
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בהוספת הפיקדון');
      return false; // להודיע לטופס שהפעולה נכשלה
    }
  },

  // ===>> הוספת הפונקציות החסרות <<===

  // פעולה לשבירת פיקדון
  breakDeposit: async (depositId) => {
    try {
      const { data } = await api.post(`/deposits/${depositId}/break`);
      toast.success(data.message || 'הפיקדון נשבר בהצלחה!');
      get().fetchDeposits(); // רענון הרשימה
    } catch (err) {
       toast.error(err.response?.data?.message || 'שגיאה בשבירת הפיקדון');
    }
  },
  
  // פעולה למשיכת פיקדון
  withdrawDeposit: async (depositId) => {
     try {
      const { data } = await api.post(`/deposits/${depositId}/withdraw`);
      toast.success(data.message || 'הפיקדון נפרע ונמשך בהצלחה!');
      get().fetchDeposits(); // רענון הרשימה
    } catch (err) {
       toast.error(err.response?.data?.message || 'שגיאה במשיכת הפיקדון');
    }
  }
}));