import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Lock, UploadCloud, LoaderCircle } from 'lucide-react';

// --- רכיב פנימי להעלאה ---
function DailyUploadComponent({ hotelId, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
  
    const handleUpload = async () => {
      if (!hotelId) return toast.error("נא לבחור מלון תחילה");
      if (!file) return toast.error("נא לבחור קובץ אקסל");
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('hotelId', hotelId);
  
      setUploading(true);
      try {
        // ✨ התיקון הקריטי: שימוש בנתיב החדש upload-daily
        const res = await api.post('/bookings/upload-daily', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(`הקובץ נקלט! ${res.data.roomsProcessed} חדרים עודכנו.`);
        if (onUploadSuccess) onUploadSuccess(); 
        setFile(null); // איפוס הקובץ לאחר הצלחה
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "שגיאה בהעלאת הקובץ");
      } finally {
        setUploading(false);
      }
    };
  
    return (
      <div className="p-4 bg-white shadow rounded-lg border border-gray-200 mb-6">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <UploadCloud size={20} className="text-blue-600"/> 
            טעינת סידור עבודה יומי
        </h3>
        <div className="flex gap-2 items-center">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button 
            onClick={handleUpload} 
            disabled={uploading || !file || !hotelId} 
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 whitespace-nowrap"
          >
            {uploading && <LoaderCircle className="animate-spin h-4 w-4"/>}
            {uploading ? 'מעבד...' : 'העלה ונתח'}
          </button>
        </div>
      </div>
    );
}

// --- הדף הראשי ---
export default function AdminDailyDashboard() {
  const [selectedHotel, setSelectedHotel] = useState('');
  const queryClient = useQueryClient();

  // 1. טעינת מלונות
  const { data: hotels = [] } = useQuery({
      queryKey: ['hotels'],
      queryFn: async () => (await api.get('/admin/hotels')).data
  });

  // 2. בחירה אוטומטית של המלון הראשון כשהרשימה נטענת
  useEffect(() => {
      if (hotels.length > 0 && !selectedHotel) {
          setSelectedHotel(hotels[0]._id);
      }
  }, [hotels]);

  // 3. טעינת חדרים בהתאם למלון שנבחר
  const { data: rooms = [], isLoading, refetch } = useQuery({
    queryKey: ['dailyRooms', selectedHotel], 
    queryFn: async () => {
        if(!selectedHotel) return [];
        // שליפה ישירה של החדרים לפי המלון
        const res = await api.get(`/rooms/${selectedHotel}`); 
        return res.data;
    },
    enabled: !!selectedHotel
  });

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">ניהול שוטף - חדרים</h1>
        
        {hotels.length > 0 && (
            <select 
                className="p-2 border rounded-md min-w-[200px]"
                value={selectedHotel} 
                onChange={(e) => setSelectedHotel(e.target.value)}
            >
                {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
        )}
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
                    <h3 className="font-bold border-b pb-2 mb-2">תמונת מצב</h3>
                    <div className="flex justify-between">
                        <span>נקיים:</span>
                        <span className="font-bold text-green-600">{rooms.filter(r => r.status === 'clean').length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>מלוכלכים:</span>
                        <span className="font-bold text-red-600">{rooms.filter(r => r.status !== 'clean').length}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                        <span>משימות מיוחדות (מיטות/לולים):</span>
                        <span className="font-bold text-orange-600">
                            {rooms.reduce((acc, room) => acc + (room.dailyTasks?.filter(t => t.type === 'special' && !t.isCompleted).length || 0), 0)}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* צד שמאל: גריד חדרים */}
        <div className="lg:col-span-2">
            {isLoading ? <p className="text-center">טוען נתונים...</p> : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {rooms.map(room => {
                        const hasBlocking = room.dailyTasks?.some(t => t.isBlocking && !t.isCompleted);
                        const isArrival = room.currentGuest?.reservationStatus === 'arrival';
                        const isDeparture = room.currentGuest?.reservationStatus === 'departure';

                        return (
                            <div key={room._id} className={`
                                p-3 rounded-lg border-2 text-center transition-all hover:scale-105 relative
                                ${room.status === 'clean' ? 'bg-green-50 border-green-200' : 'bg-white border-red-200'}
                                ${hasBlocking ? 'ring-2 ring-orange-400 ring-offset-1' : ''}
                            `}>
                                <div className="text-xl font-bold">{room.roomNumber}</div>
                                <div className="text-xs text-gray-500 mt-1 font-bold">
                                    {isDeparture ? <span className="text-red-600">עזיבה</span> : 
                                     isArrival ? <span className="text-blue-600">הגעה</span> : 
                                     room.currentGuest?.reservationStatus === 'stayover' ? 'שוהה' : '-'}
                                </div>
                                
                                <div className="flex justify-center gap-1 mt-2 min-h-[16px]">
                                     {hasBlocking && <Lock size={14} className="text-orange-500"/>}
                                </div>
                            </div>
                        );
                    })}
                    {rooms.length === 0 && <p className="col-span-full text-center text-gray-400 py-10">אין חדרים להצגה במלון זה</p>}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}