import { create } from 'zustand';
import api from '@/utils/api.js';

export const useChatStore = create((set, get) => ({
  contacts: [],
  activeContactId: null,
  messages: [],
  isLoadingContacts: false,

  // טעינת אנשי קשר + מונים מהשרת
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

  // בחירת איש קשר וכניסה לחדר - מאפס את המונה שלו
  selectContact: (contactId) => {
    set({ activeContactId: contactId });
    if (contactId) {
        // מאפסים את המונה של איש הקשר הזה לוקאלית
        set((state) => ({
          contacts: state.contacts.map(c => 
            c._id === contactId ? { ...c, unreadCount: 0 } : c
          )
        }));
    }
  },

  // עדכון בזמן אמת כשמגיעה הודעה (מהסוקט)
  handleIncomingMessage: (newMessage) => {
    const state = get();
    
    // 1. האם ההודעה שייכת לשיחה הפתוחה כרגע?
    const isRelevantToActiveChat = state.activeContactId && 
       (newMessage.sender === state.activeContactId || newMessage.recipient === state.activeContactId);

    if (isRelevantToActiveChat) {
        // הוסף להודעות
        set({ messages: [...state.messages, newMessage] });
        
        // אם אני המקבל ואני נמצא בשיחה - נסמן כנקרא מיד בשרת
        if (newMessage.recipient !== newMessage.sender) { 
             api.put('/chat/read', { senderId: newMessage.sender }); 
        }
    } 
    
    // 2. עדכון הסרגל צד (מונה + הודעה אחרונה + הקפצה למעלה)
    set((state) => {
        // מעדכנים את איש הקשר הרלוונטי
        const updatedContacts = state.contacts.map(c => {
            if (c._id === newMessage.sender || c._id === newMessage.recipient) {
              const isChattingWithSender = state.activeContactId === newMessage.sender;
              
              return {
                ...c,
                lastMessage: { text: newMessage.text, createdAt: newMessage.createdAt },
                // מעלים מונה רק אם: ההודעה מהצד השני + אני לא בשיחה איתו כרגע
                unreadCount: (newMessage.sender === c._id && !isChattingWithSender) 
                  ? (c.unreadCount || 0) + 1 
                  : c.unreadCount
              };
            }
            return c;
        });

        // מיון מחדש: מי שיש לו הכי הרבה הודעות שלא נקראו עולה למעלה, ואז לפי זמן
        updatedContacts.sort((a, b) => {
            if ((b.unreadCount || 0) !== (a.unreadCount || 0)) {
                return (b.unreadCount || 0) - (a.unreadCount || 0);
            }
            // אם המונים זהים, נמיין לפי תאריך ההודעה האחרונה
            const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return dateB - dateA;
        });

        return { contacts: updatedContacts };
    });
  },

  // עדכונים ידניים להודעות (למשל מחיקה או טעינה ראשונית)
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] })),
}));