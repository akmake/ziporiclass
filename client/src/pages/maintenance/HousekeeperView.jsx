import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { 
    Paintbrush, CheckCircle2, ClipboardCheck, AlertTriangle, 
    ChevronDown, ChevronUp, Wrench, Plus 
} from 'lucide-react';
import { Input } from '@/components/ui/Input.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchMyRooms = async (hotelId) => (await api.get(`/rooms/${hotelId}`)).data; // השרת כבר מסנן

export default function HousekeeperView() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [activeRoom, setActiveRoom] = useState(null); // החדר הפתוח כרגע
    const [reportText, setReportText] = useState('');
    const [isReportOpen, setIsReportOpen] = useState(false);

    const queryClient = useQueryClient();

    // 1. שליפת מלונות (כדי לבחור איפה אני עובדת היום)
    const { data: hotels = [] } = useQuery({
        queryKey: ['hotels'],
        queryFn: fetchHotels,
    });

    // בחירה אוטומטית של המלון הראשון
    React.useEffect(() => {
        if (hotels.length > 0 && !selectedHotel) setSelectedHotel(hotels[0]._id);
    }, [hotels]);

    // 2. שליפת החדרים שלי להיום
    const { data: myRooms = [], isLoading } = useQuery({
        queryKey: ['myRooms', selectedHotel],
        queryFn: () => fetchMyRooms(selectedHotel),
        enabled: !!selectedHotel,
        refetchInterval: 5000 // רענון מהיר לעדכונים מהמנהל
    });

    // מוטציות (סימון משימה, דיווח תקלה, סיום חדר)
    const toggleTaskMutation = useMutation({
        mutationFn: ({ roomId, taskId, isCompleted }) => api.patch(`/rooms/${roomId}/tasks/${taskId}`, { isCompleted }),
        onSuccess: () => queryClient.invalidateQueries(['myRooms'])
    });

    const statusMutation = useMutation({
        mutationFn: ({ roomId, status }) => api.patch(`/rooms/${roomId}/status`, { status }),
        onSuccess: () => {
            toast.success('סטטוס חדר עודכן!');
            queryClient.invalidateQueries(['myRooms']);
        }
    });

    const addTaskMutation = useMutation({
        mutationFn: ({ roomId, description }) => api.post(`/rooms/${roomId}/tasks`, { description, isTemporary: false }), // תקלה = maintenance
        onSuccess: () => {
            toast.success('התקלה דווחה בהצלחה');
            setReportText('');
            setIsReportOpen(false);
            queryClient.invalidateQueries(['myRooms']);
        }
    });

    const handleReportIssue = () => {
        if (!reportText.trim()) return;
        addTaskMutation.mutate({ roomId: activeRoom._id, description: reportText });
    };

    // הפרדה: חדרים לביצוע וחדרים שהושלמו
    const todoRooms = myRooms.filter(r => r.status !== 'clean');
    const doneRooms = myRooms.filter(r => r.status === 'clean');

    return (
        <div className="min-h-screen bg-slate-50 pb-20 font-sans" dir="rtl">
            {/* Header פשוט */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Paintbrush className="text-pink-600"/> המשימות שלי להיום
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        {todoRooms.length} נותרו • {doneRooms.length} הושלמו
                    </p>
                </div>
                {/* בורר מלונות פשוט אם יש כמה */}
                {hotels.length > 1 && (
                    <select 
                        className="text-sm border rounded p-1"
                        value={selectedHotel || ''} 
                        onChange={e => setSelectedHotel(e.target.value)}
                    >
                        {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                    </select>
                )}
            </div>

            <div className="p-4 space-y-4 max-w-lg mx-auto">
                {isLoading && <div className="text-center py-10">טוען חדרים...</div>}
                
                {myRooms.length === 0 && !isLoading && (
                    <div className="text-center py-10 text-slate-400">
                        <p>אין לך חדרים להיום 🎉</p>
                        <p className="text-xs mt-2">המתיני להקצאה מהאחראי.</p>
                    </div>
                )}

                {todoRooms.map(room => (
                    <Card key={room._id} className="border-t-4 border-t-pink-500 shadow-md">
                        <CardContent className="p-0">
                            {/* כותרת החדר */}
                            <div 
                                className="p-4 flex justify-between items-center cursor-pointer bg-white"
                                onClick={() => setActiveRoom(activeRoom?._id === room._id ? null : room)}
                            >
                                <div>
                                    <span className="text-3xl font-black text-slate-800">{room.roomNumber}</span>
                                    <span className="text-sm text-slate-500 mr-2">{room.roomType?.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {room.tasks.some(t => t.type === 'maintenance' && !t.isCompleted) && <Wrench size={20} className="text-red-500 animate-pulse"/>}
                                    {room.tasks.some(t => t.type === 'daily') && <AlertTriangle size={20} className="text-amber-500"/>}
                                    {activeRoom?._id === room._id ? <ChevronUp className="text-slate-300"/> : <ChevronDown className="text-slate-300"/>}
                                </div>
                            </div>

                            {/* תוכן נפתח - משימות */}
                            {activeRoom?._id === room._id && (
                                <div className="bg-slate-50 p-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                                    
                                    <div className="space-y-3 mb-6">
                                        {room.tasks.length === 0 ? (
                                            <p className="text-slate-400 text-sm text-center italic">אין משימות מיוחדות, בצעי נוהל רגיל.</p>
                                        ) : (
                                            room.tasks.map(task => (
                                                <div 
                                                    key={task._id} 
                                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                        task.isCompleted ? 'bg-slate-100 opacity-60' : 'bg-white shadow-sm'
                                                    } ${task.type === 'maintenance' ? 'border-red-200 bg-red-50' : task.type === 'daily' ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}
                                                    onClick={() => toggleTaskMutation.mutate({ roomId: room._id, taskId: task._id, isCompleted: !task.isCompleted })}
                                                >
                                                    <Checkbox checked={task.isCompleted} />
                                                    <div className="flex-1 text-sm font-medium">
                                                        <span className={task.isCompleted ? 'line-through text-slate-500' : 'text-slate-800'}>
                                                            {task.description}
                                                        </span>
                                                        {task.type === 'daily' && <span className="block text-[10px] text-amber-600 font-bold">דגש להיום!</span>}
                                                        {task.type === 'maintenance' && <span className="block text-[10px] text-red-600 font-bold">תקלה</span>}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* כפתורי פעולה */}
                                    <div className="flex gap-3">
                                        <Button 
                                            variant="outline" 
                                            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                            onClick={() => { setReportText(''); setIsReportOpen(true); }}
                                        >
                                            <Wrench size={16} className="ml-1"/> דיווח תקלה
                                        </Button>
                                        <Button 
                                            className="flex-1 bg-green-600 hover:bg-green-700 shadow-lg"
                                            onClick={() => statusMutation.mutate({ roomId: room._id, status: 'clean' })}
                                        >
                                            <CheckCircle2 size={16} className="ml-1"/> סיימתי!
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {/* חדרים שהושלמו (מוקטנים) */}
                {doneRooms.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-slate-400 text-sm font-bold mb-2 text-center">הושלמו ({doneRooms.length})</h3>
                        <div className="space-y-2 opacity-60">
                            {doneRooms.map(room => (
                                <div key={room._id} className="bg-slate-100 p-3 rounded-lg flex justify-between items-center border border-slate-200">
                                    <span className="font-bold text-slate-600 text-lg line-through">{room.roomNumber}</span>
                                    <CheckCircle2 className="text-green-500" size={18}/>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* דיאלוג דיווח תקלה */}
            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>דיווח תקלה בחדר {activeRoom?.roomNumber}</DialogTitle>
                    </DialogHeader>
                    <Input 
                        placeholder="מה מקולקל? (למשל: נורה שרופה, ברז דולף)" 
                        value={reportText}
                        onChange={e => setReportText(e.target.value)}
                        className="py-6 text-lg"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReportOpen(false)}>ביטול</Button>
                        <Button className="bg-red-600" onClick={handleReportIssue}>שלח לתחזוקה</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}