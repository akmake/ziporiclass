import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import {
    Paintbrush, CheckCircle2, ChevronDown, ChevronUp, Wrench,
    Bed, Baby, ListChecks, Star, AlertCircle, RefreshCw, LogIn, XCircle
} from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchMyRooms = async (hotelId) => (await api.get(`/rooms/${hotelId}`)).data;

export default function HousekeeperView() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [activeRoomId, setActiveRoomId] = useState(null);
    const [reportText, setReportText] = useState('');
    const [isReportOpen, setIsReportOpen] = useState(false);

    const queryClient = useQueryClient();

    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });

    useEffect(() => {
        if (hotels.length > 0 && !selectedHotel) setSelectedHotel(hotels[0]._id);
    }, [hotels]);

    const { data: myRooms = [], isLoading, isFetching } = useQuery({
        queryKey: ['myRooms', selectedHotel],
        queryFn: () => fetchMyRooms(selectedHotel),
        enabled: !!selectedHotel,
        refetchInterval: false
    });

    const toggleTaskMutation = useMutation({
        mutationFn: ({ roomId, taskId, isCompleted }) =>
            api.patch(`/rooms/${roomId}/tasks/${taskId}`, { isCompleted }),
        onSuccess: () => queryClient.invalidateQueries(['myRooms', selectedHotel]),
        onError: () => toast.error("שגיאה")
    });

    const statusMutation = useMutation({
        mutationFn: ({ roomId, status }) => api.patch(`/rooms/${roomId}/status`, { status }),
        onSuccess: () => {
            toast.success('סטטוס עודכן');
            queryClient.invalidateQueries(['myRooms', selectedHotel]);
        },
        onError: () => toast.error("שגיאה")
    });

    const reportIssueMutation = useMutation({
        mutationFn: ({ roomId, description }) =>
            api.post(`/rooms/${roomId}/tasks`, { description, isTemporary: false }),
        onSuccess: () => {
            toast.success('תקלה דווחה');
            setIsReportOpen(false);
            setReportText('');
            queryClient.invalidateQueries(['myRooms', selectedHotel]);
        }
    });

    const handleReportSubmit = () => {
        if (!reportText.trim() || !activeRoomId) return;
        reportIssueMutation.mutate({ roomId: activeRoomId, description: reportText });
    };

    // מיון חדרים: מלוכלך למעלה, נקי למטה
    const sortedRooms = [...myRooms].sort((a, b) => {
        if (a.status !== 'clean' && b.status === 'clean') return -1;
        if (a.status === 'clean' && b.status !== 'clean') return 1;
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
    });

    return (
        <div className="min-h-screen bg-gray-100 pb-20 font-sans" dir="rtl">
            {/* Header */}
            <div className="bg-white px-4 py-3 shadow-sm sticky top-0 z-20 flex justify-between items-center border-b border-gray-200">
                <div>
                    <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Paintbrush className="text-indigo-600 h-5 w-5"/> המשימות שלי
                    </h1>
                    <p className="text-xs text-gray-500">{myRooms.filter(r => r.status !== 'clean').length} חדרים לביצוע</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="bg-gray-50" onClick={() => queryClient.invalidateQueries(['myRooms', selectedHotel])}>
                        <RefreshCw className={`h-4 w-4 text-gray-600 ${isFetching ? 'animate-spin' : ''}`}/>
                    </Button>
                    {hotels.length > 1 && (
                        <select className="text-xs border rounded px-2 py-1 bg-gray-50 outline-none" value={selectedHotel || ''} onChange={e => setSelectedHotel(e.target.value)}>
                            {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-3 max-w-lg mx-auto">
                {isLoading && <div className="text-center py-10 text-gray-400">טוען נתונים...</div>}

                {!isLoading && myRooms.length === 0 && (
                    <div className="text-center py-12 px-4 bg-white rounded-xl shadow-sm border border-gray-100">
                        <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 size={32} className="text-green-500"/>
                        </div>
                        <h3 className="text-gray-800 font-bold">אין חדרים לביצוע</h3>
                        <p className="text-gray-500 text-sm mt-1">כל החדרים נקיים או שלא שובצו אליך חדרים.</p>
                    </div>
                )}

                {sortedRooms.map(room => {
                    const isClean = room.status === 'clean';
                    const isMaintenance = room.status === 'maintenance';
                    const isOpen = activeRoomId === room._id;
                    
                    // פילוח משימות
                    const tasks = room.tasks || [];
                    const maintenanceTasks = tasks.filter(t => t.type === 'maintenance');
                    const bookingTasks = tasks.filter(t => t.type === 'daily');
                    const standardTasks = tasks.filter(t => t.type === 'standard');
                    
                    // סטיילינג דינמי
                    let statusColor = "bg-white border-r-4 border-indigo-500"; // ברירת מחדל (מלוכלך)
                    let statusText = "לביצוע";
                    let statusIcon = <Paintbrush size={14} className="text-indigo-500"/>;

                    if (isClean) {
                        statusColor = "bg-white/60 border-r-4 border-green-500 opacity-70";
                        statusText = "נקי";
                        statusIcon = <CheckCircle2 size={14} className="text-green-600"/>;
                    } else if (isMaintenance) {
                        statusColor = "bg-red-50 border-r-4 border-red-500";
                        statusText = "בתיקון";
                        statusIcon = <Wrench size={14} className="text-red-600"/>;
                    }

                    return (
                        <div key={room._id} className={`rounded-xl shadow-sm overflow-hidden transition-all duration-300 ${statusColor}`}>
                            
                            {/* כותרת החדר (החלק שנראה תמיד) */}
                            <div 
                                className="p-4 flex justify-between items-center cursor-pointer active:bg-gray-50"
                                onClick={() => setActiveRoomId(isOpen ? null : room._id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col items-center justify-center w-10">
                                        <span className="text-xl font-bold text-gray-800">{room.roomNumber}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 font-medium">{room.roomType?.name}</span>
                                        <span className="text-xs flex items-center gap-1 mt-0.5 font-semibold text-gray-600">
                                            {statusIcon} {statusText}
                                        </span>
                                    </div>
                                </div>
                                {isOpen ? <ChevronUp className="text-gray-400 h-5 w-5"/> : <ChevronDown className="text-gray-400 h-5 w-5"/>}
                            </div>

                            {/* החלק הנפתח - המשימות */}
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="bg-gray-50 border-t border-gray-100"
                                    >
                                        <div className="p-4 space-y-4">
                                            
                                            {/* 1. תקלות קריטיות */}
                                            {maintenanceTasks.length > 0 && (
                                                <div className="bg-white border border-red-100 rounded-lg p-3 shadow-sm">
                                                    <h4 className="text-xs font-bold text-red-600 mb-2 flex gap-1 items-center">
                                                        <AlertCircle size={14}/> תקלות פתוחות
                                                    </h4>
                                                    {maintenanceTasks.map(t => <TaskRow key={t._id} task={t} roomId={room._id} onToggle={toggleTaskMutation.mutate}/>)}
                                                </div>
                                            )}

                                            {/* 2. הכנות להזמנה (מיטות/לולים) */}
                                            {bookingTasks.length > 0 && (
                                                <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-sm">
                                                    <h4 className="text-xs font-bold text-blue-600 mb-2 flex gap-1 items-center">
                                                        <Star size={14}/> הכנות מיוחדות
                                                    </h4>
                                                    {bookingTasks.map(t => <TaskRow key={t._id} task={t} roomId={room._id} onToggle={toggleTaskMutation.mutate}/>)}
                                                </div>
                                            )}

                                            {/* 3. צ'ק ליסט שוטף */}
                                            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                                <h4 className="text-xs font-bold text-gray-500 mb-3 flex gap-1 items-center">
                                                    <ListChecks size={14}/> צ'ק ליסט ניקיון
                                                </h4>
                                                
                                                {standardTasks.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {standardTasks.map(t => <TaskRow key={t._id} task={t} roomId={room._id} onToggle={toggleTaskMutation.mutate}/>)}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-4 bg-gray-50 rounded border border-dashed border-gray-200">
                                                        <p className="text-xs text-gray-400">אין משימות מוגדרות.</p>
                                                        <p className="text-[10px] text-gray-300 mt-1">אולי החדר לא סומן כמלוכלך?</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* כפתורי פעולה */}
                                            <div className="flex gap-3 pt-2">
                                                <Button 
                                                    variant="outline" 
                                                    className="flex-1 bg-white border-red-200 text-red-600 hover:bg-red-50 h-10 text-sm" 
                                                    onClick={() => setIsReportOpen(true)}
                                                >
                                                    <Wrench size={16} className="ml-1.5"/> דווח תקלה
                                                </Button>
                                                
                                                {isClean ? (
                                                    <Button variant="outline" className="flex-1 h-10 text-sm" onClick={() => statusMutation.mutate({ roomId: room._id, status: 'dirty' })}>
                                                        סמן כלא נקי
                                                    </Button>
                                                ) : (
                                                    <Button 
                                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white h-10 text-sm shadow-md" 
                                                        onClick={() => statusMutation.mutate({ roomId: room._id, status: 'clean' })}
                                                    >
                                                        <CheckCircle2 size={16} className="ml-1.5"/> סיימתי חדר
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* דיאלוג דיווח תקלה */}
            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent className="w-[90%] rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="text-right">דיווח תקלה</DialogTitle>
                    </DialogHeader>
                    <Input 
                        placeholder="מה מקולק? (למשל: נורה שרופה, ברז דולף)" 
                        className="py-6 text-base" 
                        value={reportText} 
                        onChange={e => setReportText(e.target.value)}
                        autoFocus
                    />
                    <DialogFooter className="flex-row gap-2 mt-4">
                        <Button variant="outline" className="flex-1" onClick={() => setIsReportOpen(false)}>ביטול</Button>
                        <Button className="bg-red-600 flex-1" onClick={handleReportSubmit}>דווח</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// שורת משימה בודדת
function TaskRow({ task, roomId, onToggle }) {
    const isBed = task.description.includes('מיטות');
    const isCrib = task.description.includes('עריסות');
    const isArrival = task.description.includes('הגעה');

    return (
        <div 
            className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-all ${
                task.isCompleted ? 'opacity-40' : 'hover:bg-gray-50 active:bg-gray-100'
            }`}
            onClick={() => onToggle({ roomId, taskId: task._id, isCompleted: !task.isCompleted })}
        >
            <div className="mt-0.5 pointer-events-none">
                <Checkbox checked={task.isCompleted} />
            </div>
            <div className="flex-1">
                <span className={`text-sm text-gray-700 block ${task.isCompleted ? 'line-through decoration-gray-400' : ''}`}>
                    {task.description}
                </span>
                
                {/* תגיות אוטומטיות חכמות */}
                <div className="flex gap-2 mt-1.5 flex-wrap">
                    {isBed && <Badge text="הזמנה" icon={<Bed size={10}/>} color="bg-blue-100 text-blue-700"/>}
                    {isCrib && <Badge text="תינוק" icon={<Baby size={10}/>} color="bg-pink-100 text-pink-700"/>}
                    {isArrival && <Badge text="נכנסים היום" icon={<LogIn size={10}/>} color="bg-green-100 text-green-700"/>}
                </div>
            </div>
        </div>
    );
}

const Badge = ({ text, icon, color }) => (
    <span className={`text-[10px] ${color} px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1`}>
        {icon} {text}
    </span>
);