// ... (חלק ה-Imports נשאר זהה) ...
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent } from '@/components/ui/Card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input.jsx";
import { Checkbox } from "@/components/ui/Checkbox.jsx";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";
import {
    Hotel, CheckCircle2, Paintbrush, Search, Plus,
    ClipboardCheck, AlertCircle, CheckSquare, Wrench, Clock, Star
} from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchRooms = async (hotelId) => (await api.get(`/rooms/${hotelId}`)).data;

// ... (MaintenanceDashboardPage הראשית נשארת זהה עד ל-RoomManagementDialog) ...
export default function MaintenanceDashboardPage() {
    const [selectedHotelId, setSelectedHotelId] = useState(null);
    const [hotelName, setHotelName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState(null);
    const queryClient = useQueryClient();
    
    const { data: hotels = [] } = useQuery({
        queryKey: ['hotels'],
        queryFn: fetchHotels,
    });

    useEffect(() => {
        if (hotels.length > 0 && !selectedHotelId) {
            const zippori = hotels.find(h => h.name.includes('ציפורי בכפר')) || hotels[0];
            setSelectedHotelId(zippori._id);
            setHotelName(zippori.name);
        }
    }, [hotels, selectedHotelId]);

    const { data: rooms = [], isLoading } = useQuery({
        queryKey: ['rooms', selectedHotelId],
        queryFn: () => fetchRooms(selectedHotelId),
        enabled: !!selectedHotelId,
        refetchInterval: 3000 
    });

    const filteredRooms = useMemo(() => {
        if (!rooms) return [];
        return rooms.filter(r => r.roomNumber.includes(searchTerm));
    }, [rooms, searchTerm]);

    const activeRoomData = useMemo(() => {
        if (!selectedRoomId || !rooms) return null;
        return rooms.find(r => r._id === selectedRoomId);
    }, [rooms, selectedRoomId]);

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <div className="bg-white shadow-sm sticky top-0 z-10 border-b p-4 space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex gap-2 items-center">
                            <Paintbrush className="text-blue-600"/> תפעול וניקיון
                        </h1>
                        {hotelName && <p className="text-sm text-slate-500 mt-1 font-medium">{hotelName}</p>}
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="חפש מספר חדר..." className="pl-10 text-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="container mx-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {isLoading ? <p className="text-center col-span-full py-10">טוען חדרים...</p> : filteredRooms.map(room => (
                    <RoomCard key={room._id} room={room} onClick={() => setSelectedRoomId(room._id)} />
                ))}
            </div>

            {activeRoomData && (
                <RoomManagementDialog
                    room={activeRoomData}
                    hotelId={selectedHotelId}
                    isOpen={!!selectedRoomId}
                    onClose={() => setSelectedRoomId(null)}
                />
            )}
        </div>
    );
}

