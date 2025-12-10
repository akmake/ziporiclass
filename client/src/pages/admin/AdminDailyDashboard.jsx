import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { 
    Hotel, Users, BedDouble, CalendarCheck, 
    ArrowUpRight, ArrowDownLeft, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { Link } from 'react-router-dom';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;

// שימוש בנתיב החדש והחכם שמביא נתונים משולבים
const fetchDashboardData = async (hotelId) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await api.get(`/bookings/daily?hotelId=${hotelId}&date=${today}`);
    return data;
};

export default function DashboardPage() {
    const [selectedHotel, setSelectedHotel] = useState(null);

    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });

    useEffect(() => {
        if (hotels.length > 0 && !selectedHotel) setSelectedHotel(hotels[0]._id);
    }, [hotels]);

    const { data: rooms = [], isLoading } = useQuery({
        queryKey: ['dashboardData', selectedHotel],
        queryFn: () => fetchDashboardData(selectedHotel),
        enabled: !!selectedHotel
    });

    // חישוב סטטיסטיקות מתוך הנתונים שהגיעו מהשרת החדש
    const stats = {
        total: rooms.length,
        clean: rooms.filter(r => r.status === 'clean').length,
        dirty: rooms.filter(r => r.status !== 'clean').length,
        arrivals: rooms.filter(r => r.dashboardStatus === 'arrival' || r.dashboardStatus === 'back_to_back').length,
        departures: rooms.filter(r => r.dashboardStatus === 'departure' || r.dashboardStatus === 'back_to_back').length,
        occupied: rooms.filter(r => ['stayover', 'arrival', 'back_to_back'].includes(r.dashboardStatus)).length
    };

    return (
        <div className="container mx-auto p-6 space-y-8 bg-slate-50 min-h-screen" dir="rtl">
            
            {/* כותרת ובחירת מלון */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">לוח בקרה ראשי</h1>
                    <p className="text-slate-500">סקירה יומית ופעולות מהירות</p>
                </div>
                {hotels.length > 0 && (
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                        <Hotel className="text-slate-400" size={20}/>
                        <select 
                            className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
                            value={selectedHotel || ''} 
                            onChange={(e) => setSelectedHotel(e.target.value)}
                        >
                            {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* כרטיסי סטטיסטיקה */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard 
                    title="חדרים במלון" 
                    value={stats.total} 
                    icon={BedDouble} 
                    color="text-slate-600" 
                    bg="bg-slate-100"
                />
                <StatCard 
                    title="הגעות היום" 
                    value={stats.arrivals} 
                    icon={ArrowDownLeft} 
                    color="text-blue-600" 
                    bg="bg-blue-50"
                />
                <StatCard 
                    title="עזיבות היום" 
                    value={stats.departures} 
                    icon={ArrowUpRight} 
                    color="text-red-600" 
                    bg="bg-red-50"
                />
                <StatCard 
                    title="תפוסה" 
                    value={`${stats.occupied}`} 
                    subtext={`מתוך ${stats.total}`}
                    icon={Users} 
                    color="text-purple-600" 
                    bg="bg-purple-50"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* סטטוס ניקיון */}
                <Card className="lg:col-span-2 shadow-sm border-slate-200">
                    <CardHeader className="border-b border-slate-100 pb-3">
                        <CardTitle className="text-lg flex justify-between items-center">
                            <span>סטטוס חדרים בזמן אמת</span>
                            <div className="flex gap-3 text-sm font-normal">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> נקי ({stats.clean})</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> מלוכלך ({stats.dirty})</span>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 max-h-[400px] overflow-y-auto">
                        {isLoading ? <p>טוען...</p> : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                {rooms.map(room => (
                                    <div 
                                        key={room._id} 
                                        className={`
                                            aspect-square flex flex-col items-center justify-center rounded-lg border-2 text-xs font-bold transition-all
                                            ${room.status === 'clean' 
                                                ? 'bg-green-50 border-green-200 text-green-700' 
                                                : 'bg-white border-pink-200 text-slate-700 shadow-sm'}
                                        `}
                                    >
                                        <span className="text-sm">{room.roomNumber}</span>
                                        {/* תצוגה מותאמת לנתונים החדשים מהשרת */}
                                        {room.dashboardStatus === 'arrival' && <span className="text-[10px] text-blue-600">הגעה</span>}
                                        {room.dashboardStatus === 'departure' && <span className="text-[10px] text-red-600">עזיבה</span>}
                                        {room.dashboardStatus === 'back_to_back' && <span className="text-[10px] text-purple-600">תחלופה</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* קיצורי דרך */}
                <div className="space-y-4">
                    <Card className="bg-blue-900 text-white border-none shadow-md">
                        <CardContent className="p-6">
                            <h3 className="text-xl font-bold mb-2">סידור עבודה יומי</h3>
                            <p className="text-blue-100 text-sm mb-4">צפייה בשיבוצים, הזנת הערות והפצת הוראות (מיטות/עריסות) לחדרניות.</p>
                            <Link to="/admin/daily-plan" className="block w-full bg-white text-blue-900 text-center py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors">
                                מעבר לסידור עבודה
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader><CardTitle className="text-lg">פעולות מהירות</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <Link to="/admin/bookings" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                                <div className="bg-orange-100 p-2 rounded-full text-orange-600"><CalendarCheck size={18}/></div>
                                <span className="font-medium text-slate-700">קליטת אקסל הזמנות</span>
                            </Link>
                            <Link to="/admin/room-assignment" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                                <div className="bg-purple-100 p-2 rounded-full text-purple-600"><Users size={18}/></div>
                                <span className="font-medium text-slate-700">שיבוץ חדרים לעובדים</span>
                            </Link>
                            <Link to="/maintenance" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                                <div className="bg-gray-100 p-2 rounded-full text-gray-600"><AlertCircle size={18}/></div>
                                <span className="font-medium text-slate-700">תפעול וסטטוס חדרים</span>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, subtext, icon: Icon, color, bg }) {
    return (
        <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs font-bold uppercase">{title}</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-1">{value}</h3>
                    {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-full ${bg} ${color}`}>
                    <Icon size={24} />
                </div>
            </CardContent>
        </Card>
    );
}