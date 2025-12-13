import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { MessageSquarePlus, Trash2, Plus, Info, LoaderCircle } from 'lucide-react';

// API Functions
// וודא שהנתיב הזה תואם למה שהגדרנו ב-server/app.js (/api/admin/triggers)
const fetchTriggers = async () => (await api.get('/admin/triggers')).data;
const createTrigger = (text) => api.post('/admin/triggers', { text });
const deleteTrigger = (id) => api.delete(`/admin/triggers/${id}`);

export default function ManageTriggersPage() {
    const [newTrigger, setNewTrigger] = useState('');
    const queryClient = useQueryClient();

    // שליפת הנתונים
    const { data: triggers = [], isLoading, isError } = useQuery({
        queryKey: ['leadTriggers'],
        queryFn: fetchTriggers
    });

    // הוספת טריגר
    const addMutation = useMutation({
        mutationFn: createTrigger,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leadTriggers'] });
            toast.success('מילת מפתח נוספה בהצלחה!');
            setNewTrigger('');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'שגיאה בהוספת הביטוי');
        }
    });

    // מחיקת טריגר
    const deleteMutation = useMutation({
        mutationFn: deleteTrigger,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leadTriggers'] });
            toast.success('הביטוי הוסר');
        },
        onError: () => toast.error('שגיאה במחיקה')
    });

    const handleAdd = (e) => {
        e.preventDefault();
        if (newTrigger.trim().length < 2) {
            return toast.error('נא להזין ביטוי עם לפחות 2 תווים');
        }
        addMutation.mutate(newTrigger);
    };

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-5xl" dir="rtl">
            
            {/* כותרת הדף */}
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <MessageSquarePlus className="text-green-600 h-8 w-8" /> 
                    ניהול מילות מפתח (וואטסאפ)
                </h1>
                <p className="mt-2 text-lg text-gray-600">
                    הגדרת מילים שיפתחו ליד אוטומטית גם ללקוחות קיימים (שדיברו איתנו לאחרונה).
                </p>
            </header>

            {/* כרטיס הוספה */}
            <Card className="border-t-4 border-t-green-500 shadow-md">
                <CardHeader>
                    <CardTitle>הוספת ביטוי חדש</CardTitle>
                    <CardDescription>הקלד מילה או משפט שהמערכת תחפש בהודעות הנכנסות.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAdd} className="flex gap-4 items-center">
                        <div className="flex-1">
                            <Input 
                                placeholder='לדוגמה: "הגעתי דרך", "מעוניין בהצעה", "אפשר פרטים?"' 
                                value={newTrigger} 
                                onChange={(e) => setNewTrigger(e.target.value)}
                                className="text-lg h-12"
                                autoFocus
                            />
                        </div>
                        <Button 
                            type="submit" 
                            disabled={addMutation.isPending} 
                            className="bg-green-600 hover:bg-green-700 h-12 px-8 text-lg"
                        >
                            {addMutation.isPending ? <LoaderCircle className="animate-spin"/> : <Plus className="ml-2 h-5 w-5" />}
                            הוסף
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* רשימת המילים הפעילות */}
            <Card className="shadow-sm">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="flex justify-between items-center">
                        <span>רשימת מילים פעילות</span>
                        <span className="text-sm font-normal text-slate-500 bg-white px-2 py-1 rounded border">
                            {triggers.length} ביטויים
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {isLoading ? (
                        <div className="text-center py-12 flex justify-center">
                            <LoaderCircle className="animate-spin h-8 w-8 text-green-600"/>
                        </div>
                    ) : isError ? (
                        <p className="text-center py-10 text-red-500">שגיאה בטעינת הנתונים.</p>
                    ) : triggers.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                            <MessageSquarePlus className="mx-auto h-12 w-12 text-slate-300 mb-2"/>
                            <p className="text-slate-500 text-lg">עדיין לא הוגדרו מילות מפתח.</p>
                            <p className="text-slate-400 text-sm">הוסף את הביטוי הראשון למעלה.</p>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {triggers.map((item) => (
                                <div 
                                    key={item._id} 
                                    className="flex items-center gap-3 bg-white border border-slate-200 pl-2 pr-4 py-2 rounded-full shadow-sm hover:border-green-400 hover:shadow-md transition-all group"
                                >
                                    <span className="font-bold text-slate-700 text-lg">{item.text}</span>
                                    <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
                                    <button 
                                        onClick={() => {
                                            if(window.confirm(`למחוק את הביטוי "${item.text}"?`)) {
                                                deleteMutation.mutate(item._id);
                                            }
                                        }} 
                                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full p-1 transition-colors"
                                        title="מחק ביטוי"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* הסבר לוגיקה */}
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 flex items-start gap-4 text-blue-900 shadow-sm">
                <div className="bg-blue-100 p-2 rounded-full mt-1">
                    <Info size={24} className="text-blue-700"/>
                </div>
                <div>
                    <h4 className="font-bold text-lg mb-2">איך המערכת מחליטה מתי לפתוח ליד?</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm md:text-base leading-relaxed">
                        <li>
                            <strong>לקוח חדש / רדום:</strong> אם המספר לא שלח הודעה ב-30 הימים האחרונים -> <span className="font-bold text-green-700">תמיד נפתח ליד</span> (גם אם כתב "היי").
                        </li>
                        <li>
                            <strong>לקוח פעיל:</strong> אם הוא דיבר איתנו לאחרונה, נפתח ליד <span className="underline decoration-blue-500 decoration-2">רק אם</span> ההודעה מכילה את אחת המילים ברשימה למעלה.
                        </li>
                        <li>
                            <strong>זיהוי מפנה:</strong> אם זוהתה מילת מפתח, המערכת תיקח את <span className="font-bold">2 המילים שמופיעות אחריה</span> ותחפש אותן במאגר השותפים.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}