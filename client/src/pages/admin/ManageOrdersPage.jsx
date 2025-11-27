// client/src/pages/admin/ManageOrdersPage.jsx

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/utils/api.js';
import { format } from 'date-fns';
import { Input } from '@/components/ui/Input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Button } from '@/components/ui/Button.jsx';
import { Search, SlidersHorizontal, Trash2, Edit, Hotel, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

// --- API Functions ---
const fetchAllOrders = async () => (await api.get('/admin/orders')).data;
const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const updateOrderStatus = ({ orderId, newStatus }) => api.put(`/admin/orders/${orderId}`, { status: newStatus });
const deleteOrderById = (orderId) => api.delete(`/admin/orders/${orderId}`);
const deleteOrdersByStatus = (status) => api.delete('/admin/orders/by-status', { data: { status } });

const OrderRow = ({ order, onStatusChange, onDelete }) => {
    const statusStyles = { 'בהמתנה': 'bg-yellow-100 text-yellow-800', 'בוצע': 'bg-green-100 text-green-800', 'לא רלוונטי': 'bg-red-100 text-red-800' };

    return (
        <div className="grid grid-cols-12 gap-4 items-center px-4 py-3 border-b hover:bg-slate-50 text-sm">
            {/* ✨ עמודות עודכנו כדי לפנות מקום למלון */}
            <div className="col-span-2">
                <p className="font-bold text-slate-800">{order.customerName}</p>
                <p className="text-slate-500">{order.customerPhone}</p>
            </div>
            {/* ✨ עמודת מלון חדשה */}
            <div className="col-span-2 text-slate-600 font-medium">{order.hotel?.name || 'N/A'}</div>
            <div className="col-span-2 text-slate-600">{order.salespersonName}</div>
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


export default function ManageOrdersPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [hotelFilter, setHotelFilter] = useState('all');
    const queryClient = useQueryClient();

    const { data: orders = [], isLoading: isLoadingOrders, isError: isOrdersError, error: ordersError } = useQuery({ queryKey: ['adminAllOrders'], queryFn: fetchAllOrders });
    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });

    const commonMutationOptions = {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminAllOrders'] }),
        onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה'),
    };

    const updateStatusMutation = useMutation({ ...commonMutationOptions, mutationFn: updateOrderStatus });
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
        // ✨ סידרנו מחדש את ההזמנות לפי התאריך העדכני ביותר
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
                {/* ✨ פילטר המלונות ממוקם כאן */}
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
                 {/* ✨ כותרות טבלה מעודכנות */}
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
                            />
                        )
                    ) : (
                        <p className="text-center text-slate-500 p-8">לא נמצאו הזמנות התואמות לחיפוש.</p>
                    )}
                </div>
            </div>
        </div>
    );
}