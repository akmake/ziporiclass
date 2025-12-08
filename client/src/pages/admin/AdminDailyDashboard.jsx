import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { 
    CalendarDays, Users, LogIn, LogOut, RefreshCw, 
    ArrowRightLeft, UserCheck, LoaderCircle 
} from 'lucide-react';

// API Functions
const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchUsers = async () => (await api.get('/admin/users')).data; // כדי לבחור חדרניות

const fetchDailyDashboard = async ({ queryKey }) => {
    const [_, { hotelId, date }] = queryKey;
    if (!hotelId) return [];
    const { data } = await api.get(`/bookings/daily?hotelId=${hotelId}&date=${date}`);
    return data;
};

// מיפוי צבעים לסטטוסים
const STATUS_CONFIG = {
    'arrival': { label: 'הגעה', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: LogIn },
    'departure': { label: 'עזיבה', color: 'bg-red-100 text-red-700 border-red-200', icon: LogOut },
    'stayover': { label: 'נשאר', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: RefreshCw },
    'back_to_back': { label: 'תחלופה', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: ArrowRightLeft },
    'empty': { label: 'ריק', color: 'bg-slate-50 text-slate-400 border-slate-100', icon: null }
};

export default function AdminDailyDashboard() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedRooms, setSelectedRooms] = useState(new Set());
    const [assignToUser, setAssignToUser] = useState(''); // ID של החדרנית שנבחרה להקצאה

    const queryClient = useQueryClient();

    // שליפות
    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });
    
    // שליפת משתמשים וסינון רק לבעלי תפקיד מתאים (חדרנית/תחזוקה)
    const { data: allUsers = [] } = useQuery({ queryKey: ['usersList'], queryFn: fetchUsers });
    const housekeepers = useMemo(() => {
        return allUsers.filter(u => u.role === 'housekeeper' || u.role === 'maintenance' || u.role === 'shift_manager');
    }, [allUsers]);

    // שליפת הדשבורד הראשי
    const { data: rooms = [], isLoading } = useQuery({
        queryKey: ['dailyDashboard', { hotelId: selectedHotel, date: selectedDate }],
        queryFn: fetchDailyDashboard,
        enabled: !!selectedHotel,
        refetchInterval: 30000 // רענון חי כל 30 שניות
    });

    // מוטציה להקצאת חדרים
    const assignMutation = useMutation({
        mutationFn: (payload) => api.post('/bookings/assign', payload),
        onSuccess: (res) => {
            toast.success(res.data.message);
            setSelectedRooms(new Set()); // איפוס בחירה
            setAssignToUser('');
            queryClient.invalidateQueries(['dailyDashboard']);
        },
        onError: () => toast.error('שגיאה בהקצאת חדרים')
    });

    const handleSelectRoom = (roomId) => {
        const next = new Set(selectedRooms);
        if (next.has(roomId)) next.delete(roomId);
        else next.add(roomId);
        setSelectedRooms(next);
    };

    const handleSelectAll = () => {
        if (selectedRooms.size === rooms.length) setSelectedRooms(new Set());
        else setSelectedRooms(new Set(rooms.map(r => r._id)));
    };

    const executeAssign = () => {
        if (selectedRooms.size === 0) return toast.error('לא נבחרו חדרים');
        // שולחים null אם רוצים לבטל הקצאה ("בחר חדרנית..." כשיש ערך ריק)
        assignMutation.mutate({
            roomIds: Array.from(selectedRooms),
            userId: assignToUser || null 
        });
    };

    // חישוב סטטיסטיקה מהירה למעלה
    const stats = useMemo(() => {
        const s = { arrival: 0, departure: 0, stayover: 0, back_to_back: 0, dirty: 0 };
        rooms.forEach(r => {
            if (s[r.dashboardStatus] !== undefined) s[r.dashboardStatus]++;
            if (r.status === 'dirty') s.dirty++;
        });
        return s;
    }, [rooms]);

    return (
        <div className="container mx-auto p-4 space-y-6 min-h-screen bg-slate-50">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <CalendarDays className="text-blue-600"/> סידור עבודה יומי
                    </h1>
                    <p className="text-slate-500 mt-1">צפייה בסטטוסים, שיבוצים והקצאת חדרניות.</p>
                </div>

                <div className="flex gap-4 items-end bg-white p-3 rounded-xl shadow-sm border">
                    <div>
                        <span className="text-xs text-slate-500 block mb-1">תאריך:</span>
                        <input 
                            type="date" 
                            className="border rounded-md px-2 py-1 text-sm"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 block mb-1">מלון:</span>
                        <Select value={selectedHotel || ''} onValueChange={setSelectedHotel}>
                            <SelectTrigger className="w-[180px] h-8 text-sm">
                                <SelectValue placeholder="בחר מלון..." />
                            </SelectTrigger>
                            <SelectContent>
                                {hotels.map(h => <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </header>

            {/* סטטיסטיקה מהירה */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatBox label="הגעות" count={stats.arrival} color="text-blue-600" bg="bg-blue-50" />
                <StatBox label="עזיבות" count={stats.departure} color="text-red-600" bg="bg-red-50" />
                <StatBox label="תחלופה" count={stats.back_to_back} color="text-purple-600" bg="bg-purple-50" />
                <StatBox label="נשארים" count={stats.stayover} color="text-amber-600" bg="bg-amber-50" />
                <StatBox label="לניקיון" count={stats.dirty} color="text-slate-800" bg="bg-white border border-slate-200" />
            </div>

            {/* סרגל כלים להקצאה */}
            {selectedRooms.size > 0 && (
                <div className="sticky top-4 z-20 bg-slate-900 text-white p-4 rounded-xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 font-bold">
                        <span className="bg-blue-500 px-2 py-1 rounded text-xs">{selectedRooms.size}</span>
                        חדרים נבחרו
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Select value={assignToUser} onValueChange={setAssignToUser}>
                            <SelectTrigger className="w-full md:w-[200px] bg-slate-800 border-slate-700 text-white">
                                <SelectValue placeholder="בחר חדרנית לשיוך..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">-- בטל שיוך --</SelectItem>
                                {housekeepers.map(u => (
                                    <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={executeAssign} disabled={assignMutation.isPending} className="bg-blue-600 hover:bg-blue-500 whitespace-nowrap">
                            {assignMutation.isPending ? <LoaderCircle className="animate-spin ml-2 h-4 w-4"/> : <UserCheck className="ml-2 h-4 w-4"/>}
                            בצע הקצאה
                        </Button>
                    </div>
                </div>
            )}

            {/* רשימת החדרים */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Checkbox 
                            checked={rooms.length > 0 && selectedRooms.size === rooms.length} 
                            onCheckedChange={handleSelectAll} 
                        />
                        <span className="text-sm font-bold text-slate-700">בחר הכל</span>
                    </div>
                    <span className="text-xs text-slate-500">{rooms.length} חדרים בסה"כ</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 bg-slate-100/50">
                    {isLoading ? <p className="col-span-full text-center py-10">טוען נתונים...</p> : 
                     rooms.map(room => {
                        const config = STATUS_CONFIG[room.dashboardStatus] || STATUS_CONFIG['empty'];
                        const Icon = config.icon;
                        const info = room.bookingInfo;

                        return (
                            <div 
                                key={room._id} 
                                className={`
                                    relative p-4 rounded-xl border transition-all cursor-pointer bg-white group
                                    ${selectedRooms.has(room._id) ? 'ring-2 ring-blue-500 border-transparent shadow-md' : 'border-slate-200 hover:border-blue-300'}
                                `}
                                onClick={() => handleSelectRoom(room._id)}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-2xl font-black text-slate-800">{room.roomNumber}</span>
                                    <Checkbox checked={selectedRooms.has(room._id)} />
                                </div>

                                {/* סטטוס ויזואלי */}
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold w-fit mb-3 ${config.color}`}>
                                    {Icon && <Icon size={16} />}
                                    {config.label}
                                </div>

                                {/* מידע נוסף (אורחים/תינוקות) */}
                                {info && (
                                    <div className="text-xs text-slate-600 space-y-1 mb-3 bg-slate-50 p-2 rounded">
                                        {info.pax > 0 && <p className="flex items-center gap-1"><Users size={12}/> {info.pax} אורחים</p>}
                                        {info.babies > 0 && <p className="flex items-center gap-1 font-bold text-pink-600">👶 {info.babies} תינוקות (לול!)</p>}
                                        {info.out && <p className="text-red-500">יוצאים: {info.out}</p>}
                                        {info.in && <p className="text-green-600">נכנסים: {info.in}</p>}
                                    </div>
                                )}

                                {/* מצב ניקיון פיזי */}
                                <div className="flex justify-between items-end border-t pt-3">
                                    <div className={`text-xs px-2 py-0.5 rounded-full border ${room.status === 'clean' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                        {room.status === 'clean' ? 'נקי' : 'מלוכלך'}
                                    </div>
                                    
                                    {/* חדרנית משובצת */}
                                    <div className="text-xs font-bold text-blue-700">
                                        {room.assignedTo ? room.assignedTo.name : <span className="text-slate-300 font-normal">-- לא משובץ --</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, count, color, bg }) {
    return (
        <div className={`p-3 rounded-xl text-center border-b-4 ${bg} border-slate-200`}>
            <span className="text-xs text-slate-500 font-medium block">{label}</span>
            <span className={`text-2xl font-black ${color}`}>{count}</span>
        </div>
    );
}