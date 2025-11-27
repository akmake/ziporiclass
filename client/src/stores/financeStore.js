import { create } from 'zustand';
import api from '@/utils/api.js'; // שימוש במנוע התקשורת המרכזי

// ברירת מחדל למקרה שאין פרופיל למשתמש
const defaultProfile = {
  checking: 0,
  cash: 0,
  deposits: 0,
  stocks: 0,
};

export const useFinanceStore = create((set, get) => ({
  profile: null,
  loading: true,
  error: null,

  // פעולה לשליפת הפרופיל מהשרת
  fetchProfile: async () => {
    set({ loading: true, error: null });
    try {
      // הנתיב הנכון הוא /api/finances כפי שמוגדר בשרת
      const { data } = await api.get('/finances');
      set({ profile: data || defaultProfile, loading: false });
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      set({ error: errorMessage, loading: false, profile: defaultProfile });
      console.error("Failed to fetch finance profile:", err);
    }
  },

  // פעולה לעדכון הפרופיל בשרת
  updateProfile: async (newProfileData) => {
    const originalProfile = get().profile;
    // עדכון אופטימי מיידי של הממשק
    set({ profile: { ...originalProfile, ...newProfileData } });
    try {
      const { data } = await api.post('/finances', newProfileData);
      set({ profile: data }); // עדכון סופי עם המידע המדויק מהשרת
    } catch (err) {
      const errorMessage = err.response?.data?.message || "שגיאה בעדכון הפרופיל";
      set({ error: errorMessage, profile: originalProfile }); // החזרת המצב לקדמותו במקרה של שגיאה
      console.error("Failed to update finance profile:", err);
    }
  },
}));
