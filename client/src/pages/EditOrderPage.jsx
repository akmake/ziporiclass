import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuthStore } from '@/stores/authStore.js'; // ✨ ייבוא ה-store

// Components
import { AddRoomForm } from '@/components/orders/AddRoomForm';
import { OrderSummaryTable } from '@/components/orders/OrderSummaryTable';
import { OrderExtrasForm } from '@/components/orders/OrderExtrasForm';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from '@/components/ui/Label.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";

// Icons
import {
    ArrowRight, User, Phone, Activity, BadgePercent, Save,
    FileDown, Hotel, Eye, StickyNote, FilePlus2, Tag, Mail, Calendar, Maximize2
} from 'lucide-react';

import { calculateRoomTotalPrice } from '@/lib/priceCalculator';

const fetchOrder = async (orderId) => (await api.get(`/orders/${orderId}`)).data;

const fetchAllPriceListsAsMap = async (hotelId) => {
  const { data } = await api.get(`/pricelists?hotelId=${hotelId}`);
  return data.reduce((acc, pl) => {
    acc[pl.name] = pl;
    return acc;
  }, {});
};

const fetchRoomTypes = async (hotelId) => {
    const { data } = await api.get(`/admin/room-types/by-hotel/${hotelId}`);
    return data;
};

const updateOrder = (orderData) => api.put(`/orders/${orderData._id}`, orderData);

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

