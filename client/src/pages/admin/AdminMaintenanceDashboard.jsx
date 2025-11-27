import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/utils/api.js';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { 
    Paintbrush, Wrench, PlusCircle, 
    CheckCircle2, AlertTriangle, XCircle, ArrowRight 
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

    if (isLoading) return <div className="p-10 text-center">טוען נתוני תפעול...</div>;

    return (
        <div className="container mx-auto p-6 space-y-8 min-h-screen bg-slate-50">
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <Wrench className="text-blue-600" /> מרכז בקרה תפעולי
                    </h1>
                    <p className="text-slate-500 mt-1">ניהול מערך הנקיון, התחזוקה והחדרים במלונות.</p>
                </div>
                <div className="flex gap-3">
                    <Button asChild variant="outline" className="gap-2">
                        <Link to="/maintenance">
                            <Paintbrush size={16} /> מעבר למסך עובדים
                        </Link>
                    </Button>
                    <Button asChild className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        <Link to="/admin/rooms/create">
                            <PlusCircle size={16} /> הקמת חדרים
                        </Link>
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-slate-500">סך כל החדרים</p>
                        <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.total}</h3>
                        <p className="text-xs text-slate-400 mt-1">ב-{data?.hotelCount} מלונות</p>
                    </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/30">
                    <CardContent className="p-6 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-green-700">חדרים נקיים</p>
                            <h3 className="text-3xl font-bold text-green-800 mt-2">{stats.clean}</h3>
                        </div>
                        <CheckCircle2 className="text-green-200 h-10 w-10" />
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500 shadow-sm bg-red-50/30">
                    <CardContent className="p-6 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-red-700">ממתינים לנקיון</p>
                            <h3 className="text-3xl font-bold text-red-800 mt-2">{stats.dirty}</h3>
                        </div>
                        <XCircle className="text-red-200 h-10 w-10" />
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500 shadow-sm bg-amber-50/30">
                    <CardContent className="p-6 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-amber-700">תקלות פתוחות</p>
                            <h3 className="text-3xl font-bold text-amber-800 mt-2">{stats.maintenance}</h3>
                        </div>
                        <AlertTriangle className="text-amber-200 h-10 w-10" />
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <Card className="lg:col-span-2 shadow-md flex flex-col">
                    <CardHeader>
                        <CardTitle>סטטוס חדרים בזמן אמת</CardTitle>
                        <CardDescription>תמונת מצב עדכנית של כלל המלונות</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[300px]">
                        {/* ✨ התיקון: עטיפת הגרף ב-div עם גובה מוגדר */}
                        <div style={{ width: '100%', height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 14}} />
                                    <Tooltip 
                                        cursor={{fill: 'transparent'}}
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="bg-white shadow-md border-blue-100">
                        <CardHeader>
                            <CardTitle className="text-lg">פעולות מהירות</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button asChild variant="outline" className="w-full justify-between h-12 text-slate-700 hover:text-blue-700 hover:border-blue-300">
                                <Link to="/admin/rooms/create">
                                    <span className="flex items-center gap-2"><PlusCircle size={18} /> הקמת חדרים (Bulk)</span>
                                    <ArrowRight size={16} />
                                </Link>
                            </Button>
                            
                            <Button asChild variant="outline" className="w-full justify-between h-12 text-slate-700 hover:text-blue-700 hover:border-blue-300">
                                <Link to="/maintenance">
                                    <span className="flex items-center gap-2"><Paintbrush size={18} /> מסך עבודה (צ'ק ליסט)</span>
                                    <ArrowRight size={16} />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {stats.tasks > 0 && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-1" />
                            <div>
                                <h4 className="font-bold text-amber-800">יש עבודה!</h4>
                                <p className="text-sm text-amber-700 mt-1">
                                    ישנן כרגע <strong>{stats.tasks}</strong> משימות פתוחות בכל החדרים.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}