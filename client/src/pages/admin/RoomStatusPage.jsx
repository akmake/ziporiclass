import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { CheckCircle2, XCircle, AlertTriangle, Paintbrush, Hotel } from 'lucide-react';

const fetchAllRooms = async () => (await api.get('/rooms/all')).data;
export default function RoomStatusPage() {
    // טוען את כל החדרים מכל המלונות (דורש הרשאת מנהל)
    const { data: rooms = [], isLoading } = useQuery({
        queryKey: ['allRoomsAdmin'],
        queryFn: fetchAllRooms,
        refetchInterval: 10000 // רענון כל 10 שניות
    });
    const stats = useMemo(() => {
        const data = {
            clean: [],
            dirty: [],      // לא נקיים שטרם נגעו בהם
             partial: [],    // התחילו לעבוד (חלק מהמשימות בוצעו)
            maintenance: [] // תקולים
        };

        rooms.forEach(room => {
             if (room.status === 'clean') {
                data.clean.push(room);
            } else if (room.status === 'maintenance') {
                data.maintenance.push(room);
             } else {
                // בדיקה אם זה 'dirty' רגיל או 'partial'
                const completed = room.tasks.filter(t => t.isCompleted).length;
                 if (completed > 0) {
                    data.partial.push(room);
                } else {
                     data.dirty.push(room);
                }
            }
        });
        return data;
    }, [rooms]);

    if (isLoading) return <div className="p-10 text-center text-gray-500">טוען תמונת מצב...</div>;
    return (
        <div className="container mx-auto p-6 space-y-8 min-h-screen bg-slate-50">
            <header>
                <h1 className="text-3xl font-bold text-gray-900">תמונת מצב חדרים</h1>
                 <p className="text-gray-500">דשבורד ניהולי - צפייה בלבד</p>
            </header>

            {/* כרטיסי סיכום */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <StatCard title="חדרים נקיים" count={stats.clean.length} color="text-green-600" bg="bg-green-50" icon={<CheckCircle2/>} />
                <StatCard title="בתהליך עבודה" count={stats.partial.length} color="text-amber-600" bg="bg-amber-50" icon={<Paintbrush/>} />
                <StatCard title="ממתינים לנקיון" count={stats.dirty.length} color="text-slate-600" bg="bg-white" icon={<XCircle/>} />
                 <StatCard title="מושבתים / תקולים" count={stats.maintenance.length} color="text-red-600" bg="bg-red-50" icon={<AlertTriangle/>} />
            </div>

            {/* פירוט לפי קטגוריות */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                <StatusColumn title="תקולים / בטיפול (Maintenance)" items={stats.maintenance} color="border-red-500" />

                <StatusColumn title="בתהליך נקיון (התחילו)" items={stats.partial} color="border-amber-400" />

                <StatusColumn title="ממתינים (אף משימה לא בוצעה)" items={stats.dirty} color="border-slate-300" />

                <StatusColumn title="נקיים ומוכנים" items={stats.clean} color="border-green-500" />

             </div>
        </div>
    );
}

function StatCard({ title, count, color, bg, icon }) {
    return (
        <Card className={`${bg} border-none shadow-sm`}>
            <CardContent className="p-6 flex items-center justify-between">
                 <div>
                    <p className="text-sm font-medium text-gray-600">{title}</p>
                    <p className={`text-4xl font-bold ${color} mt-1`}>{count}</p>
                 </div>
                <div className={`${color} opacity-20 scale-150`}>{icon}</div>
            </CardContent>
        </Card>
    );
}

function StatusColumn({ title, items, color }) {
    return (
        <div className={`bg-white rounded-xl shadow-sm border-t-4 ${color} overflow-hidden flex flex-col h-[600px]`}>
            <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between">
                 <span>{title}</span>
                <span className="bg-white px-2 rounded text-sm border">{items.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.map(room => (
                    <div key={room._id} className="p-3 border rounded hover:bg-slate-50 transition flex justify-between items-center">
                         <div>
                            <span className="font-bold text-lg block">{room.roomNumber}</span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                 <Hotel size={10}/> {room.hotel?.name}
                            </span>
                         </div>
                        {room.lastCleanedBy && (
                            <div className="text-[10px] text-gray-400 text-left">
                                 <p>נוקה ע"י:</p>
                                <p>{room.lastCleanedBy.name}</p>
                             </div>
                        )}
                    </div>
                ))}
                 {items.length === 0 && <p className="text-center text-gray-300 mt-10 text-sm">אין חדרים בסטטוס זה</p>}
            </div>
        </div>
    );
}