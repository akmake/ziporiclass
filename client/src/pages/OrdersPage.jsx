// client/src/pages/OrdersPage.jsx

import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent, CardFooter } from '@/components/ui/Card.jsx';
import { PlusCircle, Trash2, Edit, Eye, Hotel, Phone, Calendar, User, Users, CheckCircle2, Clock, XCircle } from 'lucide-react';

// --- API Functions ---
const fetchMyOrders = async () => {
  const { data } = await api.get('/orders/my-orders');
  return data;
};

const deleteOrder = (orderId) => api.delete(`/orders/${orderId}`);

const updateOrderStatus = ({ orderId, status }) => api.put(`/orders/${orderId}`, { status });

export default function OrdersPage() {
  const queryClient = useQueryClient();

  const { data: orders, isLoading, isError, error } = useQuery({
    queryKey: ['myOrders'],
    queryFn: fetchMyOrders,
  });

  const { mutate: deleteOrderMutation } = useMutation({
       mutationFn: deleteOrder,
      onSuccess: () => {
          toast.success("ההזמנה נמחקה!");
          queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      },
      onError: () => toast.error("שגיאה במחיקת ההזמנה.")
  });

  const { mutate: updateStatusMutation } = useMutation({
      mutationFn: updateOrderStatus,
      onSuccess: () => {
          toast.success("סטטוס עודכן");
          queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      },
      onError: () => toast.error("שגיאה בעדכון סטטוס")
  });

  // --- לוגיקה: קיבוץ ומיון ---
  const processedData = useMemo(() => {
    if (!orders) return { grouped: {}, stats: { waiting: 0, done: 0, irrelevant: 0 } };

    const groups = {};
    const stats = { waiting: 0, done: 0, irrelevant: 0 };

    // מיון: קודם כל לפי סטטוס (בהמתנה למעלה), ואז לפי תאריך
    const statusPriority = { 'בהמתנה': 1, 'בוצע': 2, 'לא רלוונטי': 3 };
    
    const sortedOrders = [...orders].sort((a, b) => {
        const priorityA = statusPriority[a.status] || 4;
        const priorityB = statusPriority[b.status] || 4;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    sortedOrders.forEach(order => {
        const hotelName = order.hotel?.name || 'הזמנות ללא שיוך';
        
        if (!groups[hotelName]) {
            groups[hotelName] = { 'בהמתנה': [], 'בוצע': [], 'לא רלוונטי': [] };
        }

        const targetStatus = groups[hotelName][order.status] ? order.status : 'בהמתנה';
        groups[hotelName][targetStatus].push(order);

        if (order.status === 'בהמתנה') stats.waiting++;
        else if (order.status === 'בוצע') stats.done++;
        else if (order.status === 'לא רלוונטי') stats.irrelevant++;
    });

    return { grouped: groups, stats };
  }, [orders]);

  const handleDelete = (orderId) => {
      if (window.confirm("האם למחוק את ההזמנה לצמיתות?")) {
          deleteOrderMutation(orderId);
      }
  }

  const handleStatusChange = (orderId, newStatus) => {
      updateStatusMutation({ orderId, status: newStatus });
  }

  if (isLoading) return <div className="text-center p-10 text-gray-500">טוען נתונים...</div>;
  if (isError) return <div className="text-center p-10 text-red-600">שגיאה: {error.message}</div>;

  const statusDisplayOrder = ['בהמתנה', 'בוצע', 'לא רלוונטי'];

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8 bg-white min-h-screen">
      
      {/* כותרת ראשית */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">ההזמנות שלי</h1>
          <p className="text-slate-500 mt-1">ניהול ומעקב אחר כל העסקאות במקום אחד.</p>
        </div>
        <Button asChild size="lg" className="shadow-none bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-6">
          <Link to="/new-order"><PlusCircle className="ml-2 h-5 w-5"/> הזמנה חדשה</Link>
        </Button>
      </div>

      {/* דשבורד סטטיסטיקה */}
      <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex flex-col items-center justify-center border-l border-slate-200">
              <span className="text-3xl font-bold text-amber-600">{processedData.stats.waiting}</span>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">בהמתנה</span>
          </div>
          <div className="flex flex-col items-center justify-center border-l border-slate-200">
              <span className="text-3xl font-bold text-green-600">{processedData.stats.done}</span>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">בוצעו</span>
          </div>
          <div className="flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-400">{processedData.stats.irrelevant}</span>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">לא רלוונטי</span>
          </div>
      </div>

      {/* רשימת ההזמנות */}
      <div className="space-y-16">
        {Object.keys(processedData.grouped).length > 0 ? (
            Object.entries(processedData.grouped).map(([hotelName, hotelStatuses]) => (
              <section key={hotelName} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                
                {/* כותרת המלון */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
                        <Hotel className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">{hotelName}</h2>
                </div>
                
                {/* רשימת סטטוסים */}
                <div className="space-y-8">
                    {statusDisplayOrder.map(statusKey => {
                        const ordersInStatus = hotelStatuses[statusKey];
                        if (!ordersInStatus || ordersInStatus.length === 0) return null;

                        return (
                            <div key={statusKey}>
                                {/* כותרת סטטוס */}
                                <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wide">
                                    {statusKey === 'בהמתנה' && <Clock size={14} className="text-amber-500"/>}
                                    {statusKey === 'בוצע' && <CheckCircle2 size={14} className="text-green-500"/>}
                                    {statusKey === 'לא רלוונטי' && <XCircle size={14} className="text-slate-400"/>}
                                    {statusKey} ({ordersInStatus.length})
                                </h3>

                                {/* גריד הכרטיסיות */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {ordersInStatus.map((order) => (
                                        <OrderCard 
                                            key={order._id} 
                                            order={order} 
                                            onDelete={handleDelete} 
                                            onStatusChange={handleStatusChange}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
              </section>
            ))
        ) : (
          <div className="text-center p-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <p className="text-slate-500 text-lg font-medium">הטרמינל שלך ריק כרגע.</p>
            <Button asChild variant="link" className="mt-2 text-blue-600">
              <Link to="/new-order">צור את ההזמנה הראשונה שלך</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- רכיב הכרטיסייה (Card) ---
const OrderCard = ({ order, onDelete, onStatusChange }) => {
    
    const roomsCount = order.rooms?.length || 0;
    const totalPeople = order.rooms?.reduce((sum, r) => sum + (r.adults || 0) + (r.teens || 0) + (r.children || 0) + (r.babies || 0), 0) || 0;
    const isIrrelevant = order.status === 'לא רלוונטי';

    // צבעי רקע עדינים לכפתור הסטטוס בלבד
    const statusStyles = {
        'בהמתנה': 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
        'בוצע': 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
        'לא רלוונטי': 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200',
    };

    return (
        <Card 
            // ✨ כאן ההגדרה המדויקת לעיקולים: למעלה XL, למטה SM (כמעט מרובע)
            className={`
                bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col h-full
                rounded-t-xl rounded-b-sm
                ${isIrrelevant ? 'opacity-60 grayscale' : ''}
            `}
        >
            {/* כותרת הכרטיס: רקע אפור עדין מאוד להפרדה */}
            <div className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                <div className="flex justify-between items-start">
                    <div>
                        <span className="font-mono font-bold text-slate-500 text-sm block tracking-wider">#{order.orderNumber}</span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                            <Calendar size={10} />
                            {format(new Date(order.createdAt), 'dd/MM/yy')}
                        </span>
                    </div>
                    <div className="flex gap-1 -mt-1 -ml-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600" asChild title="ערוך">
                            <Link to={`/edit-order/${order._id}`}><Edit size={14} /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => onDelete(order._id)} title="מחק">
                            <Trash2 size={14} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* גוף הכרטיס: לבן נקי */}
            <CardContent className="p-4 flex-1 space-y-3 bg-white">
                {/* שם לקוח */}
                <div>
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                        <User size={16} className="text-slate-400" />
                        <span className="truncate">{order.customerName}</span>
                    </div>
                    {order.customerPhone && (
                        <a 
                            href={`https://wa.me/972${order.customerPhone.replace(/\D/g, '').replace(/^0/, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-slate-500 hover:text-green-600 mt-1 w-fit transition-colors ml-6"
                        >
                            <Phone size={12} />
                            <span dir="ltr">{order.customerPhone}</span>
                        </a>
                    )}
                </div>

                {/* פירוט חדרים ואנשים - נקי וללא רקע */}
                <div className="flex items-center gap-3 text-sm text-slate-600 pt-1 border-t border-dashed border-slate-100 mt-2">
                    <div className="flex items-center gap-1.5 mt-2">
                        <Hotel size={14} className="text-slate-400"/>
                        <span className="font-medium">{roomsCount} חדרים</span>
                    </div>
                    <span className="text-slate-300 mt-2">|</span>
                    <div className="flex items-center gap-1.5 mt-2">
                        <Users size={14} className="text-slate-400"/>
                        <span className="font-medium">{totalPeople} אורחים</span>
                    </div>
                </div>
            </CardContent>

            {/* תחתית: רקע לבן, מסגרת עליונה עדינה */}
            <CardFooter className="p-3 px-4 border-t border-slate-100 bg-white rounded-b-sm flex justify-between items-center">
                <div className="text-slate-900 font-bold text-lg">
                    {order.total_price.toLocaleString()} ₪
                </div>

                <div className="flex items-center gap-3">
                    {/* כפתור הצצה */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full" asChild title="הצג הצעה">
                        <Link to={`/quote/${order._id}`} target="_blank">
                            <Eye size={18} />
                        </Link>
                    </Button>

                    {/* סטטוס Dropdown בעיצוב Badge */}
                    <div className="min-w-[100px]">
                        <Select 
                            value={order.status} 
                            onValueChange={(val) => onStatusChange(order._id, val)}
                        >
                            <SelectTrigger 
                                className={`h-8 text-xs font-bold border-0 shadow-none ring-0 focus:ring-0 px-3 rounded-full transition-colors ${statusStyles[order.status] || 'bg-slate-100'}`}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="בהמתנה">בהמתנה</SelectItem>
                                <SelectItem value="בוצע">בוצע</SelectItem>
                                <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
};