import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { Send, ArrowRight, Paperclip, LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import MessageBubble from '@/components/chat/MessageBubble.jsx';
import OrderPickerDialog from '@/components/chat/OrderPickerDialog.jsx';

const fetchMessages = async (otherUserId) => (await api.get(`/chat/messages/${otherUserId}`)).data;
const sendMessageApi = (data) => api.post('/chat/send', data);

export default function ChatWindow({ socket, currentUser, selectedContact, onBack }) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [attachedOrder, setAttachedOrder] = useState(null); // ההזמנה שתצורף
  const [isOrderPickerOpen, setIsOrderPickerOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // 1. שליפת היסטוריית הודעות
  const { data: initialMessages, isLoading } = useQuery({
    queryKey: ['messages', selectedContact._id],
    queryFn: () => fetchMessages(selectedContact._id),
    staleTime: 0, // תמיד לרענן בכניסה
  });

  // סנכרון ראשוני לסטייט
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
      scrollToBottom();
    }
  }, [initialMessages]);

  // 2. האזנה להודעות חדשות מהסוקט
  useEffect(() => {
    const handleReceiveMessage = (newMessage) => {
      // אם ההודעה שייכת לשיחה הנוכחית (מהאדם שאני מדבר איתו כרגע)
      if (
        newMessage.sender === selectedContact._id ||
        newMessage.sender === currentUser._id
      ) {
        setMessages((prev) => [...prev, newMessage]);
        scrollToBottom();
      }
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, selectedContact._id, currentUser._id]);

  // גלילה למטה
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // שליחת הודעה
  const handleSend = async () => {
    if ((!inputText.trim() && !attachedOrder)) return;

    const payload = {
      recipientId: selectedContact._id,
      text: inputText,
      orderId: attachedOrder?._id // אם יש הזמנה מצורפת
    };

    try {
      // אופטימיסטיות: הוספה מיידית ל-UI (אופציונלי, כאן נחכה לשרת כדי לקבל את ה-populate)
      const { data: sentMessage } = await sendMessageApi(payload);

      setMessages((prev) => [...prev, sentMessage]);
      setInputText('');
      setAttachedOrder(null); // איפוס ההזמנה המצורפת
      scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
    }
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center pt-10"><LoaderCircle className="animate-spin text-slate-400" /></div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              message={msg}
              isMe={msg.sender === currentUser._id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#f0f2f5] border-t border-slate-200">
        {/* תצוגה מקדימה של הזמנה מצורפת */}
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
            variant="ghost"
            size="icon"
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

      {/* דיאלוג בחירת הזמנה */}
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