// client/src/pages/OrderPage.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/utils/api.js';
import { Link } from 'react-router-dom'; // ✨ הוספתי
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuthStore } from '@/stores/authStore.js';

import { AddRoomForm } from '@/components/orders/AddRoomForm';
import { OrderSummaryTable } from '@/components/orders/OrderSummaryTable';
import { OrderExtrasForm } from '@/components/orders/OrderExtrasForm';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/Card.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from '@/components/ui/Label.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { 
    Hotel, FilePlus2, BadgePercent, User, Phone, Activity, StickyNote, 
    Eye, Maximize2, Tag, Calendar, Mail, Save, AlertTriangle, 
    CheckCircle2, BedDouble, ScrollText, Edit // ✨ אייקון עריכה
} from 'lucide-react';
import { calculateRoomTotalPrice } from '@/lib/priceCalculator';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;

const fetchPriceListsAsMap = async (hotelId) => {
  const { data } = await api.get(`/pricelists?hotelId=${hotelId}&active=true`);
  return data.reduce((acc, pl) => {
    acc[pl.name] = pl;
    return acc;
  }, {});
};

const fetchRoomTypes = async (hotelId) => {
  const { data } = await api.get(`/admin/room-types/by-hotel/${hotelId}`);
  return data;
};

const createOrder = (orderData) => {
  return api.post('/orders', orderData);
};

// פונקציה לעדכון סטטוס (בשביל חטיפת ההזמנה)
const updateExistingOrder = (payload) => api.put(`/orders/${payload.orderId}`, payload);

// פונקציית חיפוש
const searchExistingOrder = async (query) => {
    if (!query || query.length < 3) return [];
    const { data } = await api.get(`/orders/search?query=${query}`);
    return data;
};

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    [{ 'direction': 'rtl' }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['clean']
  ],
};
const formats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'align', 'direction',
  'list', 'bullet'
];

