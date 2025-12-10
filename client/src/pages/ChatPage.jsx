import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore.js';
import io from 'socket.io-client';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';

// יצירת חיבור אחד לסוקט מחוץ לקומפוננטה
// אנו משתמשים בכתובת הבסיס של ה-API, אבל ללא הסיומת /api כי סוקט יושב בשורש
const SERVER_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '')
  : 'http://localhost:4000';

const socket = io(SERVER_URL, {
  autoConnect: false, // נתחבר ידנית כשיש יוזר
});

export default function ChatPage() {
  const { user } = useAuthStore();
  const [selectedContact, setSelectedContact] = useState(null);
  const [isMobileListVisible, setIsMobileListVisible] = useState(true); // למובייל

  // חיבור לסוקט בכניסה לדף
  useEffect(() => {
    if (user && user._id) {
      socket.connect();
      // הצטרפות לחדר פרטי שלי כדי לקבל הודעות
      socket.emit('join_chat', user._id);
    }

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setIsMobileListVisible(false); // במובייל, הסתר את הרשימה ועבור לצ'אט
  };

  const handleBackToList = () => {
    setIsMobileListVisible(true);
    setSelectedContact(null);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar List */}
      <div
        className={`
          w-full md:w-80 bg-white border-l border-slate-200 flex flex-col
          ${isMobileListVisible ? 'flex' : 'hidden md:flex'}
        `}
      >
        <ChatSidebar
          selectedContactId={selectedContact?._id}
          onSelectContact={handleSelectContact}
        />
      </div>

      {/* Main Chat Window */}
      <div
        className={`
          flex-1 flex flex-col bg-[#e5ddd5] // צבע רקע סטייל וואטסאפ
          ${!isMobileListVisible ? 'flex' : 'hidden md:flex'}
        `}
      >
        {selectedContact ? (
          <ChatWindow
            socket={socket}
            currentUser={user}
            selectedContact={selectedContact}
            onBack={handleBackToList}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 bg-[#f0f2f5]">
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-600">בחר איש קשר</h2>
              <p>כדי להתחיל לשלוח הודעות</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}