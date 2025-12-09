import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import DailyUpload from '@/components/DailyUpload'; // הקומפוננטה ששלחתי קודם
import { Card, CardContent } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";

export default function AdminDailyDashboard() {
  const [selectedHotel, setSelectedHotel] = useState(null);

  // טעינת רשימת חדרים מלאה (מנהל רואה הכל)
  const { data: rooms = [], refetch } = useQuery({
    queryKey: ['allRooms', selectedHotel],
    queryFn: async () => {
        if(!selectedHotel) return [];
        const res = await api.get(`/rooms/daily-status/${selectedHotel}`);
        return res.data;
    },
    enabled: !!selectedHotel
  });

  // טעינת מלונות (כמו בקוד הקיים שלך)
  const { data: hotels = [] } = useQuery({
      queryKey: ['hotels'],
      queryFn: async () => (await api.get('/admin/hotels')).data
  });

  // ברירת מחדל למלון ראשון
  React.useEffect(() => {
      if (hotels.length > 0 && !selectedHotel) setSelectedHotel(hotels[0]._id);
  }, [hotels]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">ניהול שוטף - חדרים</h1>
        
        {/* בורר מלונות */}
        <select 
            className="p-2 border rounded-md"
            value={selectedHotel || ''} 
            onChange={(e) => setSelectedHotel(e.target.value)}
        >
            {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* צד ימין: פעולות (העלאת אקסל) */}
        <div className="space-y-6">
            <DailyUpload 
                hotelId={selectedHotel} 
                onUploadSuccess={() => refetch()} // רענון אחרי העלאה
            />
            
            {/* סטטיסטיקה מהירה */}
            <Card>
                <CardContent className="p-4 space-y-2">
                    <h3 className="font-bold">תמונת מצב</h3>
                    <div className="flex justify-between">
                        <span>נקיים:</span>
                        <span className="font-bold text-green-600">{rooms.filter(r => r.status === 'clean').length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>מלוכלכים:</span>
                        <span className="font-bold text-red-600">{rooms.filter(r => r.status === 'dirty').length}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                        <span>סה"כ מיטות להוספה:</span>
                        {/* חישוב מתוחכם: רץ על כל המשימות של כל החדרים ובודק כמה מהם זה "מיטות" שלא בוצעו */}
                        <span className="font-bold text-orange-600">
                            {rooms.reduce((acc, room) => acc + room.dailyTasks.filter(t => t.description.includes('מיטות') && !t.isCompleted).length, 0)}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* צד שמאל: גריד חדרים */}
        <div className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {rooms.map(room => (
                    <div key={room._id} className={`
                        p-3 rounded-lg border-2 text-center cursor-pointer transition-all hover:scale-105
                        ${room.status === 'clean' ? 'bg-green-50 border-green-200' : 'bg-white border-red-200'}
                        ${room.dailyTasks.some(t => t.type === 'special' && !t.isCompleted) ? 'ring-2 ring-orange-400 ring-offset-1' : ''}
                    `}>
                        <div className="text-xl font-bold">{room.roomNumber}</div>
                        <div className="text-xs text-gray-500 mt-1">
                            {room.currentGuest.reservationStatus === 'departure' ? 'עזיבה' : 
                             room.currentGuest.reservationStatus === 'arrival' ? 'הגעה' : 'שוהה'}
                        </div>
                        {/* חיווי אייקונים למנהל */}
                        <div className="flex justify-center gap-1 mt-2">
                             {/* אם יש משימה חוסמת פתוחה - מציג מנעול */}
                             {room.dailyTasks.some(t => t.isBlocking && !t.isCompleted) && <Lock size={12} className="text-orange-500"/>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