export default function EditOrderPage() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore(); // ✨ שליפת המשתמש

    const [rooms, setRooms] = useState([]);
    const [extras, setExtras] = useState([]);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [numberOfNights, setNumberOfNights] = useState(1);

    const [orderDetails, setOrderDetails] = useState({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        eventDate: '',
        status: 'בהמתנה',
        notes: ''
    });

    const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
    const [tempNotes, setTempNotes] = useState('');

    const { data: order, isLoading: isLoadingOrder, isError: isOrderError } = useQuery({
        queryKey: ['order', orderId],
        queryFn: () => fetchOrder(orderId),
        enabled: !!orderId,
    });

    const hotelId = order?.hotel?._id;

    const { data: priceLists, isLoading: isLoadingPriceLists } = useQuery({
        queryKey: ['priceListsMap', hotelId],
        queryFn: () => fetchAllPriceListsAsMap(hotelId),
        enabled: !!hotelId,
    });

    const { data: roomTypes = [], isLoading: isLoadingRoomTypes } = useQuery({
        queryKey: ['roomTypes', hotelId],
        queryFn: () => fetchRoomTypes(hotelId),
        enabled: !!hotelId,
    });

    const activePriceLists = useMemo(() => {
        if (!priceLists) return {};
        const active = {};
        Object.values(priceLists).forEach(pl => {
            if (pl.isVisible !== false) {
                active[pl.name] = pl;
            }
        });
        return active;
    }, [priceLists]);

    useEffect(() => {
        if (order) {
            setRooms(order.rooms || []);
            setExtras(order.extras || []);
            setDiscountPercent(order.discountPercent || 0);
            setNumberOfNights(order.numberOfNights || 1);

            setOrderDetails({
                customerName: order.customerName || '',
                customerPhone: order.customerPhone || '',
                customerEmail: order.customerEmail || '',
                eventDate: order.eventDate ? format(new Date(order.eventDate), 'yyyy-MM-dd') : '',
                status: order.status || 'בהמתנה',
                notes: order.notes || '',
            });
        }
    }, [order]);

    useEffect(() => {
        if (
            rooms.length > 0 &&
            priceLists &&
            Object.keys(priceLists).length > 0 &&
            order &&
            numberOfNights !== order.numberOfNights
        ) {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numberOfNights, priceLists, order]);

    const { mutate: saveOrder, isPending: isSaving } = useMutation({
        mutationFn: updateOrder,
        onSuccess: () => {
            toast.success('ההזמנה עודכנה בהצלחה!');
            queryClient.invalidateQueries({ queryKey: ['myOrders'] });
            queryClient.invalidateQueries({ queryKey: ['adminAllOrders'] });
            queryClient.invalidateQueries({ queryKey: ['order', orderId] });
            navigate(-1);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'שגיאה בעדכון ההזמנה.'),
    });

    const totals = useMemo(() => {
        const roomsTotal = rooms.reduce((sum, room) => {
            let price = room.price;
            if (price === 0 && priceLists && room.price_list_names?.length > 0) {
                 price = calculateRoomTotalPrice(room, priceLists, room.price_list_names, numberOfNights, room.roomSupplement);
            }
            return sum + price;
        }, 0);

        const extrasTotal = extras.reduce((sum, ex) => sum + (ex.price * ex.quantity), 0);
        const subTotal = roomsTotal + extrasTotal;
        const discountAmount = subTotal * (discountPercent / 100);
        const afterDiscount = subTotal - discountAmount;
        const salesCommission = afterDiscount * 0.03;

        return { roomsTotal, extrasTotal, subTotal, discountAmount, finalTotal: afterDiscount, salesCommission };
    }, [rooms, extras, discountPercent, priceLists, numberOfNights]);

    const addRoom = (newRoom) => setRooms(prev => [...prev, newRoom]);
    const removeRoom = (index) => setRooms(prev => prev.filter((_, i) => i !== index));
    const updateRoom = (index, updatedRoom) => setRooms(prev => prev.map((room, i) => i === index ? updatedRoom : room));

    const handleDetailsChange = (e) => setOrderDetails(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleStatusChange = (value) => setOrderDetails(prev => ({ ...prev, status: value }));

    const handleNightsChange = (e) => {
        const val = parseInt(e.target.value, 10);
        setNumberOfNights(val < 1 ? 1 : val);
    };

    const handleOpenNotesDialog = () => {
        setTempNotes(orderDetails.notes || '');
        setIsNotesDialogOpen(true);
    };
    const handleSaveNotesFromDialog = () => {
        setOrderDetails(prev => ({ ...prev, notes: tempNotes }));
        setIsNotesDialogOpen(false);
    };

    const handleFinishEditing = () => {
        if (!orderDetails.customerName) return toast.error('חובה להזין שם לקוח.');

        const dataToSave = {
          ...order,
          ...orderDetails,
          rooms,
          extras,
          discountPercent,
          total_price: totals.finalTotal,
          numberOfNights
        };
        saveOrder(dataToSave);
    };

    const handleExportToExcel = () => { /* ... */ };

    if (isLoadingOrder) return <div className="text-center p-10">טוען פרטי הזמנה...</div>;
    if (isOrderError) return <div className="text-center p-10 text-red-600">שגיאה בטעינת ההזמנה.</div>;

    const isLoadingSomething = isLoadingOrder || (hotelId && (isLoadingPriceLists || isLoadingRoomTypes));

    return (
        <div className="container mx-auto p-4 space-y-8">
            <header className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">עריכת הזמנה #{order?.orderNumber}</h1>
                    <p className="mt-1 text-gray-600">עדכון פרטי לקוח, סטטוס, והרכב החדרים.</p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link to={`/quote/${order?._id}`} target="_blank">
                          <Eye className="ml-2 h-4 w-4" /> הצג הצעת מחיר
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={() => navigate(-1)}>
                        <ArrowRight className="ml-2 h-4 w-4"/> חזור
                    </Button>
                </div>
            </header>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">פרטי הפנייה</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">

                        {/* שורה 1 */}
                        <div>
                            <Label htmlFor="customerName" className="mb-1">שם הלקוח</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input id="customerName" name="customerName" value={orderDetails.customerName} onChange={handleDetailsChange} required className="pl-10" />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="customerPhone" className="mb-1">טלפון</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input id="customerPhone" name="customerPhone" value={orderDetails.customerPhone} onChange={handleDetailsChange} className="pl-10" />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="customerEmail" className="mb-1">אימייל</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input id="customerEmail" name="customerEmail" type="email" value={orderDetails.customerEmail} onChange={handleDetailsChange} className="pl-10" />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="eventDate" className="mb-1">תאריך אירוע/הגעה</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <Input id="eventDate" name="eventDate" type="date" value={orderDetails.eventDate} onChange={handleDetailsChange} className="pl-10" />
                            </div>
                        </div>

                        {/* שורה 2 */}
                        <div>
                            <Label htmlFor="status" className="mb-1">סטטוס</Label>
                            <Select value={orderDetails.status} onValueChange={handleStatusChange}>
                                <SelectTrigger id="status">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-gray-400" />
                                        <SelectValue />
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
                            <Label htmlFor="notes" className="mb-1 block">הערות להזמנה</Label>
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
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Hotel size={22}/> מלון</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-lg font-semibold p-2 bg-slate-100 rounded-md text-center">{order?.hotel?.name || 'לא זמין'}</p>
                        </CardContent>
                    </Card>

                    {/* הוספת חדר */}
                    <Card className="shadow-lg">
                        <CardHeader><CardTitle className="flex items-center gap-2"><FilePlus2 size={22} /> הוספת חדר</CardTitle></CardHeader>
                        <CardContent>
                            <AddRoomForm
                                priceLists={activePriceLists || {}}
                                roomTypes={roomTypes || []}
                                numberOfNights={numberOfNights}
                                onNightsChange={handleNightsChange}
                                onAddRoom={addRoom}
                                disabled={!hotelId || isLoadingSomething}
                                isLoading={isLoadingSomething}
                            />
                        </CardContent>
                    </Card>

                    {/* ניהול תוספות */}
                    <Card className="shadow-lg">
                        <CardHeader><CardTitle className="flex items-center gap-2"><Tag size={22}/> תוספות להזמנה</CardTitle></CardHeader>
                        <CardContent>
                            <OrderExtrasForm extras={extras} onChange={setExtras} />
                        </CardContent>
                    </Card>
                </div>

                {/* טבלה וסיכום */}
                <Card className="lg:col-span-2 shadow-lg">
                    <CardHeader>
                        <CardTitle>סיכום הזמנה</CardTitle>
                        <CardDescription>{rooms.length > 0 ? `סה"כ ${rooms.length} חדרים ו-${extras.length} תוספות.` : 'הטבלה תתעדכן לאחר הוספת פריטים.'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <OrderSummaryTable
                            rooms={rooms}
                            priceLists={priceLists || {}}
                            onRemoveRoom={removeRoom}
                            onUpdateRoom={updateRoom}
                            roomTypes={roomTypes || []}
                            numberOfNights={numberOfNights}
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

                        <div className="flex justify-start gap-4 w-full mt-4">
                            <Button variant="outline" onClick={handleExportToExcel}><FileDown className="ml-2" /> שמור לאקסל</Button>
                            <Button onClick={handleFinishEditing} disabled={isSaving}><Save className="ml-2" />{isSaving ? 'שומר שינויים...' : 'שמור שינויים'}</Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>

            <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>עריכת הערות להזמנה</DialogTitle>
                        <DialogDescription>הוסף הערות מפורטות, הדגשות וצבעים.</DialogDescription>
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

        </div>
    );
}