import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { Paintbrush, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Bed, Baby, LogIn, LogOut } from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchMyRooms = async (hotelId) => (await api.get(`/rooms/${hotelId}`)).data;

export default function HousekeeperView() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [activeRoom, setActiveRoom] = useState(null);
    const queryClient = useQueryClient();

    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });

    React.useEffect(() => {
        if (hotels.length > 0 && !selectedHotel) setSelectedHotel(hotels[0]._id);
    }, [hotels]);

    const { data: myRooms = [], isLoading } = useQuery({
        queryKey: ['myRooms', selectedHotel],
        queryFn: () => fetchMyRooms(selectedHotel),
        enabled: !!selectedHotel,
        refetchInterval: 5000
    });

    const toggleTaskMutation = useMutation({
        mutationFn: ({ roomId, taskId, isCompleted }) => api.patch(`/rooms/${roomId}/tasks/${taskId}`, { isCompleted }),
        onSuccess: () => queryClient.invalidateQueries(['myRooms', selectedHotel]),
        onError: () => toast.error("שגיאה בעדכון")
    });

    const statusMutation = useMutation({
        mutationFn: ({ roomId, status }) => api.patch(`/rooms/${roomId}/status`, { status }),
        onSuccess: () => {
            toast.success('החדר סומן כנקי!');
            setActiveRoom(null); // סגירת החדר
            queryClient.invalidateQueries(['myRooms']);
        }
    });

    // מיון חדרים: אדומים (מלוכלכים) למעלה, ירוקים (נקיים) למטה
    const sortedRooms = [...myRooms].sort((a, b) => (a.status === 'clean' ? 1 : -1));

    return (
        <div className="min-h-screen bg-slate-50 pb-20 font-sans" dir="rtl">
            {/* כותרת עליונה */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center border-b border-slate-200">
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Paintbrush className="text-pink-600"/> המשימות שלי
                </h1>
                {hotels.length > 1 && (
                    <select className="text-sm border rounded p-1" value={selectedHotel || ''} onChange={e => setSelectedHotel(e.target.value)}>
                        {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                    </select>
                )}
            </div>

            <div className="p-4 space-y-4 max-w-lg mx-auto">
                {isLoading && <div className="text-center py-10">טוען נתונים...</div>}
                {myRooms.length === 0 && !isLoading && <div className="text-center py-10 text-slate-400">אין חדרים להיום 🎉</div>}

                {sortedRooms.map(room => {
                    const isClean = room.status === 'clean';
                    const specialTasks = room.tasks.filter(t => t.type === 'special' || t.type === 'maintenance');
                    const standardTasks = room.tasks.filter(t => t.type === 'standard' || !t.type);
                    const isOpen = activeRoom?._id === room._id;

                    return (
                        <Card key={room._id} className={`shadow-md transition-all ${isClean ? 'opacity-60 bg-slate-100' : 'border-t-4 border-t-pink-500'}`}>
                            <CardContent className="p-0">
                                {/* שורת כותרת לחיצה */}
                                <div 
                                    className="p-4 flex justify-between items-center cursor-pointer bg-white"
                                    onClick={() => setActiveRoom(isOpen ? null : room)}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`text-3xl font-black ${isClean ? 'text-green-600' : 'text-slate-800'}`}>{room.roomNumber}</span>
                                        
                                        {/* אייקונים של סטטוס אורח (מהאקסל) */}
                                        {room.currentGuest?.status === 'arrival' && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold flex gap-1"><LogIn size={14}/> כניסה</span>}
                                        {room.currentGuest?.status === 'departure' && <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-bold flex gap-1"><LogOut size={14}/> עזיבה</span>}
                                        
                                        {/* התראת חריגים בכותרת */}
                                        {!isClean && specialTasks.length > 0 && <span className="animate-pulse text-amber-500"><AlertTriangle size={20}/></span>}
                                    </div>
                                    
                                    <div className="text-slate-400">
                                        {isClean ? <CheckCircle2 className="text-green-500"/> : isOpen ? <ChevronUp/> : <ChevronDown/>}
                                    </div>
                                </div>

                                {/* תוכן החדר (נפתח) */}
                                {isOpen && !isClean && (
                                    <div className="bg-slate-50 p-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                                        
                                        {/* חלק 1: חריגים ודגשים (מודגש!) */}
                                        {specialTasks.length > 0 && (
                                            <div className="mb-4 space-y-2">
                                                <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">חובה לבצע:</h3>
                                                {specialTasks.map(task => (
                                                    <div key={task._id} 
                                                         className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer shadow-sm"
                                                         onClick={() => toggleTaskMutation.mutate({ roomId: room._id, taskId: task._id, isCompleted: !task.isCompleted })}
                                                    >
                                                        <Checkbox checked={task.isCompleted} className="mt-1 border-amber-500 text-amber-600 data-[state=checked]:bg-amber-600" />
                                                        <div className={`flex-1 font-bold ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                                            {task.description}
                                                            {task.description.includes('תינוק') && <Baby className="inline mr-1 text-pink-500" size={16}/>}
                                                            {task.description.includes('מיט') && <Bed className="inline mr-1 text-blue-500" size={16}/>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* חלק 2: צ'ק ליסט רגיל */}
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">משימות שוטפות:</h3>
                                            {standardTasks.map(task => (
                                                <div key={task._id} 
                                                     className={`flex items-center gap-3 p-3 rounded-lg border bg-white cursor-pointer ${task.isCompleted ? 'opacity-50' : 'shadow-sm'}`}
                                                     onClick={() => toggleTaskMutation.mutate({ roomId: room._id, taskId: task._id, isCompleted: !task.isCompleted })}
                                                >
                                                    <Checkbox checked={task.isCompleted} />
                                                    <span className={`flex-1 text-sm ${task.isCompleted ? 'line-through' : ''}`}>{task.description}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* כפתור סיום */}
                                        <div className="mt-6">
                                            <Button 
                                                className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg shadow-lg"
                                                onClick={() => {
                                                    // בדיקה שכל המיוחדים בוצעו
                                                    const uncompletedSpecial = specialTasks.some(t => !t.isCompleted);
                                                    if (uncompletedSpecial) {
                                                        return toast.error('חובה לסיים את המשימות המיוחדות (הכתומות) לפני סיום החדר!');
                                                    }
                                                    statusMutation.mutate({ roomId: room._id, status: 'clean' });
                                                }}
                                            >
                                                <CheckCircle2 className="ml-2"/> סיימתי את החדר
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
