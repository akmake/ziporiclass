import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { 
    Paintbrush, CheckCircle2, ChevronDown, ChevronUp, Wrench, 
    Bed, Baby, ListChecks, Star, AlertCircle, RefreshCw 
} from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchMyRooms = async (hotelId) => (await api.get(`/rooms/${hotelId}`)).data;

export default function HousekeeperView() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [activeRoomId, setActiveRoomId] = useState(null);
    const [reportText, setReportText] = useState('');
    const [isReportOpen, setIsReportOpen] = useState(false);

    const queryClient = useQueryClient();

    // 1. טעינת מלונות
    const { data: hotels = [] } = useQuery({
        queryKey: ['hotels'],
        queryFn: fetchHotels,
    });

    useEffect(() => {
        if (hotels.length > 0 && !selectedHotel) {
            setSelectedHotel(hotels[0]._id);
        }
    }, [hotels]);

    // 2. טעינת חדרים - בלי Refetch אוטומטי למניעת שבירות
    const { data: myRooms = [], isLoading, isFetching } = useQuery({
        queryKey: ['myRooms', selectedHotel],
        queryFn: () => fetchMyRooms(selectedHotel),
        enabled: !!selectedHotel,
        refetchInterval: false 
    });

    // --- מוטציות ---

    const toggleTaskMutation = useMutation({
        mutationFn: ({ roomId, taskId, isCompleted }) => 
            api.patch(`/rooms/${roomId}/tasks/${taskId}`, { isCompleted }),
        onSuccess: () => queryClient.invalidateQueries(['myRooms', selectedHotel]),
        onError: () => toast.error("שגיאה בעדכון")
    });

    const statusMutation = useMutation({
        mutationFn: ({ roomId, status }) => api.patch(`/rooms/${roomId}/status`, { status }),
        onSuccess: () => {
            toast.success('סטטוס עודכן');
            queryClient.invalidateQueries(['myRooms', selectedHotel]);
        },
        onError: () => toast.error("שגיאה בעדכון סטטוס")
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

    // --- הפונקציה שהייתה חסרה ---
    const handleReportSubmit = () => {
        if (!reportText.trim() || !activeRoomId) return;
        reportIssueMutation.mutate({ roomId: activeRoomId, description: reportText });
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries(['myRooms', selectedHotel]);
        toast.success('רענון בוצע');
    };

    // מיון חכם: מלוכלך בראש
    const sortedRooms = [...myRooms].sort((a, b) => {
        if (a.status !== 'clean' && b.status === 'clean') return -1;
        if (a.status === 'clean' && b.status !== 'clean') return 1;
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
    });

    return (
        <div className="min-h-screen bg-slate-50 pb-20 font-sans" dir="rtl">
            
            <div className="bg-white p-4 shadow-sm sticky top-0 z-20 flex justify-between items-center border-b border-slate-200">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Paintbrush className="text-pink-600"/> המשימות שלי
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        {myRooms.filter(r => r.status !== 'clean').length} לביצוע
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={handleRefresh}>
                        <RefreshCw className={`h-5 w-5 text-slate-500 ${isFetching ? 'animate-spin' : ''}`}/>
                    </Button>
                    {hotels.length > 1 && (
                        <select className="text-sm border rounded p-1 bg-slate-50" value={selectedHotel || ''} onChange={e => setSelectedHotel(e.target.value)}>
                            {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-4 max-w-lg mx-auto">
                {isLoading && <div className="text-center py-10">טוען...</div>}
                
                {!isLoading && myRooms.length === 0 && (
                    <div className="text-center py-12 px-4 border-2 border-dashed border-slate-300 rounded-xl bg-white mt-4">
                        <CheckCircle2 size={32} className="text-slate-400 mx-auto mb-2"/>
                        <h3 className="text-lg font-bold text-slate-700">אין חדרים משויכים</h3>
                        <p className="text-sm text-slate-500">פני לאחראי משמרת לקבלת סידור עבודה.</p>
                    </div>
                )}

                {sortedRooms.map(room => {
                    const isClean = room.status === 'clean';
                    const isOpen = activeRoomId === room._id;

                    const maintenanceTasks = room.tasks.filter(t => t.type === 'maintenance');
                    const bookingTasks = room.tasks.filter(t => t.type === 'daily' && t.isSystemTask);
                    const standardTasks = room.tasks.filter(t => t.type === 'standard');
                    const otherTasks = room.tasks.filter(t => t.type === 'daily' && !t.isSystemTask);

                    return (
                        <Card key={room._id} className={`transition-all ${isClean ? 'opacity-70 border-t-4 border-green-500' : 'shadow-md border-t-4 border-pink-500'}`}>
                            <CardContent className="p-0">
                                <div 
                                    className={`p-4 flex justify-between items-center cursor-pointer ${isClean ? 'bg-green-50' : 'bg-white'}`}
                                    onClick={() => setActiveRoomId(isOpen ? null : room._id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl font-black text-slate-800">{room.roomNumber}</span>
                                        <div>
                                            <span className="text-sm text-slate-500 block">{room.roomType?.name}</span>
                                            {isClean && <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={12}/> נקי</span>}
                                        </div>
                                    </div>
                                    {isOpen ? <ChevronUp className="text-slate-400"/> : <ChevronDown className="text-slate-400"/>}
                                </div>

                                {isOpen && (
                                    <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-4">
                                        
                                        {/* תקלות */}
                                        {maintenanceTasks.length > 0 && (
                                            <div className="bg-red-50 border border-red-200 rounded p-2">
                                                <h4 className="text-xs font-bold text-red-700 mb-2 flex gap-1"><AlertCircle size={12}/> תקלות</h4>
                                                {maintenanceTasks.map(t => <TaskRow key={t._id} task={t} roomId={room._id} onToggle={toggleTaskMutation.mutate}/>)}
                                            </div>
                                        )}

                                        {/* הזמנה */}
                                        {bookingTasks.length > 0 && (
                                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                                <h4 className="text-xs font-bold text-blue-700 mb-2 flex gap-1"><Star size={12}/> הזמנה (מיטות/עריסות)</h4>
                                                {bookingTasks.map(t => <TaskRow key={t._id} task={t} roomId={room._id} onToggle={toggleTaskMutation.mutate}/>)}
                                            </div>
                                        )}

                                        {/* דגשים */}
                                        {otherTasks.length > 0 && (
                                            <div className="bg-amber-50 border border-amber-200 rounded p-2">
                                                <h4 className="text-xs font-bold text-amber-700 mb-2">דגשים להיום</h4>
                                                {otherTasks.map(t => <TaskRow key={t._id} task={t} roomId={room._id} onToggle={toggleTaskMutation.mutate}/>)}
                                            </div>
                                        )}

                                        {/* שוטף */}
                                        <div className="bg-white border border-slate-200 rounded p-2">
                                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex gap-1"><ListChecks size={12}/> ניקיון שוטף</h4>
                                            {standardTasks.map(t => <TaskRow key={t._id} task={t} roomId={room._id} onToggle={toggleTaskMutation.mutate}/>)}
                                            {standardTasks.length === 0 && <p className="text-xs text-gray-400 italic">אין משימות שוטפות.</p>}
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setIsReportOpen(true)}>
                                                <Wrench size={16} className="ml-1"/> תקלה
                                            </Button>
                                            {isClean ? (
                                                <Button variant="outline" className="flex-1" onClick={() => statusMutation.mutate({ roomId: room._id, status: 'dirty' })}>
                                                    סמן כלא נקי
                                                </Button>
                                            ) : (
                                                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => statusMutation.mutate({ roomId: room._id, status: 'clean' })}>
                                                    <CheckCircle2 size={16} className="ml-1"/> סיימתי
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>דיווח תקלה</DialogTitle></DialogHeader>
                    <Input placeholder="תארי את התקלה..." className="py-6 text-lg" value={reportText} onChange={e => setReportText(e.target.value)}/>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReportOpen(false)}>ביטול</Button>
                        <Button className="bg-red-600" onClick={handleReportSubmit}>שלח</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TaskRow({ task, roomId, onToggle }) {
    const isBed = task.description.includes('מיטות');
    const isCrib = task.description.includes('עריסות') || task.description.includes('לולים');

    return (
        <div 
            className={`flex items-start gap-3 p-2 mb-1 rounded cursor-pointer transition-colors ${task.isCompleted ? 'opacity-50' : 'hover:bg-slate-50'}`}
            onClick={() => onToggle({ roomId, taskId: task._id, isCompleted: !task.isCompleted })}
        >
            <Checkbox checked={task.isCompleted} className="mt-1" />
            <div className="flex-1">
                <span className={`text-sm ${task.isCompleted ? 'line-through' : ''}`}>{task.description}</span>
                <div className="flex gap-2 mt-1">
                    {isBed && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-bold flex items-center gap-1"><Bed size={10}/> הזמנה</span>}
                    {isCrib && <span className="text-[10px] bg-pink-100 text-pink-700 px-1 rounded font-bold flex items-center gap-1"><Baby size={10}/> תינוק</span>}
                </div>
            </div>
        </div>
    );
}