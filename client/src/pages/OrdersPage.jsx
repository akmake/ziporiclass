import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { PlusCircle, Trash2, Edit, Eye, Hotel, Phone, Calendar, User, Users, CheckCircle2, Clock, XCircle, Search, Lock } from 'lucide-react';

// --- API Functions ---
const fetchMyOrders = async () => {
  const { data } = await api.get('/orders/my-orders');
  return data;
};

// פונקציית חיפוש חדשה
const searchGlobalOrders = async (query) => {
    const { data } = await api.get(`/orders/search?query=${query}`);
    return data;
};

const deleteOrder = (orderId) => api.delete(`/orders/${orderId}`);

// פונקציית עדכון גנרית
const updateOrderStatusApi = (payload) => api.put(`/orders/${payload.orderId}`, payload);

export default function OrdersPage() {
  const queryClient = useQueryClient();

  // State לחיפוש
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // State לדיאלוג סגירה (מספר אופטימה)
  const [isCloseDialog, setIsCloseDialog] = useState(false);
  const [orderToClose, setOrderToClose] = useState(null);
  const [optimaNumber, setOptimaNumber] = useState('');

  // שליפת ההזמנות שלי (ברירת מחדל)
  const { data: myOrders, isLoading: loadingMyOrders, isError, error } = useQuery({
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
      mutationFn: updateOrderStatusApi,
      onSuccess: () => {
          toast.success("סטטוס עודכן");
          queryClient.invalidateQueries({ queryKey: ['myOrders'] });
          setIsCloseDialog(false);
          setOptimaNumber('');
          setOrderToClose(null);
          
          // אם אנחנו במצב חיפוש, ננקה אותו כדי לראות את העדכונים
          if (isSearching) {
              setSearchQuery('');
              setIsSearching(false);
          }
      },
      onError: (err) => toast.error(err.response?.data?.message || "שגיאה בעדכון")
  });

  // --- לוגיקה ---

  const handleSearch = async (e) => {
      e.preventDefault();
      if (!searchQuery.trim()) {
          setIsSearching(false);
          return;
      }
      setIsSearching(true);
      try {
          const results = await searchGlobalOrders(searchQuery);
          setSearchResults(results);
      } catch (error) {
          toast.error('שגיאה בחיפוש');
      }
  };

  const handleDelete = (orderId) => {
      if (window.confirm("האם למחוק את ההזמנה לצמיתות?")) {
          deleteOrderMutation(orderId);
      }
  }

  // טיפול בשינוי סטטוס
  const handleStatusChangeStart = (order, newStatus) => {
      if (newStatus === 'בוצע') {
          // אם מנסים לסגור - מקפיצים דיאלוג לאימות מספר אופטימה
          setOrderToClose(order);
          setIsCloseDialog(true);
      } else {
          // שינוי רגיל
          updateStatusMutation({ orderId: order._id, status: newStatus });
      }
  }

  // אישור הדיאלוג
  const submitCloseOrder = () => {
      if (!optimaNumber.trim()) return toast.error('חובה להזין מספר הזמנה מאופטימה');
      
      updateStatusMutation({
          orderId: orderToClose._id,
          status: 'בוצע',
          optimaNumber: optimaNumber
      });
  };

  const displayOrders = isSearching ? searchResults : (myOrders || []);

  if (loadingMyOrders && !isSearching) return <div className="text-center p-10 text-gray-500">טוען נתונים...</div>;
  if (isError && !isSearching) return <div className="text-center p-10 text-red-600">שגיאה: {error.message}</div>;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8 bg-white min-h-screen">

      {/* Header & Search Area */}
      <div className="flex flex-col gap-6 border-b border-slate-100 pb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">
                    {isSearching ? 'תוצאות חיפוש' : 'ההזמנות שלי'}
                </h1>
                <p className="text-slate-500 mt-1">
                    {isSearching ? 'איתור הזמנות מכלל המערכת' : 'ניהול ומעקב אחר כל העסקאות שלך'}
                </p>
            </div>
            <Button asChild size="lg" className="shadow-none bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-6">
                <Link to="/new-order"><PlusCircle className="ml-2 h-5 w-5"/> הזמנה חדשה</Link>
            </Button>
        </div>

        {/* שורת חיפוש */}
        <form onSubmit={handleSearch} className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5"/>
            <Input 
                placeholder="חפש לפי שם לקוח, טלפון או מספר הזמנה..." 
                className="pl-10 h-12 text-lg shadow-sm border-slate-300 focus:border-blue-500"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
            />
            {isSearching && (
                <button 
                    type="button" 
                    onClick={() => { setIsSearching(false); setSearchQuery(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-bold hover:underline"
                >
                    נקה חיפוש
                </button>
            )}
        </form>
      </div>

      {/* רשימת ההזמנות / תוצאות חיפוש */}
      <div className="space-y-8">
        {displayOrders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                {displayOrders.map((order) => (
                    <OrderCard
                        key={order._id}
                        order={order}
                        onDelete={handleDelete}
                        onStatusChange={(val) => handleStatusChangeStart(order, val)}
                        isSearchResult={isSearching}
                    />
                ))}
            </div>
        ) : (
          <div className="text-center p-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <p className="text-slate-500 text-lg font-medium">
                {isSearching ? 'לא נמצאו הזמנות תואמות.' : 'הטרמינל שלך ריק כרגע.'}
            </p>
            {!isSearching && (
                <Button asChild variant="link" className="mt-2 text-blue-600">
                  <Link to="/new-order">צור את ההזמנה הראשונה שלך</Link>
                </Button>
            )}
          </div>
        )}
      </div>

      {/* דיאלוג סגירת עסקה (מספר אופטימה) */}
      <Dialog open={isCloseDialog} onOpenChange={setIsCloseDialog}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-green-700">
                      <CheckCircle2/> אישור סגירת עסקה
                  </DialogTitle>
                  <DialogDescription>
                      כל הכבוד! כדי לרשום את העסקה על שמך ולקבל את העמלה, נא להזין את מספר ההזמנה כפי שהתקבל בתוכנת <strong>אופטימה</strong>.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <label className="text-sm font-bold text-slate-700 block mb-2">מספר הזמנה (Optima ID):</label>
                  <Input 
                      placeholder="לדוגמה: 50402" 
                      className="text-lg font-mono tracking-widest text-center"
                      value={optimaNumber}
                      onChange={e => setOptimaNumber(e.target.value)}
                      autoFocus
                  />
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCloseDialog(false)}>ביטול</Button>
                  <Button onClick={submitCloseOrder} className="bg-green-600 hover:bg-green-700">אשר וסגור</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

    </div>
  );
}

