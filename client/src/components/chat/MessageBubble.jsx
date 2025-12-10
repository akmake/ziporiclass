import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function MessageBubble({ message, isMe }) {
  const isOrderAttached = !!message.relatedOrder;

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] md:max-w-[60%] p-3 rounded-2xl shadow-sm relative text-sm ${
          isMe
            ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' // צבע ירוק-וואטסאפ להודעות שלי
            : 'bg-white text-gray-800 rounded-tl-none'
        }`}
      >
        {/* === כרטיסיית הזמנה (ה"קאץ'") === */}
        {isOrderAttached && (
          <div className="mb-2 bg-slate-50 rounded-md overflow-hidden border border-slate-200">
             {/* פס צבע לפי סטטוס */}
             <div className={`h-1 w-full ${message.relatedOrder.status === 'בוצע' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
             <div className="p-2">
                <p className="font-bold text-xs text-slate-500 mb-1">
                    הזמנה #{message.relatedOrder.orderNumber}
                </p>
                <p className="font-medium text-slate-800 truncate mb-2">
                    {message.relatedOrder.customerName}
                </p>
                <Link
                    to={`/edit-order/${message.relatedOrder._id}`}
                    className="block text-center bg-white border border-slate-300 rounded py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                >
                    צפה בהזמנה
                </Link>
             </div>
          </div>
        )}

        {/* טקסט ההודעה */}
        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>

        {/* שעה */}
        <div className="text-[10px] text-gray-400 text-end mt-1 flex justify-end items-center gap-1">
            {format(new Date(message.createdAt), 'HH:mm')}
            {isMe && <span>✓</span>} {/* אפשר להוסיף וי כפול בעתיד */}
        </div>
      </div>
    </div>
  );
}