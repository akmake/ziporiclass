import { create } from "zustand";
import api from "@/utils/api"; // Now it's safe to import directly

export const useTzitzitStore = create((set) => ({
  orders: [],
  loading: false,
  error: null,

  fetchOrders: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get("/tzitzit");
      set({ orders: data, loading: false });
    } catch (err) {
      const errorMsg = err.response?.data?.message || "שגיאה בטעינת הנתונים";
      set({ error: errorMsg, loading: false });
    }
  },

  addOrder: async (orderData) => {
    // This function now returns the new order on success
    // or throws an error on failure.
    try {
      const { data: newOrder } = await api.post("/tzitzit", orderData);
      set((state) => ({
        orders: [newOrder, ...state.orders],
      }));
      return newOrder;
    } catch (err) {
      console.error("Failed to add order:", err);
      throw err;
    }
  },

  payOrder: async (id, amount) => {
    try {
      const { data: updatedOrder } = await api.patch(`/tzitzit/${id}/pay`, { amount });
      set((state) => ({
        orders: state.orders.map((o) => (o._id === id ? updatedOrder : o)),
      }));
      return updatedOrder;
    } catch (err) {
      console.error("Failed to pay order:", err);
      throw err;
    }
  },
}));