// --- רכיב הכרטיסייה (Card) ---
const OrderCard = ({ order, onDelete, onStatusChange, isSearchResult }) => {
    // צבעי רקע עדינים לכפתור הסטטוס בלבד
    const statusStyles = {
        'בהמתנה': 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
        'בוצע': 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
        'לא רלוונטי': 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200',
    };

    const isDone = order.status === 'בוצע';

    return (
        <Card
            className={`
                bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col h-full
                rounded-t-xl rounded-b-sm
                ${order.status === 'לא רלוונטי' ? 'opacity-60 grayscale' : ''}
                ${isDone ? 'bg-green-50/30' : ''}
            `}
        >
            {/* כותרת הכרטיס */}
            <div className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                <div className="flex justify-between items-start">
                    <div>
                        <span className="font-mono font-bold text-slate-500 text-sm block tracking-wider">#{order.orderNumber}</span>
                        <div className="text-[10px] text-slate-400 mt-1 flex flex-col">
                            <span>נוצר ע"י: {order.createdByName || 'לא ידוע'}</span>
                            {order.createdAt && <span>{format(new Date(order.createdAt), 'dd/MM/yy')}</span>}
                        </div>
                    </div>
                    
                    {/* כפתורי עריכה/מחיקה - מוסתרים בחיפוש אם זה לא שלי */}
                    <div className="flex gap-1 -mt-1 -ml-1">
                        {!isSearchResult && !isDone && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => onDelete(order._id)} title="מחק">
                                <Trash2 size={14} />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600" asChild title="ערוך/צפה">
                            <Link to={`/edit-order/${order._id}`}><Edit size={14} /></Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* גוף הכרטיס */}
            <CardContent className="p-4 flex-1 space-y-3 bg-white/50">
                <div>
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                        <User size={16} className="text-slate-400" />
                        <span className="truncate">{order.customerName}</span>
                    </div>
                    {order.customerPhone && (
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1 ml-6">
                            <Phone size={12} />
                            <span dir="ltr">{order.customerPhone}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                    <Hotel size={14}/> {order.hotel?.name || 'מלון'}
                </div>
            </CardContent>

            {/* תחתית */}
            <CardFooter className="p-3 px-4 border-t border-slate-100 bg-white rounded-b-sm flex justify-between items-center">
                <div className="text-slate-900 font-bold text-lg">
                    {/* הסתרת מחיר בחיפוש */}
                    {isSearchResult ? (
                        <span className="flex items-center gap-1 text-slate-400 text-sm italic cursor-help" title="המחיר מוסתר בחיפוש">
                            <Lock size={12}/> מוסתר
                        </span>
                    ) : (
                        <span>{order.total_price?.toLocaleString()} ₪</span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full" asChild title="הצג הצעה">
                        <Link to={`/quote/${order._id}`} target="_blank">
                            <Eye size={18} />
                        </Link>
                    </Button>

                    <div className="min-w-[100px]">
                        <Select
                            value={order.status}
                            onValueChange={onStatusChange}
                            disabled={isDone && isSearchResult} // אם זה חיפוש וזה כבר סגור - אי אפשר לשנות
                        >
                            <SelectTrigger
                                className={`h-8 text-xs font-bold border-0 shadow-none ring-0 focus:ring-0 px-3 rounded-full transition-colors ${statusStyles[order.status] || 'bg-slate-100'}`}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="בהמתנה">בהמתנה</SelectItem>
                                <SelectItem value="בוצע">בוצע (סגירה)</SelectItem>
                                <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
};