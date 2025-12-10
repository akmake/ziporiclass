import React, { useState } from 'react';
import { useChatStore } from '@/stores/chatStore.js';
import { Search, User } from 'lucide-react';
import { Input } from '@/components/ui/Input.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { format } from 'date-fns';

export default function ChatSidebar({ selectedContactId, onSelectContact }) {
  // החזרתי את ניהול החיפוש
  const [searchTerm, setSearchTerm] = useState('');
  
  // שימוש ב-Store במקום ב-useQuery
  const { contacts, isLoadingContacts } = useChatStore();

  // לוגיקת הסינון המקורית שלך
  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header עם החיפוש - בדיוק כמו במקור */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-800 mb-3">צ'אט</h2>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="חפש איש צוות..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9 bg-white"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingContacts ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : (
          <div>
            {filteredContacts.map((contact) => (
              <div
                key={contact._id}
                onClick={() => onSelectContact(contact)}
                className={`
                  flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-slate-50 relative
                  ${
                    selectedContactId === contact._id
                      ? 'bg-blue-50 border-r-4 border-r-blue-600'
                      : 'hover:bg-slate-50'
                  }
                `}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                      <User size={20} />
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                      <h3 className="font-semibold text-slate-800 truncate">
                        {contact.name}
                      </h3>
                      {contact.lastMessage && (
                        <span className="text-[10px] text-gray-400">
                          {format(new Date(contact.lastMessage.createdAt), 'HH:mm')}
                        </span>
                      )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-500 truncate max-w-[140px]">
                        {/* הצגת תפקיד אם אין הודעה, או תצוגה מקדימה של ההודעה האחרונה */}
                        {contact.lastMessage ? contact.lastMessage.text : 
                         (contact.role === 'admin' ? 'מנהל' :
                          contact.role === 'sales' ? 'מכירות' :
                          contact.role === 'maintenance' ? 'תחזוקה' : contact.role)}
                      </p>

                      {/* ✨✨ המונה החדש - עיגול ירוק ✨✨ */}
                      {contact.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-sm ml-2">
                          {contact.unreadCount}
                        </span>
                      )}
                  </div>
                </div>
              </div>
            ))}
            {filteredContacts.length === 0 && (
              <p className="text-center text-slate-400 p-4 text-sm">
                לא נמצאו אנשי קשר.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}