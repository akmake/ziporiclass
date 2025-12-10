import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Card, CardContent } from '@/components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { CalendarDays, Save, RefreshCw, Hotel, Bed, Baby } from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const publishPlan = (plan) => api.post('/rooms/daily-plan', { plan });

export default function DailyPlanPage() {
    const queryClient = useQueryClient();

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [notesDraft, setNotesDraft] = useState({}); // רק הערות, המערכת יודעת לבד את המיטות

    const { data: hotels = [] } = useQuery({
        queryKey: ['hotels'],
        queryFn: fetchHotels
    });

    useEffect(() => {
        if (hotels.length > 0 && !selectedHotel) {
            setSelectedHotel(hotels[0]._id);
        }
    }, [hotels]);

    const { data: roomsData = [], isLoading } = useQuery({
        queryKey: ['dailyDashboardPlan', { hotelId: selectedHotel, date: selectedDate }],
        queryFn: async () => {
            if (!selectedHotel) return [];
            const { data } = await api.get(`/bookings/daily?hotelId=${selectedHotel}&date=${selectedDate}`);
            return data;
        },
        enabled: !!selectedHotel
    });

    const publishMutation = useMutation({
        mutationFn: publishPlan,
        onSuccess: (res) => {
            toast.success(res.data.message);
            // מנקים הערות שכבר נשלחו כדי לא לשלוח שוב
            setNotesDraft({});
        },
        onError: () => toast.error('שגיאה בהפצה')
    });

    const handlePublish = () => {
        // אנחנו שולחים את כל החדרים הרלוונטיים כדי שהשרת ירענן את נתוני המיטות שלהם
        // + הערות אם נכתבו
        const payload = roomsData.map(room => ({
            roomId: room._id,
            note: notesDraft[room._id] || ''
        }));

        if (window.confirm(`האם לרענן נתוני הזמנות (מיטות/עריסות) עבור ${payload.length} חדרים?`)) {
            publishMutation.mutate({ plan: payload });
        }
    };

    const getStatusLabel = (status) => {
        const map = {
            'arrival': { text: 'הגעה', color: 'text-blue-700 bg-blue-100 border-blue-200' },
            'departure': { text: 'עזיבה', color: 'text-red-700 bg-red-100 border-red-200' },
            'stayover': { text: 'נשאר', color: 'text-amber-700 bg-amber-100 border-amber-200' },
            'back_to_back': { text: 'תחלופה', color: 'text-purple-700 bg-purple-100 border-purple-200' },
            'empty': { text: 'ריק', color: 'text-gray-400 bg-gray-50 border-gray-100' }
        };
        return map[status] || map['empty'];
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 min-h-screen bg-slate-50 space-y-6" dir="rtl">
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <CalendarDays className="text-blue-600"/> סידור עבודה (הזמנות)
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">צפייה בשיבוצים והפצת נתוני מיטות/עריסות לחדרים.</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500">תאריך:</span>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border rounded px-2 py-1 text-sm"/>
                    </div>
                    <Button onClick={handlePublish} disabled={publishMutation.isPending} className="bg-green-600 hover:bg-green-700 shadow-md h-10 px-6">
                        {publishMutation.isPending ? <RefreshCw className="animate-spin ml-2"/> : <Save className="ml-2"/>}
                        הפץ / רענן חדרים
                    </Button>
                </div>
            </header>

            <Tabs value={selectedHotel} onValueChange={setSelectedHotel} className="w-full">
                <TabsList className="bg-white p-1 border w-full justify-start overflow-x-auto h-auto">
                    {hotels.map(hotel => (
                        <TabsTrigger key={hotel._id} value={hotel._id} className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 px-4 py-2">
                            <Hotel className="w-4 h-4 ml-2"/> {hotel.name}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value={selectedHotel || 'none'}>
                    <Card>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-10 text-center text-gray-500">טוען נתונים...</div>
                            ) : roomsData.length === 0 ? (
                                <div className="p-10 text-center text-gray-500">אין חדרים במלון זה.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-slate-50 text-slate-600 border-b">
                                            <tr>
                                                <th className="p-4 w-24">חדר</th>
                                                <th className="p-4 w-32">סטטוס (אקסל)</th>
                                                <th className="p-4 w-48">פרטי הזמנה</th>
                                                <th className="p-4">הערות לחדרנית (אופציונלי)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {roomsData.map(room => {
                                                const statusMeta = getStatusLabel(room.dashboardStatus);
                                                const info = room.bookingInfo;

                                                return (
                                                    <tr key={room._id} className="hover:bg-blue-50/10 transition-colors">
                                                        <td className="p-4 font-bold text-lg">{room.roomNumber}</td>

                                                        <td className="p-4">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.color}`}>
                                                                {statusMeta.text}
                                                            </span>
                                                        </td>

                                                        <td className="p-4">
                                                            {info ? (
                                                                <div className="flex gap-3 text-xs">
                                                                    {info.pax > 0 && <span className="flex items-center gap-1 font-bold text-slate-700"><Bed size={14} className="text-blue-500"/> {info.pax}</span>}
                                                                    {info.babies > 0 && <span className="flex items-center gap-1 font-bold text-slate-700"><Baby size={14} className="text-pink-500"/> {info.babies}</span>}
                                                                    {info.out > 0 && <span className="text-red-500 font-medium">עוזבים: {info.out}</span>}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300">-</span>
                                                            )}
                                                        </td>

                                                        <td className="p-4">
                                                            <Input 
                                                                placeholder="הוסף הערה..." 
                                                                value={notesDraft[room._id] || ''}
                                                                onChange={(e) => setNotesDraft(prev => ({ ...prev, [room._id]: e.target.value }))}
                                                                className="bg-transparent border-transparent hover:border-slate-200 focus:bg-white transition-all max-w-md"
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