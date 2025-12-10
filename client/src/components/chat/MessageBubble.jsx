import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCheck, Trash2, Reply, Ban } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export default function MessageBubble({ message, isMe, onDelete, onForward }) {
  const isOrderAttached = !!message.relatedOrder;
  const isDeleted = message.isDeleted;

  // פונקציית רינדור הסטטוס (וי אפור/כחול/שעון)
  const renderStatus = () => {
    if (!isMe || isDeleted) return null;
    if (message.status === 'sending') return <span className="text-gray-400 text-[10px]">🕒</span>;
    if (message.isRead) return <CheckCheck size={14} className="text-blue-500" />;
    return <CheckCheck size={14} className="text-gray-400" />;
  };

  return (
    <div className={`flex w-full mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <ContextMenu>
            <ContextMenuTrigger className={`relative max-w-[80%] min-w-[120px] rounded-xl shadow-sm text-sm mb-1 group px-3 py-2 flex flex-col 
                ${isMe 
                    ? 'bg-[#d9fdd3] text-gray-900 rounded-tl-xl rounded-tr-none' // ההודעות שלי (ירוק)
                    : 'bg-white text-gray-900 rounded-tr-xl rounded-tl-none border border-gray-100'} // ההודעות שלו (לבן)
                `}>
                
                {/* כותרת הודעה מועברת */}
                {message.isForwarded && !isDeleted && (
                    <div className="text-[10px] text-gray-500 italic mb-1 flex items-center gap-1 bg-black/5 p-1 rounded w-fit">
                        <Reply size={10} className="scale-x-[-1]"/> הועבר
                    </div>
                )}

                {/* תוכן מחוק */}
                {isDeleted ? (
                    <div className="flex items-center gap-2 text-gray-500 italic py-1 px-1">
                        <Ban size={14}/> <span>הודעה זו נמחקה</span>
                    </div>
                ) : (
                    <>
                        {/* כרטיסיית הזמנה מצורפת */}
                        {isOrderAttached && message.relatedOrder && (
                            <div className="mb-2 bg-white/80 p-2 rounded border border-blue-100 shadow-sm cursor-pointer hover:bg-blue-50 transition-colors">
                                <p className="font-bold text-xs text-blue-700">הזמנה #{message.relatedOrder.orderNumber}</p>
                                <p className="font-medium">{message.relatedOrder.customerName}</p>
                                <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs text-gray-500">{message.relatedOrder.status}</span>
                                        <Link to={`/edit-order/${message.relatedOrder._id}`} className="text-xs underline text-blue-600 font-bold">צפה</Link>
                                </div>
                            </div>
                        )}

                        {/* טקסט ההודעה */}
                        <div className="whitespace-pre-wrap leading-relaxed text-base pl-1 pr-1 pb-1">
                            {message.text}
                        </div>
                    </>
                )}

                {/* שורה תחתונה: שעה וסטטוס */}
                <div className="flex justify-end items-center gap-1 mt-1 select-none">
                    <span className="text-[10px] text-gray-500">
                        {message.createdAt ? format(new Date(message.createdAt), 'HH:mm') : ''}
                    </span>
                    {renderStatus()}
                </div>

            </ContextMenuTrigger>

            {/* תפריט לחיצה ימנית */}
            <ContextMenuContent className="w-40 bg-white border shadow-md rounded z-50">
               {!isDeleted && (
                    <ContextMenuItem onClick={() => onForward(message)} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-100">
                        <Reply size={14} className="scale-x-[-1]"/> העבר
                    </ContextMenuItem>
                )}
                {isMe && !isDeleted && (
                    <ContextMenuItem onClick={() => onDelete(message._id)} className="flex items-center gap-2 text-red-600 cursor-pointer p-2 hover:bg-red-50">
                        <Trash2 size={14}/> מחק אצלי ואצל כולם
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    </div>
  );
}