import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { Paintbrush, CheckCircle2, ChevronDown, ChevronUp, Wrench, Plus, Bed, Baby, ListChecks, Star } from 'lucide-react';
import { Input } from '@/components/ui/Input.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchMyRooms = async (hotelId) => (await api.get(`/rooms/${hotelId}`)).data;

export default function HousekeeperView() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [activeRoom, setActiveRoom] = useState(null);
    const [reportText, setReportText] = useState('');
    const [isReportOpen, setIsReportOpen] = useState(false);

    const queryClient = useQueryClient();

    const { data: hotels = [] } = useQuery({
        queryKey: ['hotels'],
        queryFn: fetchHotels,
    });

    React.useEffect(() => {
        if (hotels.length > 0 && !selectedHotel) setSelectedHotel(hotels[0]._id);
    }, [hotels]);

    const { data: myRooms = [], isLoading } = useQuery({
        queryKey: ['myRooms', selectedHotel],
        queryFn: () => fetchMyRooms(selectedHotel),
        enabled: !!selectedHotel,
        refetchInterval: false // ✨ ביטול רענון אוטומטי למניעת קפיצות
    });

    const toggleTaskMutation = useMutation({
        mutationFn: ({ roomId, taskId, isCompleted }) => api.patch(`/rooms/${roomId}/tasks/${taskId}`, { isCompleted }),
        onMutate: async ({ roomId, taskId, isCompleted }) => {
            await queryClient.cancelQueries(['myRooms', selectedHotel]);
            const previousRooms = queryClient.getQueryData(['myRooms', selectedHotel]);

            queryClient.setQueryData(['myRooms', selectedHotel], (old) => {
                if (!old) return [];
                return old.map(room => {
                    if (room._id === roomId) {
                        return {
                            ...room,
                            tasks: room.tasks.map(t => t._id === taskId ? { ...t, isCompleted } : t)
                        };
                    }
                    return room;
                });
            });

            return { previousRooms };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(['myRooms', selectedHotel], context.previousRooms);
            toast.error("שגיאה בשמירה, נסה שוב");
        },
        onSettled: () => queryClient.invalidateQueries(['myRooms', selectedHotel])
    });

    const statusMutation = useMutation({
        mutationFn: ({ roomId, status }) => api.patch(`/rooms/${roomId}/status`, { status }),
        onSuccess: () => {
            toast.success('סטטוס חדר עודכן!');
            queryClient.invalidateQueries(['myRooms', selectedHotel]);
        }
    });

    const addTaskMutation = useMutation({
        mutationFn: ({ roomId, description }) => api.post(`/rooms/${roomId}/tasks`, { description, isTemporary: false }),
        onSuccess: () => {
            toast.success('התקלה דווחה בהצלחה');
            setReportText('');
            setIsReportOpen(false);
            queryClient.invalidateQueries(['myRooms', selectedHotel]);
        }
    });

    const handleReportIssue = () => {
        if (!reportText.trim()) return;
        addTaskMutation.mutate({ roomId: activeRoom._id, description: reportText });
    };

    const todoRooms = myRooms.filter(r => r.status !== 'clean');
    const doneRooms = myRooms.filter(r => r.status === 'clean');

    return (
        <div className="min-h-screen bg-slate-50 pb-20 font-sans" dir="rtl">
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center border-b border-slate-200">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Paintbrush className="text-pink-600"/> המשימות שלי להיום
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        {todoRooms.length} נותרו • {doneRooms.length} הושלמו
                    </p>
                </div>
                {hotels.length > 1 && (
                    <select className="text-sm border rounded p-1" value={selectedHotel || ''} onChange={e => setSelectedHotel(e.target.value)}>
                        {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                    </select>
                )}
            </div>

            <div className="p-4 space-y-4 max-w-lg mx-auto">
                {isLoading && <div className="text-center py-10">טוען חדרים...</div>}

                {myRooms.length === 0 && !isLoading && (
                    <div className="text-center py-10 text-slate-400">
                        <p>אין לך חדרים להיום 🎉</p>
                    </div>
                )}

                {todoRooms.map(room => (
                    <Card key={room._id} className="border-t-4 border-t-pink-500 shadow-md">
                        <CardContent className="p-0">
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
                                    {activeRoom?._id === room._id ? <ChevronUp className="text-slate-300"/> : <ChevronDown className="text-slate-300"/>}
                                </div>
                            </div>

                            {activeRoom?._id === room._id && (
                                <div className="bg-slate-50 p-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                                    
                                    <div className="space-y-4 mb-6">
                                        
                                        {/* 1. תקלות קריטיות */}
                                        {room.tasks.filter(t => t.type === 'maintenance').length > 0 && (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                                                <h4 className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1"><Wrench size={12}/> תקלות פתוחות</h4>
                                                {room.tasks.filter(t => t.type === 'maintenance').map(task => (
                                                    <TaskRow key={task._id} task={task} roomId={room._id} toggle={toggleTaskMutation.mutate} />
                                                ))}
                                            </div>
                                        )}

                                        {/* 2. סידורי חדר (מיטות/עריסות) - הנתונים מהאקסל */}
                                        {room.tasks.filter(t => t.type === 'daily' && t.isSystemTask).length > 0 && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                                                <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1"><Star size={12}/> הרכב חדר (מהזמנה)</h4>
                                                {room.tasks.filter(t => t.type === 'daily' && t.isSystemTask).map(task => (
                                                    <TaskRow key={task._id} task={task} roomId={room._id} toggle={toggleTaskMutation.mutate} />
                                                ))}
                                            </div>
                                        )}

                                        {/* 3. צ'ק ליסט שוטף */}
                                        <div className="bg-white border border-slate-200 rounded-lg p-2">
                                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1"><ListChecks size={12}/> ניקיון שוטף</h4>
                                            {room.tasks.filter(t => t.type === 'standard').map(task => (
                                                <TaskRow key={task._id} task={task} roomId={room._id} toggle={toggleTaskMutation.mutate} />
                                            ))}
                                            {room.tasks.filter(t => t.type === 'standard').length === 0 && <p className="text-xs text-gray-400">אין משימות קבועות.</p>}
                                        </div>

                                    </div>

                                    <div className="flex gap-3">
                                        <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50" onClick={() => { setReportText(''); setIsReportOpen(true); }}>
                                            <Wrench size={16} className="ml-1"/> דיווח תקלה
                                        </Button>
                                        <Button className="flex-1 bg-green-600 hover:bg-green-700 shadow-lg" onClick={() => statusMutation.mutate({ roomId: room._id, status: 'clean' })}>
                                            <CheckCircle2 size={16} className="ml-1"/> סיימתי!
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

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

            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>דיווח תקלה בחדר {activeRoom?.roomNumber}</DialogTitle></DialogHeader>
                    <Input placeholder="מה מקולקל?" value={reportText} onChange={e => setReportText(e.target.value)} className="py-6 text-lg" />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReportOpen(false)}>ביטול</Button>
                        <Button className="bg-red-600" onClick={handleReportIssue}>שלח לתחזוקה</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// רכיב עזר לשורת משימה
function TaskRow({ task, roomId, toggle }) {
    const isBed = task.description.includes('מיטות');
    const isCrib = task.description.includes('עריסות') || task.description.includes('לולים');

    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-md mb-1 cursor-pointer transition-colors border
                ${task.isCompleted ? 'bg-slate-100 border-transparent opacity-60' : 'bg-white border-slate-100 hover:border-blue-300 shadow-sm'}
            `}
            onClick={() => toggle({ roomId, taskId: task._id, isCompleted: !task.isCompleted })}
        >
            <Checkbox checked={task.isCompleted} />
            <div className="flex-1">
                <span className={`text-sm ${task.isCompleted ? 'line-through text-slate-500' : 'font-medium text-slate-800'}`}>
                    {task.description}
                </span>
                <div className="flex gap-2">
                    {isBed && <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 bg-blue-50 px-1 rounded w-fit mt-1"><Bed size={10}/> נדרש להזמנה</span>}
                    {isCrib && <span className="text-[10px] text-pink-600 font-bold flex items-center gap-1 bg-pink-50 px-1 rounded w-fit mt-1"><Baby size={10}/> לתינוק</span>}
                </div>
            </div>
        </div>
    );
}