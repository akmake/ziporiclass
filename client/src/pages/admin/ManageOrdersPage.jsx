// client/src/pages/admin/ManageOrdersPage.jsx

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/utils/api.js';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// UI Components
import { Input } from '@/components/ui/Input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Button } from '@/components/ui/Button.jsx';
// ✨ רכיבי דיאלוג חדשים
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
// ✨ אייקונים (הוספנו UserCog)
import { Search, SlidersHorizontal, Trash2, Edit, Hotel, AlertTriangle, UserCog } from 'lucide-react';

// --- API Functions ---
const fetchAllOrders = async () => (await api.get('/admin/orders')).data;
const fetchHotels = async () => (await api.get('/admin/hotels')).data;
// ✨ פונקציה לשליפת רשימת המשתמשים
const fetchUsers = async () => (await api.get('/admin/users')).data; 

const updateOrderStatus = ({ orderId, newStatus }) => api.put(`/admin/orders/${orderId}`, { status: newStatus });
// ✨ פונקציה לעדכון שיוך ההזמנה
const updateOrderOwner = ({ orderId, newUserId }) => api.put(`/admin/orders/${orderId}`, { newUserId });

const deleteOrderById = (orderId) => api.delete(`/admin/orders/${orderId}`);
const deleteOrdersByStatus = (status) => api.delete('/admin/orders/by-status', { data: { status } });

