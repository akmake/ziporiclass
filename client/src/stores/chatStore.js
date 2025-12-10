import { create } from 'zustand';
import api from '@/utils/api.js';
import socketService from '@/utils/socketService.js';

export const useChatStore = create((set, get) => ({
  contacts: [],
  activeContactId: null,
  messages: [],
  isLoadingContacts: false,

  // --- הפעלה גלובלית (נקרא מ-App.jsx) ---
  initializeSocket: (userId) => {
    socketService.connect(userId);

    // האזנה להודעות נכנסות - עובד בכל דף באתר!
    socketService.on('receive_message', (msg) => {
        console.log("📩 New message received:", msg);
        get().handleIncomingMessage(msg);
    });

    socketService.on('message_sent_confirmation', (msg) => {
        get().handleIncomingMessage(msg);
    });
  },

  disconnectSocket: () => {
    socketService.disconnect();
  },

  // --- טעינת נתונים ---
  fetchContacts: async () => {
    set({ isLoadingContacts: true });
    try {
      const { data } = await api.get('/chat/contacts');
      set({ contacts: data, isLoadingContacts: false });
    } catch (error) {
      console.error("Error fetching contacts", error);
      set({ isLoadingContacts: false });
    }
  },

  selectContact: (contactId) => {
    set({ activeContactId: contactId });
    // איפוס מונה הודעות לוקאלי לאיש קשר שנבחר
    if (contactId) {
        set((state) => ({
          contacts: state.contacts.map(c => 
            c._id === contactId ? { ...c, unreadCount: 0 } : c
          )
        }));
    }
  },

  // --- הלב של המערכת: טיפול בהודעה ---
  handleIncomingMessage: (newMessage) => {
    const state = get();
    
    // 1. הוספה לרשימת ההודעות אם אני בשיחה הרלוונטית
    const isRelevantToActiveChat = state.activeContactId && 
       (newMessage.sender === state.activeContactId || newMessage.recipient === state.activeContactId);

    if (isRelevantToActiveChat) {
        set(prev => ({ messages: [...prev.messages, newMessage] }));
        // אם אני המקבל - סמן שקראתי
        if (newMessage.recipient !== newMessage.sender) { 
             api.put('/chat/read', { senderId: newMessage.sender }); 
        }
    } 
    
    // 2. עדכון רשימת אנשי הקשר (מונים + הקפצה למעלה)
    set((state) => {
        const updatedContacts = state.contacts.map(c => {
            if (c._id === newMessage.sender || c._id === newMessage.recipient) {
              const isChattingWithSender = state.activeContactId === newMessage.sender;
              let newCount = c.unreadCount || 0;
              
              // העלאת מונה רק אם קיבלתי הודעה ואני לא בשיחה כרגע
              if (newMessage.sender === c._id && !isChattingWithSender) {
                  newCount += 1;
              }

              return {
                ...c,
                lastMessage: { text: newMessage.text, createdAt: newMessage.createdAt },
                unreadCount: newCount
              };
            }
            return c;
        });

        // מיון: הודעות שלא נקראו למעלה, אחר כך לפי זמן
        updatedContacts.sort((a, b) => {
            if ((b.unreadCount || 0) !== (a.unreadCount || 0)) {
                return (b.unreadCount || 0) - (a.unreadCount || 0);
            }
            const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return dateB - dateA;
        });

        return { contacts: updatedContacts };
    });
  },

  setMessages: (msgs) => set({ messages: msgs }),
}));