export default function OrderPage() {
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [extras, setExtras] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [numberOfNights, setNumberOfNights] = useState(1);
  const [orderDetails, setOrderDetails] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    eventDate: new Date().toISOString().split('T')[0],
    status: 'בהמתנה',
    notes: '',
  });

  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [tempNotes, setTempNotes] = useState('');
  const [nextAction, setNextAction] = useState('reset');
  
  // State לדיאלוג הכפילות
  const [duplicateOrder, setDuplicateOrder] = useState(null);
  const [optimaNumberForClosure, setOptimaNumberForClosure] = useState('');

  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: hotels = [], isLoading: isLoadingHotels } = useQuery({
      queryKey: ['hotels'],
      queryFn: fetchHotels,
  });

  const { data: priceLists, isLoading: isLoadingPriceLists } = useQuery({
    queryKey: ['priceListsMap', selectedHotel],
    queryFn: () => fetchPriceListsAsMap(selectedHotel),
    enabled: !!selectedHotel,
  });

  const { data: roomTypes = [], isLoading: isLoadingRoomTypes } = useQuery({
    queryKey: ['roomTypes', selectedHotel],
    queryFn: () => fetchRoomTypes(selectedHotel),
    enabled: !!selectedHotel,
  });

  // אפקט לחיפוש אוטומטי של כפילויות
  useEffect(() => {
      const checkDuplicate = async () => {
          const query = orderDetails.customerPhone || orderDetails.customerName;
          if (!query || query.length < 3) return;

          try {
              const results = await searchExistingOrder(query);
              // מחפשים הזמנה פעילה ('בהמתנה' וכו')
              const activeDuplicate = results.find(o => 
                  ['בהמתנה', 'בטיפול', 'in_progress', 'sent'].includes(o.status)
              );

              if (activeDuplicate) {
                  setDuplicateOrder(activeDuplicate);
              }
          } catch (err) {
              console.error(err);
          }
      };

      const timer = setTimeout(checkDuplicate, 800);
      return () => clearTimeout(timer);
  }, [orderDetails.customerName, orderDetails.customerPhone]);


  // מוטציה לסגירת ההזמנה הכפולה
  const closeDuplicateMutation = useMutation({
      mutationFn: updateExistingOrder,
      onSuccess: () => {
          toast.success("ההזמנה הקיימת נסגרה על שמך בהצלחה!");
          setDuplicateOrder(null);
          setOptimaNumberForClosure('');
          // איפוס הטופס הנוכחי כי העסקה נסגרה על ההזמנה הישנה
          setOrderDetails({ ...orderDetails, customerName: '', customerPhone: '' });
      },
      onError: (err) => toast.error(err.response?.data?.message || "שגיאה בסגירת ההזמנה")
  });

  const handleCloseDuplicate = () => {
      if (!optimaNumberForClosure) return toast.error("חובה להזין מספר הזמנה מאופטימה");
      
      closeDuplicateMutation.mutate({
          orderId: duplicateOrder._id,
          status: 'בוצע',
          optimaNumber: optimaNumberForClosure
      });
  };

  const { mutate: saveOrder, isPending: isSaving } = useMutation({
    mutationFn: createOrder,
    onSuccess: (response) => {
      const newOrder = response.data;
      toast.success('ההזמנה נשמרה בהצלחה!');

      if (nextAction === 'view' && newOrder?._id) {
        window.open(`/quote/${newOrder._id}`, '_blank');
      }

      setRooms([]);
      setExtras([]);
      setDiscountPercent(0);
      setOrderDetails({
          customerName: '', customerPhone: '', customerEmail: '',
          eventDate: new Date().toISOString().split('T')[0],
          status: 'בהמתנה', notes: ''
      });
      setSelectedHotel(null);
      setNumberOfNights(1);
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'שגיאה בשמירת ההזמנה.');
    },
  });

  const totals = useMemo(() => {
    const roomsTotal = rooms.reduce((sum, room) => sum + room.price, 0);
    const extrasTotal = extras.reduce((sum, ex) => sum + (ex.price * ex.quantity), 0);
    const subTotal = roomsTotal + extrasTotal;
    const discountAmount = subTotal * (discountPercent / 100);
    const afterDiscount = subTotal - discountAmount;
    const salesCommission = afterDiscount * 0.03;

    return { roomsTotal, extrasTotal, subTotal, discountAmount, finalTotal: afterDiscount, salesCommission };
  }, [rooms, extras, discountPercent]);

  useEffect(() => {
      setRooms([]);
      setExtras([]);
  }, [selectedHotel]);

  useEffect(() => {
    if (rooms.length > 0 && priceLists) {
        const updatedRooms = rooms.map(room => {
             const newPrice = calculateRoomTotalPrice(
                 room,
                 priceLists,
                 room.price_list_names,
                 numberOfNights,
                 room.roomSupplement
             );
             return { ...room, price: newPrice };
        });
        setRooms(updatedRooms);
    }
  }, [numberOfNights]);

  const addRoom = (newRoom) => setRooms(prev => [...prev, newRoom]);
  const removeRoom = (index) => setRooms(prev => prev.filter((_, i) => i !== index));
  const updateRoom = (index, updatedRoom) => setRooms(prev => prev.map((room, i) => i === index ? updatedRoom : room));

  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setOrderDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (value) => {
    setOrderDetails(prev => ({ ...prev, status: value }));
  };

  const handleNightsChange = (e) => {
      const val = parseInt(e.target.value, 10);
      setNumberOfNights(val < 1 ? 1 : val);
  };

  const getOrderPayload = () => {
    if (!selectedHotel) { toast.error('חובה לבחור מלון.'); return null; }
    if (!orderDetails.customerName) { toast.error('חובה להזין שם לקוח.'); return null; }
    if (rooms.length === 0 && extras.length === 0) { toast.error('יש להוסיף לפחות חדר אחד או תוספת.'); return null; }

    return {
      ...orderDetails,
      hotel: selectedHotel,
      rooms,
      extras,
      discountPercent,
      total_price: totals.finalTotal,
      notes: orderDetails.notes,
      numberOfNights
    };
  };

  const handleFinishOrder = () => {
    const payload = getOrderPayload();
    if (payload) {
        setNextAction('reset');
        saveOrder(payload);
    }
  };

  const handleSaveAndQuote = () => {
    const payload = getOrderPayload();
    if (payload) {
        setNextAction('view');
        saveOrder(payload);
    }
  };

  const handleOpenNotesDialog = () => {
      setTempNotes(orderDetails.notes || '');
      setIsNotesDialogOpen(true);
  };

  const handleSaveNotesFromDialog = () => {
      setOrderDetails(prev => ({ ...prev, notes: tempNotes }));
      setIsNotesDialogOpen(false);
  };

  const isLoading = isLoadingHotels || (selectedHotel && (isLoadingPriceLists || isLoadingRoomTypes));

  return (
    <div className="container mx-auto p-4 space-y-8">

      <Card className="shadow-lg">
          <CardHeader>
               <CardTitle className="flex items-center gap-2">פרטי הפנייה</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                   <div>
                       <Label htmlFor="customerName" className="mb-1.5 block">שם הלקוח</Label>
                      <div className="relative">
                         <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                         <Input id="customerName" name="customerName" value={orderDetails.customerName} onChange={handleDetailsChange} placeholder="ישראל ישראלי" required className="pl-10" />
                      </div>
                  </div>

                  <div>
                       <Label htmlFor="customerPhone" className="mb-1.5 block">טלפון</Label>
                       <div className="relative">
                         <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                         <Input id="customerPhone" name="customerPhone" value={orderDetails.customerPhone} onChange={handleDetailsChange} placeholder="050-1234567" className="pl-10" />
                       </div>
                   </div>

                   <div>
                       <Label htmlFor="customerEmail" className="mb-1.5 block">אימייל</Label>
                       <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input id="customerEmail" name="customerEmail" type="email" value={orderDetails.customerEmail} onChange={handleDetailsChange} placeholder="client@example.com" className="pl-10" />
                      </div>
                   </div>

                   <div>
                       <Label htmlFor="eventDate" className="mb-1.5 block">תאריך אירוע/הגעה</Label>
                       <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                          <Input id="eventDate" name="eventDate" type="date" value={orderDetails.eventDate} onChange={handleDetailsChange} className="pl-10" />
                      </div>
                   </div>

                   {/* שורה 2 */}
                   <div>
                        <Label htmlFor="status" className="mb-1.5 block">סטטוס</Label>
                        <Select value={orderDetails.status} onValueChange={handleStatusChange}>
                            <SelectTrigger id="status">
                                <div className="flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-gray-400" />
                                    <SelectValue placeholder="בחר סטטוס" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="בהמתנה">בהמתנה</SelectItem>
                                <SelectItem value="בוצע">בוצע</SelectItem>
                                <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                            </SelectContent>
                        </Select>
                  </div>

                   <div className="lg:col-span-3">
                      <Label htmlFor="notes" className="mb-1.5 block">הערות להזמנה</Label>
                      <div
                        className="relative min-h-[42px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer hover:bg-slate-50 transition-colors flex items-center"
                        onClick={handleOpenNotesDialog}
                        title="לחץ לפתיחת עורך הערות מלא"
                      >
                          <StickyNote className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <div className="pl-8 w-full overflow-hidden text-ellipsis whitespace-nowrap text-slate-600" dir="auto">
                              {orderDetails.notes ? (
                                  <span dangerouslySetInnerHTML={{ __html: orderDetails.notes.replace(/<[^>]+>/g, ' ').substring(0, 100) + (orderDetails.notes.length > 100 ? '...' : '') }}></span>
                              ) : (
                                   <span className="text-muted-foreground">הערות כלליות... (לחץ לעריכה)</span>
                              )}
                          </div>
                          <Maximize2 className="absolute bottom-2 left-2 h-3 w-3 text-blue-400 opacity-70" />
                      </div>
                   </div>
              </div>
          </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
           <div className="lg:col-span-1 space-y-8">
               <Card className="shadow-lg">
                <CardHeader><CardTitle className="flex items-center gap-2"><FilePlus2 size={22}/> הוספת חדר חדש</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="hotel">מלון</Label>
                        <Select value={selectedHotel || ''} onValueChange={setSelectedHotel}>
                            <SelectTrigger id="hotel">
                                <div className="flex items-center gap-2">
                                    <Hotel className="h-4 w-4 text-gray-400" />
                                    <SelectValue placeholder="בחר מלון..." />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {isLoadingHotels ?
                                  <SelectItem value="loading" disabled>טוען מלונות...</SelectItem> :
                                  hotels.map(hotel => <SelectItem key={hotel._id} value={hotel._id}>{hotel.name}</SelectItem>)
                                }
                            </SelectContent>
                        </Select>
                    </div>
                    <hr/>
                    <AddRoomForm
                        priceLists={priceLists || {}}
                        roomTypes={roomTypes || []}
                        numberOfNights={numberOfNights}
                        onNightsChange={handleNightsChange}
                        onAddRoom={addRoom}
                        disabled={!selectedHotel || isLoading}
                        isLoading={isLoading}
                    />
                </CardContent>
              </Card>

            <Card className="shadow-lg">
                <CardHeader><CardTitle className="flex items-center gap-2"><Tag size={22}/> תוספות להזמנה</CardTitle></CardHeader>
                <CardContent>
                    <OrderExtrasForm extras={extras} onChange={setExtras} />
                </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-2 shadow-lg">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle>סיכום הזמנה</CardTitle>
                    <CardDescription>
                        {rooms.length > 0 || extras.length > 0
                          ? `סה"כ ${rooms.length} חדרים ו-${extras.length} תוספות.`
                            : 'הטבלה תתעדכן לאחר הוספת פריטים.'}
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveAndQuote}
                        disabled={isSaving}
                        className="border-blue-600 text-blue-700 hover:bg-blue-50 gap-2 h-9"
                      >
                        <Eye size={16} />
                        {isSaving && nextAction === 'view' ? 'שומר...' :'הצג ושמור הזמנה'}
                      </Button>

                      <Button
                        size="sm"
                        onClick={handleFinishOrder}
                        disabled={isSaving}
                        className="bg-primary hover:bg-primary/90 gap-2 h-9"
                      >
                        <Save size={16} />
                        {isSaving && nextAction === 'reset' ? 'שומר...' : 'שמור וסיים'}
                      </Button>
                </div>
            </CardHeader>

            <CardContent>
                <OrderSummaryTable
                    rooms={rooms}
                    priceLists={priceLists || {}}
                    roomTypes={roomTypes || []}
                    numberOfNights={numberOfNights}
                    onRemoveRoom={removeRoom}
                    onUpdateRoom={updateRoom}
                />

                <div className="mt-8 bg-slate-50 p-6 rounded-lg border border-slate-100 space-y-3">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>סה"כ חדרים:</span>
                        <span>{totals.roomsTotal.toLocaleString()} ₪</span>
                    </div>

                    {totals.extrasTotal > 0 && (
                        <div className="flex justify-between text-sm text-blue-700 font-medium">
                            <span>תוספות (אולם/ציוד):</span>
                            <span>+ {totals.extrasTotal.toLocaleString()} ₪</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center py-2 border-t border-dashed border-gray-300">
                        <span className="font-medium text-gray-700">הנחה (%):</span>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                className="w-16 h-8 text-center bg-white border-slate-300"
                                value={discountPercent}
                                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                            />
                            <span className="text-red-600 text-sm w-24 text-left font-medium">
                                - {totals.discountAmount.toLocaleString()} ₪
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-between text-2xl font-bold text-slate-900 pt-2 border-t border-gray-300">
                        <span>סה"כ לתשלום:</span>
                        <span>{totals.finalTotal.toLocaleString()} ₪</span>
                    </div>
                </div>

            </CardContent>

            <CardFooter className="flex flex-col items-end gap-4 bg-slate-50 p-6 rounded-b-xl">
                {/* ✨ בדיקת הרשאות להצגת עמלות */}
                {(user?.role === 'admin' || user?.canViewCommissions) && (
                    <div className="w-full max-w-sm text-right">
                        <div className="flex justify-between text-sm text-green-600 font-medium">
                            <span className="flex items-center gap-1.5"><BadgePercent size={16}/> עמלתך (3%):</span>
                            <span>+ {totals.salesCommission.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}</span>
                        </div>
                    </div>
                )}
            </CardFooter>
          </Card>
      </div>

      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
                <DialogTitle>עריכת הערות להזמנה</DialogTitle>
                <DialogDescription>
                    הוסף הערות מפורטות, הדגשות וצבעים שיופיעו בהזמנה.
                </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-2" dir="rtl">
                <ReactQuill
                    theme="snow"
                    value={tempNotes}
                    onChange={setTempNotes}
                    modules={modules}
                    formats={formats}
                    className="h-64 mb-12"
                    placeholder="הקלד כאן את ההערות..."
                />
            </div>

            <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsNotesDialogOpen(false)}>ביטול</Button>
                <Button onClick={handleSaveNotesFromDialog}>שמור הערות</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ דיאלוג מניעת כפילויות חכם ומורחב ✨ */}
      <Dialog open={!!duplicateOrder} onOpenChange={(o) => !o && setDuplicateOrder(null)}>
        <DialogContent className="border-t-4 border-t-amber-500 max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-700 text-xl">
                    <AlertTriangle className="h-6 w-6"/> נמצאה הזמנה פתוחה ללקוח זה!
                </DialogTitle>
                <DialogDescription>
                    פרטי ההזמנה המלאים להעתקה לתוכנה החיצונית (אופטימה). בסיום, הזן את המספר לסגירה.
                </DialogDescription>
            </DialogHeader>

            {duplicateOrder && (
                <div className="flex-1 overflow-y-auto p-2" dir="rtl">
                    
                    {/* פרטים כלליים */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                        <div>
                             <span className="block text-xs text-gray-500">שם לקוח:</span>
                             <span className="font-bold">{duplicateOrder.customerName}</span>
                        </div>
                        <div>
                             <span className="block text-xs text-gray-500">נוצרה ע"י:</span>
                             <span className="font-medium text-purple-700">{duplicateOrder.createdByName || 'לא ידוע'}</span>
                        </div>
                         <div>
                             <span className="block text-xs text-gray-500">טלפון:</span>
                             <span className="font-mono">{duplicateOrder.customerPhone}</span>
                        </div>
                         <div>
                             <span className="block text-xs text-gray-500">מלון:</span>
                             <span className="font-medium">{duplicateOrder.hotel?.name || '-'}</span>
                        </div>
                        <div className="col-span-2 border-t mt-2 pt-2 flex justify-between items-center">
                            <span>סכום לתשלום:</span>
                            <span className="font-bold text-lg text-slate-800">{duplicateOrder.total_price?.toLocaleString()} ₪</span>
                        </div>
                    </div>

                    {/* פירוט חדרים */}
                    {duplicateOrder.rooms?.length > 0 && (
                        <div className="mb-4">
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><BedDouble size={16}/> הרכב חדרים:</h4>
                            <div className="space-y-2">
                                {duplicateOrder.rooms.map((room, idx) => (
                                    <div key={idx} className="bg-white p-3 rounded-lg border shadow-sm text-sm">
                                        <div className="flex justify-between font-bold text-slate-700 mb-1">
                                            <span>{room.roomType || 'חדר רגיל'}</span>
                                            <span>{room.price?.toLocaleString()} ₪</span>
                                        </div>
                                        <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                                            {room.adults > 0 && <span className="bg-slate-100 px-1 rounded">מבוגרים: {room.adults}</span>}
                                            {room.children > 0 && <span className="bg-slate-100 px-1 rounded">ילדים: {room.children}</span>}
                                            {room.babies > 0 && <span className="bg-slate-100 px-1 rounded">תינוקות: {room.babies}</span>}
                                        </div>
                                        {room.price_list_names?.length > 0 && (
                                            <div className="text-xs text-blue-600 mt-1">
                                                מחירונים: {room.price_list_names.join(', ')}
                                            </div>
                                        )}
                                        {room.notes && (
                                            <div className="text-xs text-amber-700 mt-1 bg-amber-50 p-1 rounded">
                                                הערה: {room.notes}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* פירוט תוספות */}
                    {duplicateOrder.extras?.length > 0 && (
                        <div className="mb-4">
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Tag size={16}/> תוספות:</h4>
                            <div className="bg-white rounded-lg border shadow-sm divide-y">
                                {duplicateOrder.extras.map((ex, idx) => (
                                    <div key={idx} className="p-2 text-sm flex justify-between items-center">
                                        <span>{ex.extraType} <span className="text-gray-400 text-xs">(x{ex.quantity})</span></span>
                                        <span className="font-medium">{(ex.price * ex.quantity).toLocaleString()} ₪</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* הערות כלליות */}
                    {duplicateOrder.notes && (
                        <div className="mb-2">
                            <h4 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><ScrollText size={16}/> הערות להזמנה:</h4>
                            <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-sm text-slate-700 max-h-24 overflow-y-auto">
                                {duplicateOrder.notes.replace(/<[^>]+>/g, ' ')}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* איזור הסגירה + כפתור עריכה */}
            <div className="pt-4 mt-2 border-t bg-slate-50 -mx-6 -mb-6 p-6 shadow-inner z-10">
                <Label className="mb-2 block font-bold text-green-700 text-base">סגירת עסקה (קבלת עמלה):</Label>
                <div className="flex gap-2">
                    <Input 
                        placeholder="הזן מספר הזמנה מאופטימה..." 
                        value={optimaNumberForClosure}
                        onChange={e => setOptimaNumberForClosure(e.target.value)}
                        className="bg-white border-green-300 focus:ring-green-500 font-mono"
                    />
                    <Button 
                        onClick={handleCloseDuplicate}
                        className="bg-green-600 hover:bg-green-700 gap-2 shrink-0 min-w-[120px]"
                        disabled={!optimaNumberForClosure}
                    >
                        <CheckCircle2 size={16}/> סגור עסקה
                    </Button>
                </div>
                
                {/* ✨ כפתור המעבר לעריכה מלאה ✨ */}
                <div className="mt-4 flex justify-between items-center">
                     <Button variant="outline" asChild className="text-blue-600 border-blue-200 hover:bg-blue-50">
                        <Link to={`/edit-order/${duplicateOrder?._id}`}>
                            <Edit className="ml-2 h-4 w-4"/> מעבר לעריכה מלאה (ושינוי פרטים)
                        </Link>
                    </Button>

                     <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 h-8" onClick={() => setDuplicateOrder(null)}>התעלם והמשך ביצירה</Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