function RoomCard({ room, onClick }) {
    const isMaintenance = room.status === 'maintenance';
    const isClean = room.status === 'clean';
    const tasks = room.tasks || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const isPartial = !isClean && !isMaintenance && completedTasks > 0;

    let cardStyle = 'bg-white border-slate-200';
    let icon = <ClipboardCheck size={16}/>;
    let text = `${totalTasks - completedTasks} משימות`;
    let textColor = 'text-slate-600';

    if (isMaintenance) {
        cardStyle = 'bg-red-50 border-red-500 shadow-red-100';
        icon = <Wrench size={16}/>;
        text = 'בתיקון / תקול';
        textColor = 'text-red-700';
    } else if (isClean) {
        cardStyle = 'bg-green-50 border-green-500 shadow-green-100';
        icon = <CheckCircle2 size={16}/>;
        text = 'נקי ומוכן';
        textColor = 'text-green-700';
    } else if (isPartial) {
        cardStyle = 'bg-amber-50 border-amber-400 shadow-amber-100';
        icon = <Paintbrush size={16}/>;
        text = `בתהליך (${completedTasks}/${totalTasks})`;
        textColor = 'text-amber-700';
    }

    return (
        <Card className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg border-t-4 ${cardStyle}`} onClick={onClick}>
            <CardContent className="p-4 text-center flex flex-col justify-between h-full min-h-[100px]">
                <div>
                    <div className="text-3xl font-black text-slate-800">{room.roomNumber}</div>
                    <div className="text-xs text-slate-500 font-medium">{room.roomType?.name}</div>
                </div>
                <div className={`flex items-center justify-center gap-2 font-bold text-sm mt-3 ${textColor}`}>
                    {icon}<span>{text}</span>
                </div>
            </CardContent>
        </Card>
    );
}

// --- ✨ כאן מתרחש הקסם: 3 שכבות ויזואליות ---
function RoomManagementDialog({ room, hotelId, isOpen, onClose }) {
    const [newTaskText, setNewTaskText] = useState('');
    const [isTemporary, setIsTemporary] = useState(true);
    const queryClient = useQueryClient();
    const queryKey = ['rooms', hotelId];

    // ... (אותן מוטציות אופטימיות כפי שהיו קודם, ללא שינוי בקוד המוטציה) ...
    // קיצור לצורך קריאות: אני מניח שאתה משתמש במוטציות מהקובץ הקודם.
    // אם צריך אותן שוב, תגיד לי. 
    // בוא נניח שהן כאן.
    
    // --- שחזור המוטציות לביטחון ---
    const addTaskMutation = useMutation({
        mutationFn: (data) => api.post(`/rooms/${room._id}/tasks`, data),
        onMutate: async (vars) => {
            await queryClient.cancelQueries(queryKey);
            const previousRooms = queryClient.getQueryData(queryKey);
            queryClient.setQueryData(queryKey, (oldRooms) => {
                return oldRooms.map(r => {
                    if (r._id === room._id) {
                        // קביעת סוג זמני לצורך תצוגה
                        const type = vars.isTemporary ? 'daily' : 'maintenance';
                        const tempTask = {
                            _id: Math.random().toString(),
                            description: vars.description,
                            isCompleted: false,
                            type: type,
                            temp: true
                        };
                        return { ...r, tasks: [...r.tasks, tempTask], status: 'dirty' };
                    }
                    return r;
                });
            });
            setNewTaskText('');
            return { previousRooms };
        },
        onError: (err, v, context) => queryClient.setQueryData(queryKey, context.previousRooms),
        onSettled: () => queryClient.invalidateQueries(queryKey)
    });

    const toggleTaskMutation = useMutation({
        mutationFn: ({ taskId, isCompleted }) => api.patch(`/rooms/${room._id}/tasks/${taskId}`, { isCompleted }),
        onMutate: async ({ taskId, isCompleted }) => {
            await queryClient.cancelQueries(queryKey);
            const previousRooms = queryClient.getQueryData(queryKey);
            queryClient.setQueryData(queryKey, (oldRooms) => {
                return oldRooms.map(r => {
                    if (r._id === room._id) {
                        const updatedTasks = r.tasks.map(t => t._id === taskId ? { ...t, isCompleted } : t);
                        return { ...r, tasks: updatedTasks };
                    }
                    return r;
                });
            });
            return { previousRooms };
        },
        onError: (err, v, context) => queryClient.setQueryData(queryKey, context.previousRooms),
        onSettled: () => queryClient.invalidateQueries(queryKey)
    });

    const setStatusMutation = useMutation({
        mutationFn: (status) => api.patch(`/rooms/${room._id}/status`, { status }),
        onMutate: async (status) => {
            await queryClient.cancelQueries(queryKey);
            const previousRooms = queryClient.getQueryData(queryKey);
            queryClient.setQueryData(queryKey, (oldRooms) => oldRooms.map(r => r._id === room._id ? { ...r, status } : r));
            onClose();
            return { previousRooms };
        },
        onError: (err, v, context) => queryClient.setQueryData(queryKey, context.previousRooms),
        onSettled: () => { queryClient.invalidateQueries(queryKey); toast.success('סטטוס עודכן!'); }
    });

    const handleAddTask = () => {
        if(newTaskText.trim()) {
            addTaskMutation.mutate({ description: newTaskText, isTemporary });
        }
    };

    // ✨ חלוקה ל-3 קבוצות
    const maintenanceTasks = room.tasks.filter(t => t.type === 'maintenance');
    const dailyTasks = room.tasks.filter(t => t.type === 'daily');
    const standardTasks = room.tasks.filter(t => t.type === 'standard' || (!t.type && t.isSystemTask)); // תמיכה לאחור

    const TaskItem = ({ task }) => (
        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
             task.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm hover:border-blue-300'
        }`}
        onClick={() => !task.temp && toggleTaskMutation.mutate({ taskId: task._id, isCompleted: !task.isCompleted })}>
            <Checkbox checked={task.isCompleted} onCheckedChange={()=>{}} disabled={task.temp}/>
            <span className={`flex-1 ${task.isCompleted ? 'line-through' : 'font-medium'}`}>
                {task.description} {task.temp && '(...)'}
            </span>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl flex justify-between items-center">
                        <span>חדר {room.roomNumber}</span>
                        <span className={`text-sm px-3 py-1 rounded-full ${
                            room.status === 'clean' ? 'bg-green-100 text-green-800' :
                            room.status === 'maintenance' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                            {room.status === 'clean' ? 'נקי' : room.status === 'maintenance' ? 'בתיקון' : 'לא נקי'}
                        </span>
                    </DialogTitle>
                    <DialogDescription>צ'ק ליסט מבצעי יומי</DialogDescription>
                </DialogHeader>

                <div className="flex-1 space-y-6 py-2 overflow-y-auto">
                    
                    {/* שכבה ג': תקלות (אדום - הכי חשוב) */}
                    {maintenanceTasks.length > 0 && (
                        <div className="space-y-2 border-r-4 border-red-500 pr-3 bg-red-50/50 p-2 rounded">
                            <h3 className="font-bold text-red-700 flex items-center gap-2"><AlertCircle size={16}/> תקלות פתוחות</h3>
                            {maintenanceTasks.map(t => <TaskItem key={t._id} task={t} />)}
                        </div>
                    )}

                    {/* שכבה ב': דגשים יומיים (צהוב - שים לב) */}
                    {dailyTasks.length > 0 && (
                        <div className="space-y-2 border-r-4 border-amber-400 pr-3 bg-amber-50/50 p-2 rounded">
                            <h3 className="font-bold text-amber-700 flex items-center gap-2"><Star size={16}/> דגשים להיום</h3>
                            {dailyTasks.map(t => <TaskItem key={t._id} task={t} />)}
                        </div>
                    )}

                    {/* שכבה א': סטנדרט (כחול/אפור - השגרה) */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><CheckSquare size={16}/> נוהל ניקיון רגיל</h3>
                        <div className="bg-slate-50 p-2 rounded-lg space-y-2">
                            {standardTasks.map(t => <TaskItem key={t._id} task={t} />)}
                            {standardTasks.length === 0 && <p className="text-gray-400 text-sm p-2">לא הוגדר נוהל קבוע.</p>}
                        </div>
                    </div>

                    {/* אזור הוספה (מנהלים/עובדים) */}
                    <div className="bg-white p-3 rounded border border-dashed border-slate-300">
                        <label className="text-sm font-bold text-slate-700 mb-2 block">הוספת דיווח / בקשה:</label>
                        <div className="flex gap-2 mb-2">
                            <Input 
                                placeholder={isTemporary ? "בקשה להיום (לול, יין...)" : "דיווח תקלה קבועה (מזגן...)"} 
                                value={newTaskText}
                                onChange={e => setNewTaskText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                            />
                            <Button onClick={handleAddTask} size="icon"><Plus/></Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="temp-mode" checked={isTemporary} onCheckedChange={setIsTemporary} />
                            <Label htmlFor="temp-mode" className="text-xs text-slate-600">
                                {isTemporary ? 'זמני להיום (דגש)' : 'תקלה קבועה (תחזוקה)'}
                            </Label>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-between items-center border-t pt-4 mt-2">
                    <Button variant="destructive" className="w-full sm:w-auto gap-2" onClick={() => setStatusMutation.mutate('maintenance')}>
                        <Wrench size={16}/> תקול
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" className="flex-1" onClick={() => setStatusMutation.mutate('dirty')}>לא נקי</Button>
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 gap-2" onClick={() => setStatusMutation.mutate('clean')}>
                            <CheckCircle2 size={16}/> סיום ואישור
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
