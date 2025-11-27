import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Input } from '@/components/ui/Input.jsx';
import { ListChecks, PlusCircle, ArrowUp, ArrowDown, X, Hotel } from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const updateMasterChecklist = ({ id, checklist }) => api.put(`/admin/hotels/${id}/checklist`, { checklist });

export default function ManageChecklistsPage() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const { data: hotels = [], isLoading } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });

    if (isLoading) return <div className="p-8 text-center">טוען מלונות...</div>;

    return (
        <div className="container mx-auto p-6 space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <ListChecks className="text-blue-600"/> ניהול נהלי ניקיון (צ'ק ליסט)
                </h1>
                <p className="text-gray-600 mt-1">כאן מגדירים מה העובדים חייבים לבצע בכל ניקיון חדר.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hotels.map(hotel => (
                    <Card key={hotel._id} className="hover:shadow-md transition-shadow cursor-pointer border-t-4 border-t-blue-500" onClick={() => setSelectedHotel(hotel)}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                {hotel.name}
                                <Hotel size={20} className="text-gray-400"/>
                            </CardTitle>
                            <CardDescription>
                                {hotel.masterChecklist?.length || 0} משימות מוגדרות
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full">ערוך רשימה</Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {selectedHotel && (
                <ChecklistDialog 
                    hotel={selectedHotel} 
                    isOpen={!!selectedHotel} 
                    onClose={() => setSelectedHotel(null)} 
                />
            )}
        </div>
    );
}

// --- אותו דיאלוג עריכה שהיה קודם, עכשיו כחלק מהדף הזה ---
function ChecklistDialog({ hotel, isOpen, onClose }) {
    const queryClient = useQueryClient();
    const [checklist, setChecklist] = useState(hotel.masterChecklist || []);
    const [newItemText, setNewItemText] = useState('');

    const updateMutation = useMutation({
        mutationFn: (newChecklist) => updateMasterChecklist({ id: hotel._id, checklist: newChecklist }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hotels'] });
            toast.success("הרשימה עודכנה בהצלחה!");
            onClose();
        },
        onError: () => toast.error('שגיאה בשמירה')
    });

    const addItem = () => {
        if (!newItemText.trim()) return;
        setChecklist([...checklist, { text: newItemText.trim(), order: checklist.length }]);
        setNewItemText('');
    };

    const removeItem = (index) => setChecklist(checklist.filter((_, i) => i !== index));
    
    const moveItem = (index, direction) => {
        const newList = [...checklist];
        const item = newList[index];
        newList.splice(index, 1);
        newList.splice(index + direction, 0, item);
        setChecklist(newList);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>עריכת נהלים - {hotel.name}</DialogTitle>
                    <DialogDescription>רשימה זו תופיע אוטומטית כשהחדר מסומן כ"מלוכלך".</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                        <Input placeholder="משימה חדשה (למשל: החלפת מגבות)..." value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} />
                        <Button onClick={addItem}><PlusCircle/></Button>
                    </div>
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto bg-slate-50 p-2 rounded border">
                        {checklist.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border shadow-sm">
                                <span className="flex items-center gap-2"><span className="font-mono text-gray-400 text-xs">{idx + 1}.</span> {item.text}</span>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveItem(idx, -1)}><ArrowUp size={14}/></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === checklist.length - 1} onClick={() => moveItem(idx, 1)}><ArrowDown size={14}/></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 ml-2" onClick={() => removeItem(idx)}><X size={14}/></Button>
                                </div>
                            </div>
                        ))}
                        {checklist.length === 0 && <p className="text-center text-gray-400 py-4">הרשימה ריקה.</p>}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>ביטול</Button>
                    <Button onClick={() => updateMutation.mutate(checklist)} disabled={updateMutation.isPending}>{updateMutation.isPending ? 'שומר...' : 'שמור שינויים'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}