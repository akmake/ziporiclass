import { create } from 'zustand';
import api from '@/utils/api.js';
import socketService from '@/utils/socketService.js';

// פונקציית עזר לצליל
const playNotificationSound = () => {
    try {
        const audio = new Audio('/notification.mp3'); // וודא שיש קובץ כזה ב-public
        audio.play().catch(e => console.warn("Audio blocked:", e));
    } catch (e) {
        console.error("Sound error", e);
    }
};

export const useChatStore = create((set, get) => ({
  contacts: [],
  activeContactId: null,
  messages: [],
  isLoadingContacts: false,
  
  // מי מקליד לי כרגע? (מילון: { userId: true/false })
  typingUsers: {}, 

  // --- חיבור והאזנה ---
  initializeSocket: (userId) => {
    socketService.connect(userId);

    // 1. קבלת הודעה
    socketService.on('receive_message', (msg) => {
        get().handleIncomingMessage(msg);
    });

    // 2. אישור שליחה
    socketService.on('message_sent_confirmation', (msg) => {
        get().handleIncomingMessage(msg);
    });

    // 3. מישהו מקליד לי...
    socketService.on('user_typing', ({ senderId }) => {
        set(state => ({
            typingUsers: { ...state.typingUsers, [senderId]: true }
        }));
    });

    // 4. מישהו הפסיק להקליד...
    socketService.on('user_stopped_typing', ({ senderId }) => {
        set(state => ({
            typingUsers: { ...state.typingUsers, [senderId]: false }
        }));
    });

    // 5. מישהו קרא את ההודעה שלי (V כחול)
    socketService.on('messages_read_update', ({ byUserId }) => {
        const state = get();
        // אם אני מסתכל על השיחה איתו, נעדכן את ה-V בזמן אמת
        if (state.activeContactId === byUserId) {
            set(prev => ({
                messages: prev.messages.map(m => 
                    (m.recipient === byUserId && !m.isRead) ? { ...m, isRead: true } : m
                )
            }));
        }
    });
  },

  disconnectSocket: () => {
    socketService.disconnect();
  },

  // --- ניהול נתונים ---
  fetchContacts: async () => {
    set({ isLoadingContacts: true });
    try {
      const { data } = await api.get('/chat/contacts');
      set({ contacts: data, isLoadingContacts: false });
    } catch (error) {
      console.error(error);
      set({ isLoadingContacts: false });
    }
  },

  selectContact: (contactId) => {
    set({ activeContactId: contactId });
    
    if (contactId) {
        // 1. מאפסים מונה לוקאלי
        set((state) => ({
          contacts: state.contacts.map(c => 
            c._id === contactId ? { ...c, unreadCount: 0 } : c
          )
        }));
        
        // 2. שולחים לשרת שקראנו הכל (ב-Socket המהיר)
        socketService.emit('mark_as_read_realtime', { senderId: contactId });
    }
  },

  // --- שליחת סטטוס הקלדה ---
  emitTyping: (recipientId, isTyping) => {
      if (isTyping) {
          socketService.emit('typing_start', recipientId);
      } else {
          socketService.emit('typing_stop', recipientId);
      }
  },

  // --- טיפול חכם בהודעה נכנסת ---
  handleIncomingMessage: (newMessage) => {
    const state = get();
    const myId = socketService.socket?.userId; // הנחה שאנחנו יודעים מי אני

    // בדיקה: האם אני נמצא כרגע בתוך השיחה הרלוונטית?
    // השיחה רלוונטית אם השולח הוא מי שאני מדבר איתו, או שאני השולח (הודעה שלי)
    const isChatActive = state.activeContactId && 
       (newMessage.sender === state.activeContactId || newMessage.recipient === state.activeContactId);

    // 1. עדכון חלון ההודעות (אם פתוח)
    if (isChatActive) {
        set(prev => ({ messages: [...prev.messages, newMessage] }));
        
        // לוגיקת "קראתי":
        // אם ההודעה הגיעה מהצד השני (ולא אני שלחתי), ואני בשיחה -> סמן כנקרא מיד + בלי צליל
        if (newMessage.sender === state.activeContactId) {
             socketService.emit('mark_as_read_realtime', { senderId: newMessage.sender });
             // 🔇 לא מנגנים צליל כי אני בשיחה
        } 
        // אם אני שלחתי את ההודעה (ממכשיר אחר או מכאן) -> לא צריך צליל
    } else {
        // 🔔 אם אני לא בשיחה וההודעה לא ממני -> נגן צליל!
        // (בדיקה נוספת שזה לא אני ששלחתי, למקרה שאני מחובר משני טאבים)
        // שים לב: אנחנו לא יודעים את ה-ID שלי ב-Store ב-100%, אבל נניח שההודעה לא ממני אם היא מעלה מונה
        if (state.contacts.some(c => c._id === newMessage.sender)) {
             playNotificationSound();
        }
    }
    
    // 2. עדכון רשימת אנשי הקשר (מונים ומיון)
    set((state) => {
        const updatedContacts = state.contacts.map(c => {
            if (c._id === newMessage.sender || c._id === newMessage.recipient) {
              const isChattingWithSender = state.activeContactId === newMessage.sender;
              let newCount = c.unreadCount || 0;
              
              // העלאת מונה רק אם: ההודעה ממנו + אני לא בשיחה איתו
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

        // הקפצה למעלה
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
    
    // אם קיבלנו הודעה, סביר להניח שהוא הפסיק להקליד באותו רגע
    if (newMessage.sender) {
        set(state => ({ typingUsers: { ...state.typingUsers, [newMessage.sender]: false } }));
    }
  },

  setMessages: (msgs) => set({ messages: msgs }),
}));