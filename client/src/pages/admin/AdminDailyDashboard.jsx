import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Lock } from 'lucide-react';

// --- רכיב פנימי להעלאה (מוגדר כאן מקומית כדי למנוע שגיאות ייבוא) ---
function DailyUploadComponent({ hotelId, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
  
    const handleUpload = async () => {
      if (!file || !hotelId) return alert("בחר מלון וקובץ");
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('hotelId', hotelId);
  
      setLoading(true);
      try {
        const res = await api.post('/bookings/upload-daily', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setMsg(`✅ ${res.data.message} (${res.data.roomsProcessed} חדרים)`);
        if (onUploadSuccess) onUploadSuccess(); 
      } catch (err) {
        console.error(err);
        setMsg("❌ שגיאה בהעלאה. וודא שהקובץ תקין.");
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <div className="p-4 bg-white shadow rounded-lg border border-gray-200 mb-6">
        <h3 className="font-bold text-lg mb-2">📥 טעינת סידור עבודה יומי (אקסל)</h3>
        <div className="flex gap-2 items-center">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button onClick={handleUpload} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
            {loading ? 'מעבד...' : 'העלה ונתח'}
          </button>
        </div>
        {msg && <div className="mt-3 font-bold text-sm">{msg}</div>}
      </div>
    );
}

// --- הדף הראשי ---
export default function AdminDailyDashboard() {
  const [selectedHotel, setSelectedHotel] = useState(null);

  // טעינת רשימת חדרים מלאה (מנהל רואה הכל)
  const { data: rooms = [], refetch } = useQuery({
    queryKey: ['allRoomsDaily', selectedHotel],
    queryFn: async () => {
        if(!selectedHotel) return [];
        const res = await api.get(`/rooms/${selectedHotel}`); 
        return res.data;
    },
    enabled: !!selectedHotel
  });

  const { data: hotels = [] } = useQuery({
      queryKey: ['hotels'],
      queryFn: async () => (await api.get('/admin/hotels')).data
  });

  React.useEffect(() => {
      if (hotels.length > 0 && !selectedHotel) setSelectedHotel(hotels[0]._id);
  }, [hotels]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">ניהול שוטף - חדרים</h1>
        <select 
            className="p-2 border rounded-md"
            value={selectedHotel || ''} 
            onChange={(e) => setSelectedHotel(e.target.value)}
        >
            {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* צד ימין: העלאה וסטטיסטיקה */}
        <div className="space-y-6">
            <DailyUploadComponent 
                hotelId={selectedHotel} 
                onUploadSuccess={() => refetch()} 
            />
            
            <Card>
                <CardContent className="p-4 space-y-2">
                    <h3 className="font-bold">תמונת מצב</h3>
                    <div className="flex justify-between">
                        <span>נקיים:</span>
                        <span className="font-bold text-green-600">{rooms.filter(r => r.status === 'clean').length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>מלוכלכים:</span>
                        <span className="font-bold text-red-600">{rooms.filter(r => r.status !== 'clean').length}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                        <span>סה"כ מיטות/לולים חסרים:</span>
                        <span className="font-bold text-orange-600">
                            {rooms.reduce((acc, room) => acc + (room.dailyTasks?.filter(t => t.type === 'special' && !t.isCompleted).length || 0), 0)}
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
                        ${room.dailyTasks?.some(t => t.type === 'special' && !t.isCompleted) ? 'ring-2 ring-orange-400 ring-offset-1' : ''}
                    `}>
                        <div className="text-xl font-bold">{room.roomNumber}</div>
                        <div className="text-xs text-gray-500 mt-1">
                            {/* בדיקת סוג הסטטוס להצגה */}
                            {room.currentGuest?.reservationStatus === 'departure' ? 'עזיבה' : 
                             room.currentGuest?.reservationStatus === 'arrival' ? 'הגעה' : 
                             room.currentGuest?.reservationStatus === 'stayover' ? 'שוהה' : '-'}
                        </div>
                        
                        <div className="flex justify-center gap-1 mt-2">
                             {/* מנעול אם יש משימות חוסמות */}
                             {room.dailyTasks?.some(t => t.isBlocking && !t.isCompleted) && <Lock size={12} className="text-orange-500"/>}
                        </div>
                    </div>
                ))}
                {rooms.length === 0 && <p className="col-span-full text-center text-gray-400">אין חדרים להצגה</p>}
            </div>
        </div>
      </div>
    </div>
  );
}
