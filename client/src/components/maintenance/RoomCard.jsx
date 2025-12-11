import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { 
    Bed, Baby, AlertTriangle, CheckCircle2, Lock, 
    ArrowRightLeft, LogIn, LogOut, Wrench, ChevronDown, ChevronUp 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RoomCard({ room, onToggleTask, onFinishRoom, onReportIssue }) {
    const [isExpanded, setIsExpanded] = useState(room.status !== 'clean');

    // --- חישובים ---
    const specialTasks = room.tasks?.filter(t => t.type === 'daily' || t.isHighlight) || [];
    const maintenanceTasks = room.tasks?.filter(t => t.type === 'maintenance') || [];
    const standardTasks = room.tasks?.filter(t => t.type === 'standard' && !t.isHighlight) || [];

    const hasOpenBlocking = specialTasks.some(t => !t.isCompleted);
    const isClean = room.status === 'clean';

    // --- הגדרות עיצוב לפי סטטוס ---
    const getStatusConfig = () => {
        if (isClean) return { color: 'bg-green-500', border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-700', label: 'נקי' };
        if (room.status === 'maintenance') return { color: 'bg-red-500', border: 'border-red-500', bg: 'bg-red-50', text: 'text-red-700', label: 'תקול' };
        
        // לפי דשבורד
        if (room.dashboardStatus === 'back_to_back') return { color: 'bg-purple-600', border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-700', label: 'תחלופה' };
        if (room.dashboardStatus === 'arrival') return { color: 'bg-blue-500', border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', label: 'נכנסים' };
        if (room.dashboardStatus === 'departure') return { color: 'bg-orange-500', border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', label: 'עוזבים' };
        
        return { color: 'bg-slate-400', border: 'border-slate-400', bg: 'bg-white', text: 'text-slate-600', label: 'רגיל' };
    };

    const style = getStatusConfig();

    return (
        <motion.div 
            layout 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4 transition-all ${!isClean ? 'hover:shadow-md' : 'opacity-75'}`}
        >
            {/* פס צבע צידי (RTL - צד ימין) */}
            <div className={`absolute top-0 right-0 bottom-0 w-2 ${style.color}`} />

            {/* כותרת הכרטיס */}
            <div 
                className="p-4 pr-6 flex justify-between items-center cursor-pointer" 
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* צד ימין: מספר חדר וסטטוס */}
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-black text-slate-800 tracking-tight">{room.roomNumber}</span>
                        {/* תגית סטטוס קטנה */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                            {style.label}
                        </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium mt-0.5">{room.roomType?.name}</span>
                </div>

                {/* צד שמאל: אייקונים וכפתור פתיחה */}
                <div className="flex items-center gap-3">
                    {/* אינדיקטורים לדרישות (מיטות/תינוקות) - מופיעים רק אם רלוונטי */}
                    <div className="flex gap-1">
                        {room.bookingInfo?.pax > 0 && (
                            <div className="flex flex-col items-center justify-center bg-blue-50 w-8 h-8 rounded-lg text-blue-600">
                                <Bed size={14} strokeWidth={2.5}/>
                                <span className="text-[9px] font-bold leading-none mt-0.5">{room.bookingInfo.pax}</span>
                            </div>
                        )}
                        {room.bookingInfo?.babies > 0 && (
                            <div className="flex flex-col items-center justify-center bg-pink-50 w-8 h-8 rounded-lg text-pink-600">
                                <Baby size={14} strokeWidth={2.5}/>
                                <span className="text-[9px] font-bold leading-none mt-0.5">{room.bookingInfo.babies}</span>
                            </div>
                        )}
                    </div>
                    
                    {/* אייקון חץ לפתיחה/סגירה */}
                    <div className={`p-1 rounded-full bg-slate-50 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={20}/>
                    </div>
                </div>
            </div>

            {/* תוכן נפתח */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }} 
                        className="bg-slate-50/50 border-t border-slate-100"
                    >
                        <div className="p-4 pr-6 space-y-4">
                            
                            {/* 1. משימות קריטיות (תקלות + הזמנה) */}
                            {(maintenanceTasks.length > 0 || specialTasks.length > 0) && (
                                <div className="space-y-2">
                                    {maintenanceTasks.map(t => (
                                        <TaskRow key={t._id} task={t} roomId={room._id} onToggle={onToggleTask} type="critical" />
                                    ))}
                                    {specialTasks.map(t => (
                                        <TaskRow key={t._id} task={t} roomId={room._id} onToggle={onToggleTask} type="special" />
                                    ))}
                                </div>
                            )}

                            {/* 2. משימות שוטפות */}
                            {standardTasks.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 mb-2">צ'ק ליסט</h4>
                                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                        {standardTasks.map((t, i) => (
                                            <div key={t._id} className={i !== standardTasks.length - 1 ? 'border-b border-slate-50' : ''}>
                                                <TaskRow task={t} roomId={room._id} onToggle={onToggleTask} type="standard" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* כפתורי פעולה תחתונים */}
                            <div className="flex gap-3 pt-2">
                                <Button 
                                    variant="outline" 
                                    onClick={(e) => { e.stopPropagation(); onReportIssue(); }} 
                                    className="flex-1 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 border-slate-200 h-11"
                                >
                                    <Wrench size={16} className="ml-2"/> תקלה
                                </Button>
                                
                                <Button 
                                    onClick={(e) => { e.stopPropagation(); onFinishRoom(room._id); }}
                                    disabled={hasOpenBlocking || isClean}
                                    className={`flex-1 h-11 shadow-sm text-base ${isClean ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                                >
                                    {isClean ? 
                                        <><CheckCircle2 className="ml-2 h-5 w-5"/> בוצע</> : 
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

// תת-רכיב לשורה של משימה
function TaskRow({ task, roomId, onToggle, type }) {
    let rowClass = "flex items-center gap-3 p-3 transition-colors cursor-pointer ";
    let textClass = "text-sm font-medium transition-all ";
    
    // עיצוב לפי סוג משימה
    if (type === 'critical') {
        rowClass += "bg-red-50 border border-red-100 rounded-lg mb-2";
        textClass += "text-red-700";
    } else if (type === 'special') {
        rowClass += "bg-indigo-50 border border-indigo-100 rounded-lg mb-2";
        textClass += "text-indigo-700";
    } else {
        rowClass += "hover:bg-slate-50"; // רגיל
        textClass += "text-slate-700";
    }

    if (task.isCompleted) {
        textClass = "text-slate-400 line-through decoration-slate-300";
        if (type !== 'standard') rowClass += " opacity-60 grayscale"; 
    }

    return (
        <div 
            onClick={() => onToggle(roomId, task._id, !task.isCompleted)}
            className={rowClass}
        >
            <Checkbox 
                checked={task.isCompleted} 
                className={`w-5 h-5 rounded-md border-2 ${type === 'critical' ? 'border-red-300 data-[state=checked]:bg-red-500' : 'border-slate-300 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500'}`}
            />
            <span className={textClass}>
                {task.description}
            </span>
        </div>
    );
}