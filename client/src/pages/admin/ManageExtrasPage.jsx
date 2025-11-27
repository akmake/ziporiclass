// client/src/pages/admin/ManageExtrasPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/utils/api.js';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { PlusCircle, Trash2, Tag, LoaderCircle } from 'lucide-react';

// API Functions
const fetchExtras = async () => (await api.get('/admin/extras')).data;
const createExtra = (name) => api.post('/admin/extras', { name });
const deleteExtra = (id) => api.delete(`/admin/extras/${id}`);

export default function ManageExtrasPage() {
    const [newExtraName, setNewExtraName] = useState('');
    const queryClient = useQueryClient();

    const { data: extras = [], isLoading, isError } = useQuery({
        queryKey: ['extraTypes'],
        queryFn: fetchExtras,
    });

    const createMutation = useMutation({
        mutationFn: createExtra,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['extraTypes'] });
            toast.success('סוג תוספת נוסף בהצלחה!');
            setNewExtraName('');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה ביצירה')
    });

    const deleteMutation = useMutation({
        mutationFn: deleteExtra,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['extraTypes'] });
            toast.success('נמחק בהצלחה!');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה במחיקה')
    });

    const handleAdd = (e) => {
        e.preventDefault();
        if (newExtraName.trim()) {
            createMutation.mutate(newExtraName.trim());
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Tag className="text-primary"/> ניהול סוגי תוספות
                </h1>
                <p className="mt-2 text-lg text-gray-600">
                    כאן ניתן להגדיר סוגים של תוספות (כמו "אולם", "הגברה") שיופיעו כאפשרויות בעת יצירת הזמנה.
                </p>
            </header>

            {/* טופס הוספה */}
            <Card className="border-t-4 border-t-primary shadow-md">
                <CardHeader>
                    <CardTitle>הוספת סוג חדש</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAdd} className="flex gap-4 items-center">
                        <Input 
                            placeholder="שם התוספת (לדוגמה: אולם כנסים)" 
                            value={newExtraName}
                            onChange={(e) => setNewExtraName(e.target.value)}
                            className="max-w-md"
                            required
                        />
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? <LoaderCircle className="animate-spin ml-2 h-4 w-4"/> : <PlusCircle className="ml-2 h-4 w-4"/>}
                            הוסף
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* רשימה קיימת */}
            <Card>
                <CardHeader>
                    <CardTitle>רשימת התוספות במערכת</CardTitle>
                    <CardDescription>סה"כ {extras.length} סוגים מוגדרים.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <div className="text-center p-10"><LoaderCircle className="animate-spin h-8 w-8 mx-auto"/></div> : 
                     isError ? <div className="text-center text-red-500">שגיאה בטעינת הנתונים.</div> :
                     extras.length === 0 ? 
                        <div className="text-center py-10 text-gray-500 bg-slate-50 rounded border border-dashed">עדיין לא הוגדרו תוספות.</div> :
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {extras.map((extra) => (
                                <div key={extra._id} className="flex justify-between items-center p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                    <span className="font-semibold text-lg text-slate-800">{extra.name}</span>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => {
                                            if(window.confirm('האם למחוק סוג זה?')) deleteMutation.mutate(extra._id);
                                        }}
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    }
                </CardContent>
            </Card>
        </div>
    );
}