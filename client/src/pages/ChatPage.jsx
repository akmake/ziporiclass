import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore.js';
import { useChatStore } from '@/stores/chatStore.js'; // ה-Store החדש
import io from 'socket.io-client';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';

// יצירת חיבור אחד לסוקט מחוץ לקומפוננטה
const SERVER_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '')
  : 'http://localhost:4000';

const socket = io(SERVER_URL, {
  autoConnect: false,
});

export default function ChatPage() {
  const { user } = useAuthStore();
  const { fetchContacts, handleIncomingMessage, selectContact, activeContactId, contacts } = useChatStore();
  
  // ניהול תצוגה למובייל
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);

  // חיבור לסוקט וטעינת נתונים ראשונית
  useEffect(() => {
    if (user && user._id) {
      // 1. טעינת אנשי קשר (כולל מונים)
      fetchContacts(); 
      
      // 2. חיבור לסוקט
      socket.connect();
      socket.emit('join_chat', user._id);

      // 3. האזנה להודעות נכנסות - מעדכן את ה-Store
      const onMsg = (msg) => handleIncomingMessage(msg);
      socket.on('receive_message', onMsg);
      socket.on('message_sent_confirmation', onMsg);

      return () => {
        socket.off('receive_message', onMsg);
        socket.off('message_sent_confirmation', onMsg);
        socket.disconnect();
      };
    }
  }, [user]);

  const activeContact = contacts.find(c => c._id === activeContactId);

  const handleSelectContact = (contact) => {
    selectContact(contact._id);
    setIsMobileListVisible(false); // במובייל עוברים לצ'אט
  };

  const handleBackToList = () => {
    selectContact(null);
    setIsMobileListVisible(true);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen bg-slate-50 overflow-hidden direction-rtl">
      {/* Sidebar List - Right Side */}
      <div
        className={`
          w-full md:w-80 bg-white border-l border-slate-200 flex flex-col z-10 shadow-lg
          ${isMobileListVisible ? 'flex' : 'hidden md:flex'}
        `}
      >
        <ChatSidebar
          selectedContactId={activeContactId}
          onSelectContact={handleSelectContact}
        />
      </div>

      {/* Main Chat Window */}
      <div
        className={`
          flex-1 flex flex-col bg-[#e5ddd5] relative
          ${!isMobileListVisible ? 'flex' : 'hidden md:flex'}
        `}
      >
        {/* רקע דמוי וואטסאפ */}
        <div className="absolute inset-0 opacity-5 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] pointer-events-none"></div>

        {activeContact ? (
          <div className="relative z-10 h-full flex flex-col">
              <ChatWindow
                socket={socket}
                currentUser={user}
                selectedContact={activeContact}
                onBack={handleBackToList}
              />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 relative z-10">
            <div className="text-center bg-white/80 p-8 rounded-2xl shadow-sm backdrop-blur-sm">
              <h2 className="text-xl font-bold text-slate-600 mb-2">ברוכים הבאים לצ'אט</h2>
              <p>בחר איש קשר מהרשימה כדי להתחיל שיחה</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}