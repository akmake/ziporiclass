import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Checkbox } from '@/components/ui/Checkbox.jsx';
// שימוש באייקונים
import {
    CalendarDays, LogIn, LogOut, RefreshCw,
    ArrowRightLeft, UserCheck, LoaderCircle, Bed, Eye, EyeOff, Filter
} from 'lucide-react';

// API Functions
const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchUsers = async () => (await api.get('/admin/users')).data;

const fetchDailyDashboard = async ({ queryKey }) => {
    const [_, { hotelId, date }] = queryKey;
    if (!hotelId) return [];
    const { data } = await api.get(`/bookings/daily?hotelId=${hotelId}&date=${date}`);
    return data;
};

// הגדרת צבעים לסטטוסים
const STATUS_CONFIG = {
    'arrival': { label: 'הגעה', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: LogIn },
    'departure': { label: 'עזיבה היום', color: 'bg-red-100 text-red-700 border-red-200', icon: LogOut },
    'stayover': { label: 'נשאר', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: RefreshCw },
    'back_to_back': { label: 'תחלופה', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: ArrowRightLeft },
    'empty': { label: 'ריק', color: 'bg-slate-50 text-slate-400 border-slate-100', icon: null }
};

export default function AdminDailyDashboard() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedRooms, setSelectedRooms] = useState(new Set());
    const [assignToUser, setAssignToUser] = useState('');
    
    // סינון התצוגה
    const [showOnlyRelevant, setShowOnlyRelevant] = useState(true);

    const queryClient = useQueryClient();

    // Data Fetching
    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });
    const { data: allUsers = [] } = useQuery({ queryKey: ['usersList'], queryFn: fetchUsers });
    
    const housekeepers = useMemo(() => {
        return allUsers.filter(u => u.role === 'housekeeper' || u.role === 'maintenance' || u.role === 'shift_manager');
    }, [allUsers]);

    const { data: rooms = [], isLoading } = useQuery({
        queryKey: ['dailyDashboard', { hotelId: selectedHotel, date: selectedDate }],
        queryFn: fetchDailyDashboard,
        enabled: !!selectedHotel,
        refetchInterval: 5000 
    });

    const assignMutation = useMutation({
        mutationFn: (payload) => api.post('/bookings/assign', payload),
        onSuccess: (res) => {
            toast.success(res.data.message);
            setSelectedRooms(new Set());
            setAssignToUser('');
            queryClient.invalidateQueries(['dailyDashboard']);
        },
        onError: () => toast.error('שגיאה בהקצאת חדרים')
    });

    // Handlers
    const handleSelectRoom = (roomId) => {
        const next = new Set(selectedRooms);
        if (next.has(roomId)) next.delete(roomId);
        else next.add(roomId);
        setSelectedRooms(next);
    };

    const handleSelectAll = () => {
        if (selectedRooms.size === displayedRooms.length) setSelectedRooms(new Set());
        else setSelectedRooms(new Set(displayedRooms.map(r => r._id)));
    };

    const executeAssign = () => {
        if (selectedRooms.size === 0) return toast.error('לא נבחרו חדרים');
        assignMutation.mutate({
            roomIds: Array.from(selectedRooms),
            userId: assignToUser || null
        });
    };

    // סטטיסטיקה למעלה
    const stats = useMemo(() => {
        const s = { arrival: 0, departure: 0, stayover: 0, back_to_back: 0, dirty: 0 };
        rooms.forEach(r => {
            if (s[r.dashboardStatus] !== undefined) s[r.dashboardStatus]++;
            if (r.status === 'dirty') s.dirty++;
        });
        return s;
    }, [rooms]);

    // לוגיקת הסינון
    const displayedRooms = useMemo(() => {
        if (!showOnlyRelevant) return rooms; 

        return rooms.filter(room => {
            const hasActivity = room.dashboardStatus !== 'empty';
            const needsWork = room.status !== 'clean'; 
            return hasActivity || needsWork;
        });
    }, [rooms, showOnlyRelevant]);

    return (
        <div className="container mx-auto p-4 space-y-6 min-h-screen bg-slate-50">
            {/* --- Header --- */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <CalendarDays className="text-blue-600"/> סידור עבודה יומי
                    </h1>
                    <p className="text-slate-500 mt-1">צפייה בסטטוסים, עזיבות והקצאת חדרניות.</p>
                </div>

                <div className="flex gap-4 items-end bg-white p-3 rounded-xl shadow-sm border">
                    <div>
                        <span className="text-xs text-slate-500 block mb-1">תאריך:</span>
                        <input
                            type="date"
                            className="border rounded-md px-2 py-1 text-sm bg-slate-50"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 block mb-1">מלון:</span>
                        <Select value={selectedHotel || ''} onValueChange={setSelectedHotel}>
                            <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="בחר מלון..." /></SelectTrigger>
                            <SelectContent>{hotels.map(h => <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
            </header>

            {/* --- Stats Row --- */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatBox label="הגעות" count={stats.arrival} color="text-blue-600" bg="bg-blue-50" />
                <StatBox label="עזיבות היום" count={stats.departure} color="text-red-600" bg="bg-red-50" />
                <StatBox label="תחלופה" count={stats.back_to_back} color="text-purple-600" bg="bg-purple-50" />
                <StatBox label="נשארים" count={stats.stayover} color="text-amber-600" bg="bg-amber-50" />
                <StatBox label="לניקיון" count={stats.dirty} color="text-slate-800" bg="bg-white border border-slate-200" />
            </div>

            {/* --- Toolbar --- */}
            <div className="sticky top-4 z-20 flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* כפתור סינון */}
                <div className="bg-white p-2 rounded-lg shadow-sm border flex items-center">
                    <Button 
                        variant="ghost" 
                        onClick={() => setShowOnlyRelevant(!showOnlyRelevant)}
                        className={`gap-2 ${showOnlyRelevant ? 'text-blue-600 bg-blue-50' : 'text-slate-500'}`}
                    >
                        {showOnlyRelevant ? <Filter size={16} /> : <Eye size={16} />}
                        {showOnlyRelevant ? 'מציג: רק רלוונטיים לעבודה' : 'מציג: כל החדרים במלון'}
                    </Button>
                </div>

                {selectedRooms.size > 0 && (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl flex items-center gap-4 animate-in slide-in-from-top-2 flex-1 justify-end">
                        <div className="flex items-center gap-2 font-bold whitespace-nowrap">
                            <span className="bg-blue-500 px-2 py-1 rounded text-xs">{selectedRooms.size}</span> נבחרו
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Select value={assignToUser} onValueChange={setAssignToUser}>
                                <SelectTrigger className="w-full md:w-[200px] bg-slate-800 border-slate-700 text-white h-9"><SelectValue placeholder="בחר חדרנית..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- בטל שיוך --</SelectItem>
                                    {housekeepers.map(u => (<SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                            <Button onClick={executeAssign} disabled={assignMutation.isPending} size="sm" className="bg-blue-600 hover:bg-blue-500 whitespace-nowrap">
                                {assignMutation.isPending ? <LoaderCircle className="animate-spin ml-2 h-4 w-4"/> : <UserCheck className="ml-2 h-4 w-4"/>} הקצה
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- Room Grid --- */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Checkbox checked={displayedRooms.length > 0 && selectedRooms.size === displayedRooms.length} onCheckedChange={handleSelectAll} />
                        <span className="text-sm font-bold text-slate-700">בחר הכל</span>
                    </div>
                    <span className="text-xs text-slate-500">
                        מוצגים {displayedRooms.length} מתוך {rooms.length} חדרים
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 bg-slate-100/50">
                    {isLoading ? <p className="col-span-full text-center py-10">טוען נתונים...</p> :
                     displayedRooms.length === 0 ? 
                        <div className="col-span-full text-center py-10 text-slate-400">
                            <p className="text-lg">אין חדרים הדורשים טיפול להיום 🎉</p>
                            <Button variant="link" onClick={() => setShowOnlyRelevant(false)}>הצג את כל החדרים בכל זאת</Button>
                        </div>
                     :
                     displayedRooms.map(room => {
                        const config = STATUS_CONFIG[room.dashboardStatus] || STATUS_CONFIG['empty'];
                        const Icon = config.icon;
                        const info = room.bookingInfo;

                        // ✨✨✨ תיקון קריטי: לוקחים או את pax או את in (במקרה של תחלופה) ✨✨✨
                        // זה יפתור את הבעיה של ה-0 מיטות!
                        const babiesCount = info?.babies || 0;
                        const totalPax = info?.pax || info?.in || 0; 
                        
                        const bedsCount = Math.max(0, totalPax - babiesCount);

                        return (
                            <div
                                key={room._id}
                                className={`
                                    relative p-4 rounded-xl border transition-all cursor-pointer bg-white group
                                    ${selectedRooms.has(room._id) ? 'ring-2 ring-blue-500 border-transparent shadow-md' : 'border-slate-200 hover:border-blue-300'}
                                `}
                                onClick={() => handleSelectRoom(room._id)}
                            >
                                {/* מספר חדר + בחירה */}
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-2xl font-black text-slate-800">{room.roomNumber}</span>
                                    <Checkbox checked={selectedRooms.has(room._id)} />
                                </div>

                                {/* תווית סטטוס גדולה */}
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold w-fit mb-3 ${config.color}`}>
                                    {Icon && <Icon size={16} />}
                                    {config.label}
                                </div>

                                {/* ✨ כרטיסיית המידע המעודכנת (מיטות/עריסות) */}
                                {info && (
                                    <div className="text-sm text-slate-700 space-y-1 mb-3 bg-slate-100 p-2 rounded border border-slate-200">
                                        <div className="flex flex-col gap-1.5">
                                            {/* מיטות */}
                                            <p className="flex items-center gap-2 font-bold text-slate-800 text-base">
                                                <Bed size={18} className="text-slate-500"/>
                                                {/* כאן יוצג המספר הנכון בגלל התיקון למעלה */}
                                                <span>{bedsCount} מיטות</span>
                                            </p>

                                            {/* עריסות (רק אם יש) */}
                                            {babiesCount > 0 && (
                                                <p className="flex items-center gap-1 font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md text-xs border border-pink-200 w-fit">
                                                    👶 {babiesCount} עריסות
                                                </p>
                                            )}
                                        </div>

                                        {/* תחלופה / עזיבה / כניסה */}
                                        {(info.out || info.in) && (
                                            <div className="flex flex-wrap gap-2 text-xs mt-2 pt-2 border-t border-slate-200">
                                                {info.out && <span className="text-red-600 font-medium bg-red-50 px-1 rounded">עוזבים: {info.out}</span>}
                                                {info.in && <span className="text-blue-600 font-medium bg-blue-50 px-1 rounded">נכנסים: {info.in}</span>}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* פוטר: מצב ניקיון ושיבוץ */}
                                <div className="flex justify-between items-end border-t pt-3 mt-auto">
                                    <div className={`text-xs px-2 py-0.5 rounded-full border ${room.status === 'clean' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                        {room.status === 'clean' ? 'נקי' : 'מלוכלך'}
                                    </div>
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