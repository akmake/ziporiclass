import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import RoomCard from '@/components/maintenance/RoomCard'; // הייבוא של הרכיב למעלה
import { LogOut, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

// שליפת החדרים של החדרנית המחוברת
const fetchMyRooms = async () => {
  const { data } = await api.get('/rooms/my-tasks'); // נתיב חדש בשרת
  return data;
};

export default function HousekeeperView() {
  const queryClient = useQueryClient();
  
  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['myRooms'],
    queryFn: fetchMyRooms,
    refetchInterval: 10000 // רענון חי כל 10 שניות
  });

  // עדכון משימה (V)
  const toggleTaskMutation = useMutation({
    mutationFn: ({ roomId, taskId, isCompleted }) => 
      api.patch(`/rooms/${roomId}/tasks/${taskId}`, { isCompleted }),
    onSuccess: () => queryClient.invalidateQueries(['myRooms'])
  });

  // סיום חדר
  const finishRoomMutation = useMutation({
    mutationFn: (roomId) => api.patch(`/rooms/${roomId}/status`, { status: 'clean' }),
    onSuccess: () => toast.success('כל הכבוד! החדר סומן כנקי.')
  });

  if (isLoading) return <div className="p-10 text-center">טוען משימות...</div>;

  // מיון: קודם עזיבות (דחוף), אח"כ שוהים, בסוף נקיים
  const sortedRooms = [...rooms].sort((a, b) => {
    if (a.status === 'clean') return 1;
    if (b.status === 'clean') return -1;
    if (a.currentGuest.reservationStatus === 'departure') return -1;
    return 1;
  });

  return (
    <div className="min-h-screen bg-gray-100 pb-20 p-4" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">שלום, יש לך {rooms.filter(r => r.status !== 'clean').length} חדרים</h1>
        <p className="text-gray-500 text-sm">העדיפות היא לחדרי עזיבה/כניסה.</p>
      </header>

      <div className="space-y-6">
        {sortedRooms.map(room => (
          <div key={room._id}>
            {/* כותרת קטנה מעל הכרטיס אם זה סוג סטטוס שונה */}
            {room.currentGuest.reservationStatus === 'departure' && room.status !== 'clean' && (
               <div className="flex items-center gap-1 text-red-600 font-bold text-xs mb-1 mr-1">
                 <LogOut size={12}/> עזיבה / תחלופה - דחוף
               </div>
            )}
            
            <RoomCard 
              room={room}
              onToggleTask={(roomId, taskId, isCompleted) => toggleTaskMutation.mutate({ roomId, taskId, isCompleted })}
              onFinishRoom={(roomId) => finishRoomMutation.mutate(roomId)}
            />
          </div>
        ))}
        
        {sortedRooms.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            אין משימות פתוחות כרגע.
          </div>
        )}
      </div>
    </div>
  );
}