// --- קומפוננטת דיאלוג לשינוי שיוך ---
const ReassignDialog = ({ order, isOpen, onClose, onConfirm, allUsers }) => {
    const [selectedUser, setSelectedUser] = useState(order?.user?._id || '');

    const handleSave = () => {
        if (selectedUser && selectedUser !== order?.user?._id) {
            onConfirm(order._id, selectedUser);
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>שינוי שיוך הזמנה #{order?.orderNumber}</DialogTitle>
                    <DialogDescription>
                        בחר את הנציג החדש שאליו תשויך ההזמנה. הפעולה תעדכן את הדוחות וההרשאות.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label className="text-sm font-medium mb-2 block">בחר נציג:</label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger>
                            <SelectValue placeholder="בחר משתמש..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                            {allUsers?.map(u => (
                                <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>ביטול</Button>
                    <Button onClick={handleSave}>שמור שינויים</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// --- שורת הזמנה (טבלה) ---
const OrderRow = ({ order, onStatusChange, onDelete, onReassignClick }) => {
    const statusStyles = { 'בהמתנה': 'bg-yellow-100 text-yellow-800', 'בוצע': 'bg-green-100 text-green-800', 'לא רלוונטי': 'bg-red-100 text-red-800' };

    return (
        <div className="grid grid-cols-12 gap-4 items-center px-4 py-3 border-b hover:bg-slate-50 text-sm group">
            <div className="col-span-2">
                <p className="font-bold text-slate-800">{order.customerName}</p>
                <p className="text-slate-500">{order.customerPhone}</p>
            </div>
            <div className="col-span-2 text-slate-600 font-medium">{order.hotel?.name || 'N/A'}</div>
            
            {/* ✨ עמודת איש מכירות עם כפתור עריכה מוסתר שמופיע בהובר */}
            <div className="col-span-2 text-slate-600 flex items-center gap-2 relative">
                <span className="truncate font-medium">{order.salespersonName}</span>
                <button 
                    onClick={() => onReassignClick(order)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-blue-50 rounded-full text-blue-600"
                    title="שנה שיוך נציג"
                >
                    <UserCog size={16} />
                </button>
            </div>

            <div className="col-span-2 text-slate-600">{format(new Date(order.createdAt), 'dd/MM/yy HH:mm')}</div>
            <div className="col-span-1 font-semibold">{order.total_price.toLocaleString('he-IL')}₪</div>
            <div className="col-span-2">
                <Select value={order.status} onValueChange={(newStatus) => onStatusChange(order._id, newStatus)}>
                    <SelectTrigger className={`h-8 text-xs ${statusStyles[order.status]}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="בהמתנה">בהמתנה</SelectItem>
                        <SelectItem value="בוצע">בוצע</SelectItem>
                        <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="col-span-1 text-right flex justify-end gap-1">
                <Button asChild variant="ghost" size="icon" aria-label="Edit Order">
                    <Link to={`/edit-order/${order._id}`}>
                        <Edit className="h-4 w-4 text-slate-600" />
                    </Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(order._id)} aria-label="Delete Order">
                    <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
            </div>
        </div>
    );
};

// --- הדף הראשי ---
export default function ManageOrdersPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [hotelFilter, setHotelFilter] = useState('all');
    
    // ✨ סטייט לדיאלוג שיוך מחדש
    const [reassignOrder, setReassignOrder] = useState(null);

    const queryClient = useQueryClient();

    const { data: orders = [], isLoading: isLoadingOrders, isError: isOrdersError, error: ordersError } = useQuery({ queryKey: ['adminAllOrders'], queryFn: fetchAllOrders });
    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });
    
    // ✨ שליפת משתמשים (עבור הדיאלוג)
    const { data: users = [] } = useQuery({ queryKey: ['usersList'], queryFn: fetchUsers });

    const commonMutationOptions = {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminAllOrders'] }),
        onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה'),
    };

    const updateStatusMutation = useMutation({ ...commonMutationOptions, mutationFn: updateOrderStatus });
    
    // ✨ המוטציה לשינוי שיוך
    const reassignMutation = useMutation({
        ...commonMutationOptions,
        mutationFn: updateOrderOwner,
        onSuccess: () => {
            toast.success('שיוך ההזמנה שונה בהצלחה!');
            queryClient.invalidateQueries({ queryKey: ['adminAllOrders'] });
        }
    });

    const deleteOrderMutation = useMutation({ ...commonMutationOptions, mutationFn: deleteOrderById });
    const bulkDeleteMutation = useMutation({
        ...commonMutationOptions,
        mutationFn: deleteOrdersByStatus,
        onSuccess: () => {
            toast.success('כל ההזמנות הלא רלוונטיות נמחקו!');
            commonMutationOptions.onSuccess();
        }
    });

    const filteredOrders = useMemo(() => {
        const sortedOrders = orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return sortedOrders.filter(order => {
            const nameMatch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
            const statusMatch = statusFilter === 'all' || order.status === statusFilter;
            const hotelMatch = hotelFilter === 'all' || order.hotel?._id === hotelFilter;
            return nameMatch && statusMatch && hotelMatch;
        });
    }, [orders, searchTerm, statusFilter, hotelFilter]);

    if (isLoadingOrders) return <p className="text-center p-8">טוען הזמנות...</p>;
    if (isOrdersError) return <p className="text-center p-8 text-red-600">שגיאה: {ordersError.message}</p>;

    return (
        <div className="container mx-auto p-4 space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-gray-900">ניהול הזמנות ופניות</h1>
                <p className="mt-1 text-gray-600">חיפוש, סינון ועדכון כל ההזמנות במערכת.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input placeholder="חפש לפי שם לקוח..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SlidersHorizontal className="ml-2 h-4 w-4" /><SelectValue placeholder="סנן לפי סטטוס" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">כל הסטטוסים</SelectItem>
                        <SelectItem value="בהמתנה">בהמתנה</SelectItem>
                        <SelectItem value="בוצע">בוצע</SelectItem>
                        <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={hotelFilter} onValueChange={setHotelFilter}>
                    <SelectTrigger><Hotel className="ml-2 h-4 w-4" /><SelectValue placeholder="סנן לפי מלון" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">כל המלונות</SelectItem>
                        {hotels.map(hotel => <SelectItem key={hotel._id} value={hotel._id}>{hotel.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {statusFilter === 'לא רלוונטי' && filteredOrders.length > 0 && (
                 <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600"/>
                        <p className="text-red-800 font-medium">נמצאו {filteredOrders.length} הזמנות לא רלוונטיות.</p>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            if(window.confirm(`האם למחוק ${filteredOrders.length} הזמנות לא רלוונטיות? לא ניתן לשחזר פעולה זו.`)) {
                                bulkDeleteMutation.mutate('לא רלוונטי');
                            }
                        }}
                    >
                        <Trash2 className="ml-2 h-4 w-4" /> מחק הכל
                    </Button>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-md border overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 font-medium text-slate-600 text-sm border-b">
                    <div className="col-span-2">לקוח</div>
                    <div className="col-span-2">מלון</div>
                    <div className="col-span-2">איש מכירות</div>
                    <div className="col-span-2">תאריך</div>
                    <div className="col-span-1">סכום</div>
                    <div className="col-span-2">סטטוס</div>
                    <div className="col-span-1"></div>
                </div>

                <div>
                    {filteredOrders.length > 0 ? (
                        filteredOrders.map(order =>
                            <OrderRow
                                key={order._id}
                                order={order}
                                onStatusChange={(orderId, newStatus) => updateStatusMutation.mutate({ orderId, newStatus })}
                                onDelete={(orderId) => { if (window.confirm('האם למחוק את ההזמנה?')) deleteOrderMutation.mutate(orderId) }}
                                // ✨ חיבור ללחיצה על שינוי שיוך
                                onReassignClick={setReassignOrder}
                            />
                        )
                    ) : (
                        <p className="text-center text-slate-500 p-8">לא נמצאו הזמנות התואמות לחיפוש.</p>
                    )}
                </div>
            </div>

            {/* ✨ הדיאלוג החדש לשינוי שיוך */}
            {reassignOrder && (
                <ReassignDialog
                    isOpen={!!reassignOrder}
                    order={reassignOrder}
                    allUsers={users}
                    onClose={() => setReassignOrder(null)}
                    onConfirm={(orderId, newUserId) => reassignMutation.mutate({ orderId, newUserId })}
                />
            )}
        </div>
    );
}