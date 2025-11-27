import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { CalendarDays, Save, RefreshCw, Hotel, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fetchAllRooms = async () => (await api.get('/rooms/all')).data;
const publishPlan = (plan) => api.post('/rooms/daily-plan', { plan });

export default function DailyPlanPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // State מקומי לניהול השינויים לפני שמירה
    // מבנה: { [roomId]: { action: 'checkout'|'stayover'|'none', note: '' } }
    const [planDraft, setPlanDraft] = useState({});
    const { data: rooms = [], isLoading } = useQuery({
        queryKey: ['allRoomsForPlan'],
        queryFn: fetchAllRooms,
    });
    const publishMutation = useMutation({
        mutationFn: publishPlan,
        onSuccess: (res) => {
            toast.success(res.data.message);
            queryClient.invalidateQueries(['allRoomsForPlan']);
             setPlanDraft({}); // איפוס הטופס אחרי שמירה
        },
        onError: () => toast.error('שגיאה בהפצת הסידור')
    });
    // קיבוץ לפי מלונות לטובת Tabs
    const hotelsData = useMemo(() => {
        const groups = {};
        rooms.forEach(room => {
            const hName = room.hotel?.name || 'אחר';
            if (!groups[hName]) groups[hName] = [];
            groups[hName].push(room);
        });
        return groups;
    }, [rooms]);
    // עדכון ה-State המקומי
    const updateDraft = (roomId, field, value) => {
        setPlanDraft(prev => ({
            ...prev,
            [roomId]: {
                 ...prev[roomId],
                [field]: value
            }
        }));
    };

    const handlePublish = () => {
        // המרת האובייקט למערך שהשרת מצפה לו
        const payload = Object.entries(planDraft).map(([roomId, data]) => ({
            roomId,
            action: data.action,
             note: data.note
        }));
        if (payload.length === 0) return toast("לא ביצעת שינויים");

        if (window.confirm(`האם להפיץ סידור עבודה ל-${payload.length} חדרים? פעולה זו תאפס את הצ'ק ליסטים שלהם.`)) {
            publishMutation.mutate(payload);
        }
    };
    if (isLoading) return <div className="p-10 text-center">טוען חדרים...</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 min-h-screen bg-slate-50 space-y-6">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                 <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <CalendarDays className="text-blue-600"/> סידור עבודה יומי
                     </h1>
                    <p className="text-slate-500 text-sm mt-1">הגדרת סטטוסים והוראות מיוחדות למחר.</p>
                </div>
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="ml-2 h-4 w-4"/> חזור</Button>
                    <Button onClick={handlePublish} disabled={publishMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                         {publishMutation.isPending ?
<RefreshCw className="animate-spin ml-2"/> : <Save className="ml-2"/>}
                        הפץ סידור עבודה
                    </Button>
                </div>
             </header>

            {/* תוכן ראשי */}
            <Tabs defaultValue={Object.keys(hotelsData)[0]} className="w-full">
                 <TabsList className="bg-white p-1 border">
                    {Object.keys(hotelsData).map(hotelName => (
                        <TabsTrigger key={hotelName} value={hotelName} className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                             <Hotel className="w-4 h-4 ml-2"/> {hotelName}
                        </TabsTrigger>
                    ))}
                 </TabsList>

                {Object.entries(hotelsData).map(([hotelName, hotelRooms]) => (
                    <TabsContent key={hotelName} value={hotelName}>
                         <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                     <table className="w-full text-sm text-right">
                                        <thead className="bg-slate-50 text-slate-600 border-b">
                                             <tr>
                                                 <th className="p-4 w-24">חדר</th>
                                                <th className="p-4 w-32">מצב נוכחי</th>
                                                 <th className="p-4 w-48">פעולה למחר</th>
                                                <th className="p-4">הערות מיוחדות (שכבה ב')</th>
                                             </tr>
                                         </thead>
                                        <tbody className="divide-y divide-slate-100">
                                             {hotelRooms.map(room => {
                                                const draft = planDraft[room._id] || {};
                                                const isModified = draft.action && draft.action !== 'none';

                                                return (
                                                    <tr key={room._id} className={`hover:bg-blue-50/30 transition-colors ${isModified ? 'bg-blue-50/50' : ''}`}>
                                                         <td className="p-4 font-bold text-lg">{room.roomNumber}</td>

                                                         {/* מצב נוכחי */}
                                                        <td className="p-4">
                                                             <span className={`px-2 py-1 rounded text-xs ${
                                                                 room.status === 'clean' ? 'bg-green-100 text-green-700' :
                                                                 room.status === 'maintenance' ? 'bg-red-100 text-red-700' :
                                                                 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                 {room.status === 'clean' ? 'נקי' :
                                                                 room.status === 'maintenance' ? 'תקול' : 'מלוכלך'}
                                                            </span>
                                                         </td>

                                                         {/* בחירת פעולה */}
                                                        <td className="p-4">
                                                             <Select
                                                                 value={draft.action || 'none'}
                                                                onValueChange={(val) => updateDraft(room._id, 'action', val)}
                                                             >
                                                                 <SelectTrigger className={`h-9 ${isModified ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
                                                                    <SelectValue placeholder="בחר..." />
                                                                 </SelectTrigger>
                                                                 <SelectContent>
                                                                     <SelectItem value="none">-- ללא שינוי --</SelectItem>
                                                                    <SelectItem value="checkout">עזיבה (Checkout)</SelectItem>
                                                                     <SelectItem value="stayover">נשאר (Stayover)</SelectItem>
                                                                 </SelectContent>
                                                             </Select>
                                                        </td>

                                                         {/* הערות */}
                                                         <td className="p-4">
                                                            <Input
                                                                 placeholder="למשל: להוסיף לול, בקבוק יין..."
                                                                 value={draft.note || ''}
                                                                onChange={(e) => updateDraft(room._id, 'note', e.target.value)}
                                                                 className={draft.note ? "border-amber-400 bg-amber-50" : ""}
                                                            />
                                                         </td>
                                                      </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                 </div>
                            </CardContent>
                         </Card>
                    </TabsContent>
                ))}
            </Tabs>
         </div>
    );
}