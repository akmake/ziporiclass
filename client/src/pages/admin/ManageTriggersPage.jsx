import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { Badge } from '@/components/ui/Badge.jsx'; // וודא שיש לך Badge, אם לא - השתמש ב-span עם עיצוב
import { MessageSquarePlus, Trash2, Plus, Info } from 'lucide-react';

// API Functions
const fetchTriggers = async () => (await api.get('/admin/triggers')).data;
const createTrigger = (text) => api.post('/admin/triggers', { text });
const deleteTrigger = (id) => api.delete(`/admin/triggers/${id}`);

export default function ManageTriggersPage() {
    const [newTrigger, setNewTrigger] = useState('');
    const queryClient = useQueryClient();

    // שליפת הנתונים
    const { data: triggers = [], isLoading } = useQuery({
        queryKey: ['leadTriggers'],
        queryFn: fetchTriggers
    });

    // הוספת טריגר
    const addMutation = useMutation({
        mutationFn: createTrigger,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leadTriggers'] });
            toast.success('מילת מפתח נוספה!');
            setNewTrigger('');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'שגיאה בהוספה')
    });

    // מחיקת טריגר
    const deleteMutation = useMutation({
        mutationFn: deleteTrigger,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leadTriggers'] });
            toast.success('מילת מפתח הוסרה');
        },
        onError: () => toast.error('שגיאה במחיקה')
    });

    const handleAdd = (e) => {
        e.preventDefault();
        if (newTrigger.trim().length < 2) return toast.error('נא להזין לפחות 2 תווים');
        addMutation.mutate(newTrigger);
    };

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-4xl">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <MessageSquarePlus className="text-green-600" /> הגדרת טריגרים ללידים (וואטסאפ)
                </h1>
                <p className="mt-2 text-gray-600">
                    כל הודעה שתיכנס ותכיל את אחת מהמילים ברשימה למטה - תהפוך מיד לליד חדש במערכת (גם אם זה לקוח ותיק).
                    <br/>
                    <span className="text-sm font-bold text-amber-600">שים לב: המערכת כבר מזהה אוטומטית שיחות חדשות (שלא דיברו חודש), אין צורך להגדיר זאת כאן.</span>
                </p>
            </header>

            {/* טופס הוספה */}
            <Card className="border-t-4 border-t-green-500 shadow-sm">
                <CardHeader>
                    <CardTitle>הוספת ביטוי חדש</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAdd} className="flex gap-4 items-center">
                        <Input 
                            placeholder='לדוגמה: "מעוניין בהצעת מחיר", "סגירת אירוע", "אפשר פרטים?"' 
                            value={newTrigger} 
                            onChange={(e) => setNewTrigger(e.target.value)} 
                            className="flex-1 text-lg"
                            autoFocus
                        />
                        <Button type="submit" disabled={addMutation.isPending} className="bg-green-600 hover:bg-green-700 h-10 px-6">
                            <Plus className="ml-2 h-5 w-5" /> הוסף
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* רשימת הטריגרים */}
            <Card>
                <CardHeader>
                    <CardTitle>רשימת הביטויים הפעילים ({triggers.length})</CardTitle>
                    <CardDescription>לחיצה על הפח תמחק את הביטוי מהרשימה.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p className="text-center p-10">טוען...</p> : 
                     triggers.length === 0 ? 
                        <div className="text-center py-10 bg-slate-50 rounded border border-dashed text-gray-500">
                            עדיין לא הוגדרו מילות מפתח.
                        </div> 
                     : (
                        <div className="flex flex-wrap gap-3">
                            {triggers.map((item) => (
                                <div key={item._id} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all group">
                                    <span className="font-bold text-slate-700 text-lg">{item.text}</span>
                                    <button 
                                        onClick={() => deleteMutation.mutate(item._id)}
                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-1 transition-colors"
                                        title="מחק ביטוי"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 text-sm text-blue-800 border border-blue-200">
                <Info className="shrink-0 mt-0.5" size={18}/>
                <div>
                    <strong>איך זה עובד?</strong><br/>
                    המערכת בודקת כל הודעה נכנסת. אם ההודעה מכילה את אחד הביטויים הנ"ל, יפתח כרטיס ליד חדש בתיבת הפניות.
                    <br/>למשל, אם הוספתם את המילה "חתונה", והלקוח כתב "שלום רציתי לברר על חתונה בחורף" - יווצר ליד.
                </div>
            </div>
        </div>
    );
}