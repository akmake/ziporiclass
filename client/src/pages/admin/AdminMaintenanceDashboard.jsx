import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/utils/api.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import {
    Paintbrush, Wrench, PlusCircle, CalendarDays, ListChecks,
    CheckCircle2, AlertTriangle, XCircle, ArrowRight, Activity, Hotel, BedDouble
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const fetchAllRoomsStats = async () => {
    const { data } = await api.get('/rooms/all');
    const uniqueHotels = new Set(data.map(r => r.hotel?._id));
    return { rooms: data, hotelCount: uniqueHotels.size };
};

export default function AdminMaintenanceDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['adminMaintenanceStats'],
        queryFn: fetchAllRoomsStats,
        refetchInterval: 30000
    });

    const stats = useMemo(() => {
        if (!data?.rooms) return { total: 0, clean: 0, dirty: 0, maintenance: 0, tasks: 0 };

        const rooms = data.rooms;
        return {
            total: rooms.length,
            clean: rooms.filter(r => r.status === 'clean').length,
            dirty: rooms.filter(r => r.status === 'dirty').length,
            maintenance: rooms.filter(r => r.status === 'maintenance').length,
            tasks: rooms.reduce((acc, r) => acc + (r.tasks?.filter(t => !t.isCompleted).length || 0), 0)
        };
    }, [data]);

    const chartData = [
        { name: 'נקיים', value: stats.clean, color: '#22c55e' },
        { name: 'ממתינים', value: stats.dirty, color: '#ef4444' },
        { name: 'תקלות', value: stats.maintenance, color: '#f59e0b' },
    ];

    // הגדרת כפתורי הניווט של מערכת התפעול
    const managementLinks = [
        {
            title: "סידור עבודה יומי",
            desc: "הכנת חדרים למחר (Stayover / Checkout)",
            icon: CalendarDays,
            to: "/admin/daily-plan",
            color: "text-blue-600",
            bg: "bg-blue-50"
        },
        {
            title: "תמונת מצב (Live)",
            desc: "צפייה בלוח החדרים בזמן אמת",
            icon: Activity,
            to: "/admin/rooms-status",
            color: "text-green-600",
            bg: "bg-green-50"
        },
        {
            title: "ניהול נהלים (צ'ק ליסט)",
            desc: "הגדרת רשימות ניקיון לכל מלון",
            icon: ListChecks,
            to: "/admin/hotels", // או נתיב ייעודי אם יש
            color: "text-purple-600",
            bg: "bg-purple-50"
        },
        {
            title: "הקמת חדרים",
            desc: "הוספת חדרים וטווחים חדשים",
            icon: BedDouble,
            to: "/admin/rooms/create",
            color: "text-slate-600",
            bg: "bg-slate-100"
        }
    ];

    if (isLoading) return <div className="p-10 text-center">טוען נתוני תפעול...</div>;

    return (
        <div className="container mx-auto p-6 space-y-8 min-h-screen bg-slate-50">

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <Wrench className="text-amber-600" /> מערכת תפעול וחדרים
                    </h1>
                    <p className="text-slate-500 mt-1">ניהול מרכזי: ניקיון, אחזקה, סידורי עבודה והגדרות חדרים.</p>
                </div>
                <Button asChild className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
                    <Link to="/maintenance">
                        <Paintbrush size={16} /> מעבר למסך עובד שטח
                    </Link>
                </Button>
            </header>

            {/* שורת הסטטיסטיקה */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-slate-500">סה"כ חדרים במערכת</p>
                        <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.total}</h3>
                        <p className="text-xs text-slate-400 mt-1">פרוסים ב-{data?.hotelCount} מלונות</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/30">
                    <CardContent className="p-6 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-green-700">נקיים ומוכנים</p>
                            <h3 className="text-3xl font-bold text-green-800 mt-2">{stats.clean}</h3>
                        </div>
                        <CheckCircle2 className="text-green-200 h-10 w-10" />
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500 shadow-sm bg-red-50/30">
                    <CardContent className="p-6 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-red-700">ממתינים לניקיון</p>
                            <h3 className="text-3xl font-bold text-red-800 mt-2">{stats.dirty}</h3>
                        </div>
                        <XCircle className="text-red-200 h-10 w-10" />
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500 shadow-sm bg-amber-50/30">
                    <CardContent className="p-6 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-amber-700">תקלות / בטיפול</p>
                            <h3 className="text-3xl font-bold text-amber-800 mt-2">{stats.maintenance}</h3>
                        </div>
                        <AlertTriangle className="text-amber-200 h-10 w-10" />
                    </CardContent>
                </Card>
            </div>

            {/* אזור הניהול והגרף */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* תפריט פעולות מהירות */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-700">ניהול שוטף</h2>
                    <div className="grid grid-cols-1 gap-4">
                        {managementLinks.map((link, idx) => (
                            <Link key={idx} to={link.to}>
                                <Card className="hover:shadow-md transition-all cursor-pointer border-slate-200 hover:border-slate-300">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${link.bg} ${link.color}`}>
                                            <link.icon size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-800">{link.title}</h3>
                                            <p className="text-xs text-slate-500">{link.desc}</p>
                                        </div>
                                        <ArrowRight className="text-slate-300" size={18}/>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>

                    {stats.tasks > 0 && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 mt-6">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-1" />
                            <div>
                                <h4 className="font-bold text-amber-800">שים לב!</h4>
                                <p className="text-sm text-amber-700 mt-1">
                                    ישנן כרגע <strong>{stats.tasks}</strong> משימות פתוחות בכלל החדרים הדורשות התייחסות.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* גרף החדרים */}
                <Card className="lg:col-span-2 shadow-md flex flex-col">
                    <CardHeader>
                        <CardTitle>התפלגות סטטוסים</CardTitle>
                        <CardDescription>תמונת מצב גרפית של כלל המלונות</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[300px] flex items-center justify-center">
                        <div style={{ width: '100%', height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 14, fontWeight: 'bold'}} />
                                    <Tooltip 
                                        cursor={{fill: 'transparent'}}
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={50}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}