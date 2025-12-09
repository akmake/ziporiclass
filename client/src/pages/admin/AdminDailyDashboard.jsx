import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Lock, UploadCloud, LoaderCircle } from 'lucide-react';

function DailyUploadComponent({ hotelId, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
  
    const handleUpload = async () => {
      if (!hotelId) return toast.error("נא לבחור מלון");
      if (!file) return toast.error("נא לבחור קובץ");
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('hotelId', hotelId);
  
      setUploading(true);
      try {
        // תיקון: חזרה לנתיב המקורי /bookings/upload
        const res = await api.post('/bookings/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(`הקובץ נקלט! ${res.data.roomsProcessed} חדרים עודכנו.`);
        if (onUploadSuccess) onUploadSuccess(); 
        setFile(null); 
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "שגיאה בהעלאה");
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
          <button onClick={handleUpload} disabled={uploading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
            {uploading ? <LoaderCircle className="animate-spin h-4 w-4"/> : 'העלה ונתח'}
          </button>
        </div>
      </div>
    );
}

export default function AdminDailyDashboard() {
  const [selectedHotel, setSelectedHotel] = useState('');
  
  const { data: hotels = [] } = useQuery({
      queryKey: ['hotels'],
      queryFn: async () => (await api.get('/admin/hotels')).data
  });

  useEffect(() => {
      if (hotels.length > 0 && !selectedHotel) setSelectedHotel(hotels[0]._id);
  }, [hotels]);

  const { data: rooms = [], refetch } = useQuery({
    queryKey: ['dailyRooms', selectedHotel], 
    queryFn: async () => {
        if(!selectedHotel) return [];
        // שימוש בנתיב המקורי לקבלת חדרים
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
            <select className="p-2 border rounded-md min-w-[200px]" value={selectedHotel} onChange={(e) => setSelectedHotel(e.target.value)}>
                {hotels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
            <DailyUploadComponent hotelId={selectedHotel} onUploadSuccess={() => refetch()} />
            <Card>
                <CardContent className="p-4 space-y-2">
                    <h3 className="font-bold border-b pb-2 mb-2">תמונת מצב</h3>
                    <div className="flex justify-between"><span>נקיים:</span><span className="font-bold text-green-600">{rooms.filter(r => r.status === 'clean').length}</span></div>
                    <div className="flex justify-between"><span>מלוכלכים:</span><span className="font-bold text-red-600">{rooms.filter(r => r.status !== 'clean').length}</span></div>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {rooms.map(room => (
                    <div key={room._id} className={`p-3 rounded-lg border-2 text-center transition-all ${room.status === 'clean' ? 'bg-green-50 border-green-200' : 'bg-white border-red-200'}`}>
                        <div className="text-xl font-bold">{room.roomNumber}</div>
                        <div className="text-xs text-gray-500 mt-1 font-bold">
                            {room.currentGuest?.status === 'departure' ? <span className="text-red-600">עזיבה</span> : 
                             room.currentGuest?.status === 'arrival' ? <span className="text-blue-600">הגעה</span> : 
                             room.currentGuest?.status === 'stayover' ? 'שוהה' : '-'}
                        </div>
                        {/* התאמתי את הבדיקה למבנה המקורי של המשימות */}
                        <div className="flex justify-center gap-1 mt-2 min-h-[16px]">
                             {room.tasks?.some(t => t.type === 'special' && !t.isCompleted) && <Lock size={14} className="text-orange-500"/>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}