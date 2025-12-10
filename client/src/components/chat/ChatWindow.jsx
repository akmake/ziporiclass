import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { Send, ArrowRight, Paperclip, LoaderCircle, X, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import MessageBubble from '@/components/chat/MessageBubble.jsx';
import OrderPickerDialog from '@/components/chat/OrderPickerDialog.jsx';

// פונקציות API
const fetchMessages = async (otherUserId) => (await api.get(`/chat/messages/${otherUserId}`)).data;
const sendMessageApi = (data) => api.post('/chat/send', data);
const markReadApi = (senderId) => api.put('/chat/read', { senderId });
const deleteMessageApi = (msgId) => api.delete(`/chat/${msgId}`);

export default function ChatWindow({ socket, currentUser, selectedContact, onBack }) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [attachedOrder, setAttachedOrder] = useState(null);
  const [isOrderPickerOpen, setIsOrderPickerOpen] = useState(false);
  
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // 1. טעינת היסטוריה
  const { data: initialMessages, isLoading } = useQuery({
    queryKey: ['messages', selectedContact._id],
    queryFn: () => fetchMessages(selectedContact._id),
    staleTime: 0,
  });

  // סנכרון ראשוני
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
      scrollToBottom();
      // סימון כנקרא כשנכנסים לשיחה
      markReadIfNeeded(initialMessages);
    }
  }, [initialMessages, selectedContact._id]);

  // פונקציית עזר לסימון כנקרא
  const markReadIfNeeded = (msgs) => {
    const hasUnread = msgs.some(m => m.sender === selectedContact._id && !m.isRead);
    if (hasUnread) {
      markReadApi(selectedContact._id); // API call
      // אופטימיסטי לוקאלי
      setMessages(prev => prev.map(m => m.sender === selectedContact._id ? { ...m, isRead: true } : m));
    }
  };

  // 2. האזנה לסוקט
  useEffect(() => {
    // קבלת הודעה
    const handleReceiveMessage = (newMessage) => {
      // אם ההודעה שייכת לשיחה הנוכחית
      if (newMessage.sender === selectedContact._id || newMessage.sender === currentUser._id) {
        setMessages((prev) => {
            // מניעת כפילויות (אם זה הגיע מה-Confirm שלי)
            const exists = prev.find(m => m._id === newMessage._id || (m.tempId && m.tempId === newMessage.tempId));
            if (exists) return prev; 
            return [...prev, newMessage];
        });
        scrollToBottom();
        
        // אם אני המקבל - סמן כנקרא
        if (newMessage.sender === selectedContact._id) {
            markReadApi(selectedContact._id);
        }
      }
    };

    // אישור שהודעה ששלחתי נשמרה (עדכון ID זמני לקבוע)
    const handleSentConfirmation = (savedMsg) => {
        setMessages(prev => prev.map(m => 
            (m.tempId && m.content === savedMsg.content) ? savedMsg : m
        ));
    };

    // הצד השני קרא את ההודעות שלי
    const handleReadUpdate = ({ byUserId }) => {
        if (byUserId === selectedContact._id) {
            setMessages(prev => prev.map(m => m.sender === currentUser._id ? { ...m, isRead: true } : m));
        }
    };

    // הודעה נמחקה
    const handleDeleted = ({ messageId }) => {
        setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isDeleted: true } : m));
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent_confirmation', handleSentConfirmation); // לוודא שיש ב-Server
    socket.on('messages_read_update', handleReadUpdate);
    socket.on('message_deleted', handleDeleted);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent_confirmation', handleSentConfirmation);
      socket.off('messages_read_update', handleReadUpdate);
      socket.off('message_deleted', handleDeleted);
    };
  }, [socket, selectedContact._id, currentUser._id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // שליחה (עם Optimistic UI)
  const handleSend = async () => {
    if ((!inputText.trim() && !attachedOrder)) return;

    const tempId = Date.now().toString(); // מזהה זמני
    const payload = {
      recipientId: selectedContact._id,
      text: inputText,
      orderId: attachedOrder?._id,
      isForwarded: false
    };

    // 1. הוספה למסך מיד (Optimistic)
    const optimisitcMsg = {
        _id: tempId,
        tempId: tempId,
        sender: currentUser._id,
        text: inputText,
        relatedOrder: attachedOrder,
        createdAt: new Date().toISOString(),
        isRead: false,
        isDeleted: false,
        status: 'sending' // דגל ל-UI
    };

    setMessages(prev => [...prev, optimisitcMsg]);
    setInputText('');
    setAttachedOrder(null);
    scrollToBottom();

    // 2. שליחה לשרת
    try {
      const { data: sentMessage } = await sendMessageApi(payload);
      // מחליפים את ההודעה הזמנית בהודעה האמיתית מהשרת
      setMessages(prev => prev.map(m => m.tempId === tempId ? sentMessage : m));
    } catch (error) {
      console.error("Error sending:", error);
      // כאן אפשר לסמן הודעה באדום שנכשלה
    }
  };

  // פונקציות עבור התפריט (Forward/Delete) בתוך הבועה
  const handleDeleteMessage = (msgId) => {
      if(window.confirm('למחוק הודעה זו?')) {
          deleteMessageApi(msgId); // השרת ישלח סוקט לעדכון המסך
      }
  };

  const handleForwardMessage = (msg) => {
      // פשוט מעתיק את הטקסט לשורת הכתיבה ומוסיף הערה (במימוש מלא פותחים רשימת אנשי קשר)
      setInputText(msg.text);
      // בפרודקשן היית פותח מודל בחירת אנשי קשר ושולח עם isForwarded: true
      toast('הטקסט הועתק. שלח לאיש קשר אחר.', { icon: '↪️' });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full relative bg-[#efeae2]">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-white border-b border-slate-200 shadow-sm z-10">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowRight className="h-5 w-5 text-slate-600" />
        </Button>
        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
          {selectedContact.name.charAt(0)}
        </div>
        <div>
          <h3 className="font-bold text-slate-800">{selectedContact.name}</h3>
          <span className="text-xs text-green-600">מחובר</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center pt-10"><LoaderCircle className="animate-spin text-slate-400" /></div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              message={msg}
              isMe={msg.sender === currentUser._id}
              onDelete={handleDeleteMessage}
              onForward={handleForwardMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#f0f2f5] border-t border-slate-200">
        {attachedOrder && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2 mx-1">
            <div className="text-sm text-blue-800">
              <span className="font-bold">מצורפת הזמנה:</span> {attachedOrder.customerName} (#{attachedOrder.orderNumber})
            </div>
            <button onClick={() => setAttachedOrder(null)} className="text-blue-400 hover:text-blue-600">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-white rounded-2xl p-1 shadow-sm border border-slate-100">
          <Button
            variant="ghost" size="icon"
            className="text-slate-400 hover:text-blue-600 rounded-full h-10 w-10"
            onClick={() => setIsOrderPickerOpen(true)}
            title="צרף הזמנה"
          >
            <Paperclip size={20} />
          </Button>

          <Input
            className="border-none shadow-none focus-visible:ring-0 resize-none py-3 max-h-32 min-h-[40px]"
            placeholder="הקלד הודעה..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />

          <Button
            onClick={handleSend}
            disabled={!inputText.trim() && !attachedOrder}
            className="rounded-full h-10 w-10 p-0 bg-teal-600 hover:bg-teal-700 text-white shrink-0"
          >
            <Send size={18} className="ml-0.5 mt-0.5" />
          </Button>
        </div>
      </div>

      <OrderPickerDialog
        isOpen={isOrderPickerOpen}
        onClose={() => setIsOrderPickerOpen(false)}
        onSelect={(order) => {
          setAttachedOrder(order);
          setIsOrderPickerOpen(false);
        }}
      />
    </div>
  );
}