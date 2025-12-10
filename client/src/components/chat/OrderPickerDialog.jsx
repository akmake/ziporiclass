import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Search, LoaderCircle, Check } from 'lucide-react';
import { format } from 'date-fns';

// שליפת ההזמנות שלי או כולן (תלוי בצורך, כאן שולף את של כולם כדי שיהיה קל לחפש)
const fetchOrders = async () => (await api.get('/admin/orders')).data;

export default function OrderPickerDialog({ isOpen, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['chatOrdersPicker'],
    queryFn: fetchOrders,
    enabled: isOpen, // טוען רק כשהחלון נפתח
    staleTime: 1000 * 60 * 5 // שומר בזיכרון ל-5 דקות
  });

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(search.toLowerCase()) ||
    String(o.orderNumber).includes(search)
  ).slice(0, 50); // מגביל ל-50 תוצאות לביצועים

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b bg-slate-50">
          <DialogTitle>בחר הזמנה לצירוף</DialogTitle>
          <div className="relative mt-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
            <Input 
                placeholder="חפש לפי שם או מספר הזמנה..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9 bg-white"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
                <div className="flex justify-center p-10"><LoaderCircle className="animate-spin text-blue-500"/></div>
            ) : filteredOrders.length === 0 ? (
                <p className="text-center text-gray-500 p-10">לא נמצאו הזמנות.</p>
            ) : (
                filteredOrders.map(order => (
                    <div 
                        key={order._id}
                        onClick={() => onSelect(order)}
                        className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors flex justify-between items-center group"
                    >
                        <div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                #{order.orderNumber}
                                <span className="font-normal text-slate-600">| {order.customerName}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {format(new Date(order.createdAt), 'dd/MM/yy')} • {order.hotel?.name || 'מלון'} • {order.total_price}₪
                            </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 text-blue-600">
                            <Check size={18}/>
                        </div>
                    </div>
                ))
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}