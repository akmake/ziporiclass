import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { CalendarDays, LogIn, LogOut, RefreshCw, UserCheck, LoaderCircle, Bed, Baby, AlertTriangle } from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchUsers = async () => (await api.get('/admin/users')).data;

// שליפת דשבורד - משתמשים בפונקציה הגנרית החדשה של השרת
const fetchDailyDashboard = async ({ queryKey }) => {
    const [_, { hotelId }] = queryKey;
    if (!hotelId) return [];
    const { data } = await api.get(`/bookings/daily?hotelId=${hotelId}`);
    return data;
};

// הגדרות עיצוב לסטטוסים
const STATUS_CONFIG = {
    'arrival': { label: 'הגעה', color: 'bg-blue-100 text-blue-700', icon: LogIn },
    'departure': { label: 'עזיבה', color: 'bg-red-100 text-red-700', icon: LogOut },
    'stayover': { label: 'שוהה', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
    'back_to_back': { label: 'תחלופה', color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
    'empty': { label: 'ריק', color: 'bg-slate-100 text-slate-400', icon: null }
};

export default function AdminDailyDashboard() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [selectedRooms, setSelectedRooms] = useState(new Set());
    const [assignToUser, setAssignToUser] = useState('');

    const queryClient = useQueryClient();

    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });
    const { data: allUsers = [] } = useQuery({ queryKey: ['usersList'], queryFn: fetchUsers });

    // סינון עובדי ניקיון בלבד
    const housekeepers = useMemo(() => allUsers.filter(u => u.role === 'housekeeper' || u.role === 'maintenance'), [allUsers]);

    const { data: rooms = [], isLoading } = useQuery({
        queryKey: ['dailyDashboard', { hotelId: selectedHotel }],
        queryFn: fetchDailyDashboard,
        enabled: !!selectedHotel,
        refetchInterval: 5000
    });

    const assignMutation = useMutation({
        mutationFn: (payload) => api.post('/bookings/assign', payload),
        onSuccess: () => {
            toast.success('החדרים הוקצו בהצלחה');
            setSelectedRooms(new Set());
            queryClient.invalidateQueries(['dailyDashboard']);
        }
    });

    const handleSelectRoom = (roomId) => {
        const next = new Set(selectedRooms);
        if (next.has(roomId)) next.delete(roomId);
        else next.add(roomId);
        setSelectedRooms(next);
    };

    const handleAssign = () => {
        if (selectedRooms.size === 0 || !assignToUser) return toast.error('חסרים נתונים');
        assignMutation.mutate({ roomIds: Array.from(selectedRooms), userId: assignToUser === 'none' ? null : assignToUser });
    };

    return (
        <div className="container mx-auto p-6 space-y-6 bg-slate-50 min-h-screen">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <CalendarDays className="text-blue-600"/> דשבורד יומי
                    </h1>
                    <p className="text-slate-500 mt-1">ניהול חדרים, סטטוסים ושיבוץ עובדים.</p>
                </div>

                <div className="flex gap-4 items-center bg-white p-3 rounded-xl shadow-sm border">
                    <Select value={selectedHotel || ''} onValueChange={setSelectedHotel}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="בחר מלון..." /></SelectTrigger>
                        <SelectContent>{hotels.map(h => <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </header>

            {/* סרגל הקצאה */}
            {selectedRooms.size > 0 && (
                <div className="sticky top-4 z-20 bg-slate-800 text-white p-3 rounded-lg shadow-xl flex items-center justify-between animate-in slide-in-from-top-2">
                    <span className="font-bold px-4">{selectedRooms.size} חדרים נבחרו</span>
                    <div className="flex gap-2">
                        <Select value={assignToUser} onValueChange={setAssignToUser}>
                            <SelectTrigger className="w-[180px] bg-slate-700 border-none text-white"><SelectValue placeholder="בחר חדרנית" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">-- בטל שיוך --</SelectItem>
                                {housekeepers.map(u => <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleAssign} disabled={assignMutation.isPending} className="bg-blue-600 hover:bg-blue-500">
                            {assignMutation.isPending ? <LoaderCircle className="animate-spin"/> : <UserCheck size={18} className="mr-2"/>} הקצה
                        </Button>
                    </div>
                </div>
            )}

            {/* גריד חדרים */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {isLoading ? <p className="col-span-full text-center p-10">טוען...</p> : 
                 rooms.map(room => {
                    const guestInfo = room.currentGuest || {};
                    const statusConfig = STATUS_CONFIG[guestInfo.status] || STATUS_CONFIG['empty'];
                    const StatusIcon = statusConfig.icon;
                    const isClean = room.status === 'clean';
                    const isSelected = selectedRooms.has(room._id);

                    // חישוב משימות מיוחדות להצגה
                    const specialTasksCount = room.tasks.filter(t => t.type === 'special').length;

                    return (
                        <div 
                            key={room._id}
                            className={`
                                relative p-4 rounded-xl border bg-white cursor-pointer transition-all hover:shadow-md
                                ${isSelected ? 'ring-2 ring-blue-600 border-transparent' : 'border-slate-200'}
                                ${isClean ? 'opacity-80' : ''}
                            `}
                            onClick={() => handleSelectRoom(room._id)}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-2xl font-black text-slate-800">{room.roomNumber}</span>
                                <Checkbox checked={isSelected} />
                            </div>

                            {/* תגית סטטוס אורח */}
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold w-fit mb-3 ${statusConfig.color}`}>
                                {StatusIcon && <StatusIcon size={12}/>} {statusConfig.label}
                            </div>

                            {/* מידע על אורחים */}
                            {guestInfo.pax > 0 && (
                                <div className="text-sm text-slate-600 space-y-1 mb-3 bg-slate-50 p-2 rounded">
                                    <div className="flex items-center gap-2 font-bold">
                                        <Bed size={14}/> {guestInfo.pax} אורחים
                                    </div>
                                    {guestInfo.babies > 0 && (
                                        <div className="flex items-center gap-2 text-pink-600 font-bold">
                                            <Baby size={14}/> {guestInfo.babies} תינוקות
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* התראות חריגות */}
                            {specialTasksCount > 0 && !isClean && (
                                <div className="text-xs text-amber-600 font-bold flex items-center gap-1 mb-2">
                                    <AlertTriangle size={12}/> יש {specialTasksCount} בקשות מיוחדות
                                </div>
                            )}

                            {/* פוטר: סטטוס ניקיון ושיוך */}
                            <div className="flex justify-between items-end border-t pt-2 mt-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isClean ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {isClean ? 'נקי' : 'ממתין'}
                                </span>
                                <span className="text-xs text-blue-600 font-bold truncate max-w-[80px]">
                                    {room.assignedTo?.name || 'לא שובץ'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
