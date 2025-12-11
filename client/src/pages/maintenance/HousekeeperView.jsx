import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Progress } from '@/components/ui/Progress.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Input } from '@/components/ui/Input.jsx';
import { 
    Paintbrush, RefreshCw, Trophy, ArrowUpDown, AlertTriangle 
} from 'lucide-react';
import RoomCard from '@/components/maintenance/RoomCard.jsx';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const fetchMyRooms = async (hotelId) => (await api.get(`/rooms/${hotelId}`)).data;

export default function HousekeeperView() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [isPrioritySort, setIsPrioritySort] = useState(false); // false = לפי חדר, true = לפי דחיפות
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportText, setReportText] = useState('');
    const [reportingRoomId, setReportingRoomId] = useState(null);

    const queryClient = useQueryClient();
    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });

    useEffect(() => {
        if (hotels.length > 0 && !selectedHotel) setSelectedHotel(hotels[1]._id);
    }, [hotels]);

    const { data: rooms = [], isLoading, isFetching } = useQuery({
        queryKey: ['myRooms', selectedHotel],
        queryFn: () => fetchMyRooms(selectedHotel),
        enabled: !!selectedHotel,
    });

    // --- מוטציות ---
    
    const toggleTaskMutation = useMutation({
        mutationFn: ({ roomId, taskId, isCompleted }) =>
            api.patch(`/rooms/${roomId}/tasks/${taskId}`, { isCompleted }),
        onSuccess: () => queryClient.invalidateQueries(['myRooms', selectedHotel]),
        onError: () => toast.error("שגיאה בעדכון משימה")
    });

    const statusMutation = useMutation({
        mutationFn: ({ roomId, status }) => api.patch(`/rooms/${roomId}/status`, { status }),
        onSuccess: () => {
            toast.success('סטטוס חדר עודכן!');
            queryClient.invalidateQueries(['myRooms', selectedHotel]);
        },
        onError: () => toast.error("שגיאה בעדכון סטטוס")
    });

    const reportIssueMutation = useMutation({
        mutationFn: ({ roomId, description }) =>
            api.post(`/rooms/${roomId}/tasks`, { description, isTemporary: false }),
        onSuccess: () => {
            toast.success('תקלה דווחה למשרד');
            setIsReportOpen(false);
            setReportText('');
            queryClient.invalidateQueries(['myRooms', selectedHotel]);
        }
    });

    // --- לוגיקה ---

    // 1. סטטיסטיקה יומית
    const stats = useMemo(() => {
        if (!rooms.length) return { total: 0, completed: 0, percent: 0 };
        const total = rooms.length;
        const completed = rooms.filter(r => r.status === 'clean').length;
        const percent = Math.round((completed / total) * 100);
        return { total, completed, percent };
    }, [rooms]);

    // 2. מיון החדרים
    const sortedRooms = useMemo(() => {
        const baseRooms = [...rooms];

        // מיון ברירת מחדל: לפי מספר חדר (פיזי)
        baseRooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

        // אם המשתמש בחר מיון לפי דחיפות - ממיינים מחדש
        if (isPrioritySort) {
            return baseRooms.sort((a, b) => {
                // קודם מלוכלכים
                const aIsClean = a.status === 'clean';
                const bIsClean = b.status === 'clean';
                if (aIsClean && !bIsClean) return 1;
                if (!aIsClean && bIsClean) return -1;

                // בתוך המלוכלכים: לפי דחיפות
                const priorityScore = (status) => {
                    if (status === 'back_to_back') return 4;
                    if (status === 'arrival') return 3;
                    if (status === 'departure') return 2;
                    return 1;
                };
                
                const scoreA = priorityScore(a.dashboardStatus);
                const scoreB = priorityScore(b.dashboardStatus);
                
                if (scoreA !== scoreB) return scoreB - scoreA; // הגבוה ראשון
                return 0; // אם הדחיפות זהה, נשאר המיון המקורי (מספר חדר)
            });
        }

        return baseRooms;
    }, [rooms, isPrioritySort]);

    const handleOpenReport = (roomId) => {
        setReportingRoomId(roomId);
        setIsReportOpen(true);
    };

    const handleReportSubmit = () => {
        if (!reportText.trim() || !reportingRoomId) return;
        reportIssueMutation.mutate({ roomId: reportingRoomId, description: reportText });
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24 font-sans" dir="rtl">
            
            {/* Header */}
            <header className="bg-white px-4 py-3 shadow-sm sticky top-0 z-30 border-b border-gray-100">
                <div className="flex justify-between items-center mb-3">
                    <div>
                        <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
                            <Paintbrush className="text-purple-600 h-6 w-6"/> המשימות שלי
                        </h1>
                        <p className="text-xs text-gray-500">
                            {hotels.find(h => h._id === selectedHotel)?.name || 'טוען...'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {/* כפתור החלפת מיון */}
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setIsPrioritySort(!isPrioritySort)}
                            className={`h-9 px-3 text-xs gap-2 ${isPrioritySort ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-600'}`}
                        >
                            <ArrowUpDown size={14}/>
                            {isPrioritySort ? 'לפי דחיפות' : 'לפי חדר'}
                        </Button>

                        <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries(['myRooms'])}>
                            <RefreshCw className={`h-5 w-5 text-gray-400 ${isFetching ? 'animate-spin' : ''}`}/>
                        </Button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <div className="flex justify-between text-xs font-bold text-purple-800 mb-1">
                        <span className="flex items-center gap-1"><Trophy size={14}/> ההתקדמות להיום</span>
                        <span>{stats.completed} / {stats.total} חדרים</span>
                    </div>
                    <Progress value={stats.percent} className="h-2.5 bg-purple-200" />
                </div>
            </header>

            {/* רשימת החדרים */}
            <div className="p-4 space-y-4 max-w-xl mx-auto">
                {isLoading ? (
                    <div className="text-center py-20 opacity-50">טוען חדרים...</div>
                ) : sortedRooms.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <p>אין חדרים ברשימה כרגע.</p>
                    </div>
                ) : (
                    sortedRooms.map(room => (
                        <RoomCard 
                            key={room._id} 
                            room={room}
                            onToggleTask={(roomId, taskId, isCompleted) => toggleTaskMutation.mutate({ roomId, taskId, isCompleted })}
                            onFinishRoom={(roomId) => statusMutation.mutate({ roomId, status: 'clean' })}
                            onReportIssue={() => handleOpenReport(room._id)}
                        />
                    ))
                )}
            </div>

            {/* דיאלוג דיווח מהיר */}
            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent className="w-[90%] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>דיווח על תקלה</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input
                            placeholder="מה הבעיה? (למשל: אין מים חמים)"
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                            className="text-lg py-6"
                            autoFocus
                        />
                        <div className="flex flex-wrap gap-2">
                            {['נורה שרופה', 'מזגן מטפטף', 'חסר מגבות', 'כתם בספה'].map(tag => (
                                <button 
                                    key={tag}
                                    onClick={() => setReportText(tag)}
                                    className="text-xs bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="flex-row gap-2 mt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setIsReportOpen(false)}>ביטול</Button>
                        <Button className="flex-1 bg-red-600" onClick={handleReportSubmit}>שלח דיווח</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}