import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Card, CardContent } from '@/components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { 
    CalendarDays, Save, RefreshCw, Hotel, 
    Bed, Baby, ArrowRightLeft, LogIn, LogOut, Home 
} from 'lucide-react';

// שליפת רשימת מלונות
const fetchHotels = async () => (await api.get('/admin/hotels')).data;

// שליפת נתוני דשבורד ליום ספציפי (מגיע מ-bookingController)
const fetchDailyDashboard = async (hotelId, date) => {
    if (!hotelId) return [];
    const { data } = await api.get(`/bookings/daily?hotelId=${hotelId}&date=${date}`);
    return data;
};

// הפצת התוכנית לחדרים (שולח ל-roomController)
const publishPlan = (plan) => api.post('/rooms/daily-plan', { plan });

export default function DailyPlanPage() {
    const queryClient = useQueryClient();

    // ברירת מחדל: התאריך של היום
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [notesDraft, setNotesDraft] = useState({}); // שמירת הערות זמניות לפני שליחה

    // 1. טעינת מלונות
    const { data: hotels = [] } = useQuery({
        queryKey: ['hotels'],
        queryFn: fetchHotels
    });

    // בחירה אוטומטית של המלון הראשון
    useEffect(() => {
        if (hotels.length > 0 && !selectedHotel) {
            setSelectedHotel(hotels[0]._id);
        }
    }, [hotels]);

    // 2. טעינת הנתונים לטבלה (מי מגיע, מי עוזב, כמה מיטות)
    const { data: roomsData = [], isLoading, isFetching } = useQuery({
        queryKey: ['dailyDashboardPlan', selectedHotel, selectedDate],
        queryFn: () => fetchDailyDashboard(selectedHotel, selectedDate),
        enabled: !!selectedHotel
    });

    // 3. פעולת ההפצה (כפתור ירוק)
    const publishMutation = useMutation({
        mutationFn: publishPlan,
        onSuccess: (res) => {
            toast.success(res.data.message);
            // מנקים את ההערות מהזיכרון כי הן כבר נשמרו בשרת
            setNotesDraft({});
            // מרעננים את הנתונים כדי לראות שהכל מעודכן
            queryClient.invalidateQueries(['dailyDashboardPlan']);
        },
        onError: () => toast.error('שגיאה בהפצת הנתונים')
    });

    const handlePublish = () => {
        // מכינים את המידע לשליחה לשרת
        // אנחנו שולחים את כל החדרים שמופיעים ברשימה כדי שיתעדכנו
        const payload = roomsData.map(room => ({
            roomId: room._id,
            note: notesDraft[room._id] || '' // אם המנהל כתב הערה, מצרפים אותה
        }));

        if (window.confirm(`האם לרענן נתוני מיטות ועריסות עבור ${payload.length} חדרים?`)) {
            publishMutation.mutate({ plan: payload });
        }
    };

    // פונקציית עזר לתרגום סטטוסים לצבעים ואייקונים
    const getStatusBadge = (status) => {
        switch (status) {
            case 'arrival':
                return <span className="flex items-center gap-1 text-blue-700 bg-blue-100 border border-blue-200 px-2 py-1 rounded text-xs font-bold"><LogIn size={12}/> הגעה</span>;
            case 'departure':
                return <span className="flex items-center gap-1 text-red-700 bg-red-100 border border-red-200 px-2 py-1 rounded text-xs font-bold"><LogOut size={12}/> עזיבה</span>;
            case 'back_to_back':
                return <span className="flex items-center gap-1 text-purple-700 bg-purple-100 border border-purple-200 px-2 py-1 rounded text-xs font-bold"><ArrowRightLeft size={12}/> תחלופה</span>;
            case 'stayover':
                return <span className="flex items-center gap-1 text-amber-700 bg-amber-100 border border-amber-200 px-2 py-1 rounded text-xs font-bold"><Home size={12}/> נשאר</span>;
            default:
                return <span className="text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded text-xs">ריק</span>;
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 min-h-screen bg-slate-50 space-y-6" dir="rtl">
            
            {/* כותרת עליונה */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <CalendarDays className="text-blue-600"/> סידור עבודה יומי
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">צפייה בשיבוצים והפצת הוראות (מיטות/עריסות) לחדרניות.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-col w-full sm:w-auto">
                        <span className="text-xs text-gray-500 mb-1">תאריך לתצוגה:</span>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)} 
                            className="border rounded px-3 py-2 text-sm focus:outline-blue-500 bg-slate-50"
                        />
                    </div>
                    
                    <Button 
                        onClick={handlePublish} 
                        disabled={publishMutation.isPending || roomsData.length === 0} 
                        className="bg-green-600 hover:bg-green-700 shadow-md h-10 px-6 w-full sm:w-auto mt-auto"
                    >
                        {publishMutation.isPending ? <RefreshCw className="animate-spin ml-2"/> : <Save className="ml-2"/>}
                        הפץ לחדרניות
                    </Button>
                </div>
            </header>

            {/* בחירת מלון וטבלה */}
            <Tabs value={selectedHotel || ''} onValueChange={setSelectedHotel} className="w-full">
                
                <TabsList className="bg-white p-1 border w-full justify-start overflow-x-auto h-auto rounded-lg mb-4">
                    {hotels.map(hotel => (
                        <TabsTrigger 
                            key={hotel._id} 
                            value={hotel._id} 
                            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 px-4 py-2 text-sm"
                        >
                            <Hotel className="w-4 h-4 ml-2"/> {hotel.name}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value={selectedHotel || 'none'} className="mt-0">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            {isLoading || isFetching ? (
                                <div className="p-20 text-center text-gray-400 flex flex-col items-center">
                                    <RefreshCw className="animate-spin mb-2 h-8 w-8"/>
                                    <p>טוען נתונים...</p>
                                </div>
                            ) : roomsData.length === 0 ? (
                                <div className="p-20 text-center text-gray-400">
                                    <p>לא נמצאו חדרים במלון זה.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs tracking-wider font-semibold">
                                            <tr>
                                                <th className="p-4 w-24">מספר חדר</th>
                                                <th className="p-4 w-40">סטטוס (מהאקסל)</th>
                                                <th className="p-4 w-64">דרישות הזמנה</th>
                                                <th className="p-4">הערות לחדרנית (אופציונלי)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {roomsData.map(room => {
                                                const info = room.bookingInfo;
                                                const hasBooking = info && (info.pax > 0 || info.babies > 0);

                                                return (
                                                    <tr key={room._id} className="hover:bg-blue-50/20 transition-colors">
                                                        <td className="p-4">
                                                            <span className="font-bold text-lg text-slate-700">{room.roomNumber}</span>
                                                            <div className="text-xs text-slate-400">{room.roomType?.name}</div>
                                                        </td>

                                                        <td className="p-4">
                                                            {getStatusBadge(room.dashboardStatus)}
                                                        </td>

                                                        <td className="p-4">
                                                            {hasBooking ? (
                                                                <div className="flex gap-4">
                                                                    {info.pax > 0 && (
                                                                        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                                                                            <Bed size={16}/>
                                                                            <span className="font-bold">{info.pax}</span>
                                                                            <span className="text-xs opacity-75">מיטות</span>
                                                                        </div>
                                                                    )}
                                                                    {info.babies > 0 && (
                                                                        <div className="flex items-center gap-1.5 bg-pink-50 text-pink-700 px-2 py-1 rounded border border-pink-100">
                                                                            <Baby size={16}/>
                                                                            <span className="font-bold">{info.babies}</span>
                                                                            <span className="text-xs opacity-75">עריסות</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300 text-xs">- אין דרישות -</span>
                                                            )}
                                                            
                                                            {/* הצגת מידע על עזיבות אם רלוונטי */}
                                                            {info?.out > 0 && room.dashboardStatus === 'back_to_back' && (
                                                                <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                                    <LogOut size={10}/> עוזבים: {info.out}
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="p-4">
                                                            <Input 
                                                                placeholder="כתוב הערה (למשל: בקבוק יין, לסדר ספה...)" 
                                                                value={notesDraft[room._id] || ''}
                                                                onChange={(e) => setNotesDraft(prev => ({ ...prev, [room._id]: e.target.value }))}
                                                                className="bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-400 transition-all max-w-md h-9 text-sm"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}