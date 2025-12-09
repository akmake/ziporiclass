import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Bed, Baby, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

export default function RoomCard({ room, onToggleTask, onFinishRoom }) {
  // חישובים בזמן אמת
  const specialTasks = room.dailyTasks.filter(t => t.type === 'special');
  const standardTasks = room.dailyTasks.filter(t => t.type !== 'special');
  
  // האם נשארו משימות חוסמות פתוחות?
  const hasOpenBlockingTasks = specialTasks.some(t => !t.isCompleted);
  const isFinished = room.status === 'clean';

  return (
    <Card className={`mb-4 border-t-4 shadow-sm ${isFinished ? 'border-green-500 opacity-60' : 'border-red-500'}`}>
      <CardContent className="p-4">
        {/* כותרת החדר */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">חדר {room.roomNumber}</h2>
          <div className="flex gap-2">
            {/* אייקונים לפי הרכב אורחים */}
            {room.currentGuest.pax > 2 && <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Bed size={14}/> +{room.currentGuest.pax - 2}</span>}
            {room.currentGuest.babies > 0 && <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Baby size={14}/> +{room.currentGuest.babies}</span>}
          </div>
        </div>

        {/* --- אזור סכנה: משימות חוסמות (מיטות/לולים) --- */}
        {specialTasks.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <h3 className="text-orange-800 font-bold text-sm mb-2 flex items-center gap-1">
              <AlertTriangle size={16}/> חובה להכין:
            </h3>
            <div className="space-y-2">
              {specialTasks.map((task) => (
                <div key={task._id} 
                     onClick={() => !isFinished && onToggleTask(room._id, task._id, !task.isCompleted)}
                     className="flex items-center gap-3 bg-white p-2 rounded border border-orange-100 cursor-pointer">
                  <Checkbox 
                    checked={task.isCompleted} 
                    className="border-orange-500 data-[state=checked]:bg-orange-600 data-[state=checked]:text-white"
                  />
                  <span className={`font-medium ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- אזור שוטף: צ'ק ליסט רגיל --- */}
        <div className="space-y-2 mb-6">
          {standardTasks.map((task) => (
            <div key={task._id} 
                 onClick={() => !isFinished && onToggleTask(room._id, task._id, !task.isCompleted)}
                 className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 rounded">
              <Checkbox checked={task.isCompleted} />
              <span className={task.isCompleted ? 'line-through text-gray-400' : 'text-gray-600'}>
                {task.description}
              </span>
            </div>
          ))}
        </div>

        {/* כפתור סיום - ננעל אם לא סיימו משימות חוסמות */}
        <Button 
          onClick={() => onFinishRoom(room._id)}
          disabled={hasOpenBlockingTasks || isFinished}
          className={`w-full h-12 text-lg font-bold shadow-md transition-all
            ${isFinished ? 'bg-green-600 hover:bg-green-700' : 
              hasOpenBlockingTasks ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
          `}
        >
          {isFinished ? (
            <><CheckCircle2 className="ml-2"/> החדר נקי</>
          ) : hasOpenBlockingTasks ? (
            <><Lock className="ml-2"/> סיים משימות חובה</>
          ) : (
            "סיימתי את החדר"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
