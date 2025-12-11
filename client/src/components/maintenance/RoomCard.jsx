import React, { useState } from 'react';
import { Button } from '@/components/ui/Button'; // וודא שהנתיב תקין אצלך
import { Checkbox } from '@/components/ui/Checkbox'; // וודא שהנתיב תקין אצלך
import { 
    Bed, Baby, AlertTriangle, CheckCircle2, 
    ArrowRightLeft, LogIn, LogOut, Wrench, ChevronDown 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RoomCard({ room, onToggleTask, onFinishRoom, onReportIssue }) {
    // אם החדר נקי - סגור אותו. אם יש עבודה - פתח אותו כברירת מחדל לנוחות.
    const [isExpanded, setIsExpanded] = useState(room.status !== 'clean');

    // --- מיון וסינון משימות ---
    const tasks = room.tasks || [];
    const specialTasks = tasks.filter(t => t.type === 'daily' || t.isHighlight);
    const maintenanceTasks = tasks.filter(t => t.type === 'maintenance');
    const standardTasks = tasks.filter(t => t.type === 'standard' && !t.isHighlight);

    const hasOpenBlocking = specialTasks.some(t => !t.isCompleted);
    const isClean = room.status === 'clean';

    // --- עיצוב דינמי (פס צבע וטקסט) ---
    const getStatusConfig = () => {
        if (isClean) return { color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', label: 'נקי' };
        if (room.status === 'maintenance') return { color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', label: 'תקול' };
        
        // סטטוסים מהדשבורד היומי
        if (room.dashboardStatus === 'back_to_back') return { color: 'bg-purple-600', bg: 'bg-purple-50', text: 'text-purple-700', label: 'תחלופה' };
        if (room.dashboardStatus === 'arrival') return { color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', label: 'נכנסים' };
        if (room.dashboardStatus === 'departure') return { color: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', label: 'עוזבים' };
        
        return { color: 'bg-slate-400', bg: 'bg-white', text: 'text-slate-600', label: 'רגיל' };
    };

    const style = getStatusConfig();

    return (
        <motion.div 
            layout 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-3 transition-all ${!isClean ? 'hover:shadow-md' : 'opacity-80'}`}
        >
            {/* פס סטטוס צבעוני בצד ימין (RTL) */}
            <div className={`absolute top-0 right-0 bottom-0 w-1.5 ${style.color}`} />

            {/* === כותרת הכרטיס (תמיד גלויה) === */}
            <div 
                className="p-4 pr-5 flex justify-between items-center cursor-pointer select-none" 
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* אזור פרטי החדר */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-slate-800">{room.roomNumber}</span>
                        {/* תגית סטטוס */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                            {style.label}
                        </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">{room.roomType?.name || 'חדר רגיל'}</span>
                </div>

                {/* אזור אייקונים (מיטות/לולים/חץ) */}
                <div className="flex items-center gap-3">
                    {/* אייקון מיטות (אם צריך) */}
                    {room.bookingInfo?.pax > 0 && (
                        <div className="flex flex-col items-center justify-center bg-blue-50 w-9 h-9 rounded-lg text-blue-600 border border-blue-100">
                            <Bed size={16} strokeWidth={2.5}/>
                            <span className="text-[10px] font-bold leading-none mt-0.5">{room.bookingInfo.pax}</span>
                        </div>
                    )}
                    {/* אייקון עריסות (אם צריך) */}
                    {room.bookingInfo?.babies > 0 && (
                        <div className="flex flex-col items-center justify-center bg-pink-50 w-9 h-9 rounded-lg text-pink-600 border border-pink-100">
                            <Baby size={16} strokeWidth={2.5}/>
                            <span className="text-[10px] font-bold leading-none mt-0.5">{room.bookingInfo.babies}</span>
                        </div>
                    )}
                    
                    {/* חץ פתיחה/סגירה */}
                    <div className={`p-1 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={20}/>
                    </div>
                </div>
            </div>

            {/* === תוכן נפתח (משימות) === */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0 }} 
                        animate={{ height: 'auto' }} 
                        exit={{ height: 0 }} 
                        className="bg-slate-50/50 border-t border-slate-100 overflow-hidden"
                    >
                        <div className="p-4 pr-5 space-y-4">
                            
                            {/* 1. משימות דחופות (תקלות) */}
                            {maintenanceTasks.length > 0 && (
                                <div className="space-y-2 bg-red-50 p-3 rounded-lg border border-red-100">
                                    <h4 className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertTriangle size={12}/> תקלות פתוחות</h4>
                                    {maintenanceTasks.map(t => (
                                        <TaskRow key={t._id} task={t} roomId={room._id} onToggle={onToggleTask} type="critical" />
                                    ))}
                                </div>
                            )}

                            {/* 2. משימות הזמנה (דגשים) */}
                            {specialTasks.length > 0 && (
                                <div className="space-y-2 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                    <h4 className="text-xs font-bold text-indigo-600 flex items-center gap-1">📌 דגשים להזמנה</h4>
                                    {specialTasks.map(t => (
                                        <TaskRow key={t._id} task={t} roomId={room._id} onToggle={onToggleTask} type="special" />
                                    ))}
                                </div>
                            )}

                            {/* 3. צ'ק ליסט שוטף */}
                            {standardTasks.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 mb-2">צ'ק ליסט לביצוע</h4>
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                        {standardTasks.map((t, i) => (
                                            <div key={t._id} className={i !== standardTasks.length - 1 ? 'border-b border-slate-100' : ''}>
                                                <TaskRow task={t} roomId={room._id} onToggle={onToggleTask} type="standard" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* כפתורים תחתונים */}
                            <div className="flex gap-3 pt-2">
                                <Button 
                                    variant="outline" 
                                    onClick={(e) => { e.stopPropagation(); onReportIssue(); }} 
                                    className="flex-1 bg-white border-slate-300 text-slate-600 hover:text-red-600 hover:bg-red-50 h-11"
                                >
                                    <Wrench size={16} className="ml-2"/> דווח תקלה
                                </Button>
                                
                                <Button 
                                    onClick={(e) => { e.stopPropagation(); onFinishRoom(room._id); }}
                                    disabled={hasOpenBlocking || isClean}
                                    className={`flex-1 h-11 text-base shadow-sm ${isClean ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                                >
                                    {isClean ? 
                                        <><CheckCircle2 className="ml-2 h-5 w-5"/> החדר נקי</> : 
                                        "סיימתי לנקות"
                                    }
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// רכיב עזר לשורת משימה
function TaskRow({ task, roomId, onToggle, type }) {
    // מניעת באג של לחיצה כפולה
    const handleToggle = (e) => {
        e.stopPropagation();
        onToggle(roomId, task._id, !task.isCompleted);
    };

    let containerClass = "flex items-center gap-3 p-3 transition-colors cursor-pointer ";
    let textClass = "text-sm font-medium ";

    if (type === 'critical') {
        textClass += "text-red-800";
    } else if (type === 'special') {
        textClass += "text-indigo-800";
    } else {
        containerClass += "hover:bg-slate-50";
        textClass += "text-slate-700";
    }

    if (task.isCompleted) {
        textClass = "text-slate-400 line-through";
        containerClass += " opacity-60";
    }

    return (
        <div onClick={handleToggle} className={containerClass}>
            <Checkbox 
                checked={task.isCompleted} 
                onCheckedChange={() => {}} // השליטה נעשית ב-div העוטף
                className={`w-5 h-5 rounded border-2 ${type === 'critical' ? 'border-red-300 data-[state=checked]:bg-red-500' : 'border-slate-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600'}`}
            />
            <span className={textClass}>{task.description}</span>
        </div>
    );
}
