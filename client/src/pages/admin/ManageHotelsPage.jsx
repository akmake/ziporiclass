import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/utils/api.js';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { PlusCircle, Trash2, Hotel, BedDouble, ListChecks, X, ArrowUp, ArrowDown } from 'lucide-react';

// API Functions
const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const createHotel = (name) => api.post('/admin/hotels', { name });
const deleteHotel = (id) => api.delete(`/admin/hotels/${id}`);
const updateMasterChecklist = ({ id, checklist }) => api.put(`/admin/hotels/${id}/checklist`, { checklist });

// Room Types API
const fetchRoomTypes = async (hotelId) => (await api.get(`/admin/room-types/by-hotel/${hotelId}`)).data;
const createRoomType = (data) => api.post('/admin/room-types', data);
const deleteRoomType = (id) => api.delete(`/admin/room-types/${id}`);

export default function ManageHotelsPage() {
    const [newHotelName, setNewHotelName] = useState('');
    const [selectedHotelForRooms, setSelectedHotelForRooms] = useState(null);
    const [selectedHotelForChecklist, setSelectedHotelForChecklist] = useState(null);

    const queryClient = useQueryClient();

    const { data: hotels = [], isLoading, isError } = useQuery({
        queryKey: ['hotels'],
        queryFn: fetchHotels,
    });

    const { mutate: create, isPending: isCreating } = useMutation({
        mutationFn: createHotel,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hotels'] });
            toast.success('המלון נוסף בהצלחה!');
            setNewHotelName('');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה'),
    });

    const { mutate: remove } = useMutation({
        mutationFn: deleteHotel,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hotels'] });
            toast.success('המלון נמחק בהצלחה!');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה'),
    });

    const handleAddHotel = (e) => {
        e.preventDefault();
        if (newHotelName.trim()) create(newHotelName.trim());
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Hotel /> ניהול בתי מלון</h1>
                <p className="mt-2 text-gray-600">הגדרת מלונות, סוגי חדרים ונהלי עבודה (צ'ק ליסט).</p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>הוספת מלון חדש</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddHotel} className="flex items-center gap-4">
                        <Input
                            placeholder="שם המלון החדש"
                            value={newHotelName}
                            onChange={(e) => setNewHotelName(e.target.value)}
                            className="flex-grow"
                            required
                        />
                        <Button type="submit" disabled={isCreating}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            {isCreating ? 'מוסיף...' : 'הוסף'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>רשימת המלונות</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading && <p>טוען...</p>}
                    {isError && <p className="text-red-500">שגיאה בטעינה.</p>}
                    <div className="space-y-2">
                        {hotels.map(hotel => (
                            <div key={hotel._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors">
                                <span className="font-medium text-lg">{hotel.name}</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setSelectedHotelForChecklist(hotel)}>
                                        <ListChecks className="ml-2 h-4 w-4" />
                                        ניהול צ'ק ליסט
                                    </Button>

                                    <Button variant="outline" size="sm" onClick={() => setSelectedHotelForRooms(hotel)}>
                                        <BedDouble className="ml-2 h-4 w-4" />
                                        סוגי חדרים
                                    </Button>

                                    <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`למחוק את "${hotel.name}"?`)) remove(hotel._id); }}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* דיאלוג ניהול צ'ק ליסט ראשי */}
            {selectedHotelForChecklist && (
                <MasterChecklistDialog
                    hotel={selectedHotelForChecklist}
                    isOpen={!!selectedHotelForChecklist}
                    onClose={() => setSelectedHotelForChecklist(null)}
                />
            )}

            {/* דיאלוג ניהול סוגי חדרים */}
            {selectedHotelForRooms && (
                <RoomTypesManagerDialog
                    hotel={selectedHotelForRooms}
                    isOpen={!!selectedHotelForRooms}
                    onClose={() => setSelectedHotelForRooms(null)}
                />
            )}
        </div>
    );
}

// --- קומפוננטת ניהול צ'ק ליסט ראשי ---
function MasterChecklistDialog({ hotel, isOpen, onClose }) {
    const queryClient = useQueryClient();
    
    // המרה ממבנה ישן או חדש למבנה אחיד
    const initialList = hotel.masterChecklist && hotel.masterChecklist.length > 0
        ? hotel.masterChecklist
        : (hotel.defaultTasks || []).map((t, i) => ({ text: t, order: i }));

    const [checklist, setChecklist] = useState(initialList);
    const [newItemText, setNewItemText] = useState('');

    const updateMutation = useMutation({
        mutationFn: (newChecklist) => updateMasterChecklist({ id: hotel._id, checklist: newChecklist }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hotels'] });
            // ✨ התיקון כאן: שימוש במרכאות כפולות כדי למנוע שבירה בגלל הגרש ב-"הצ'ק"
            toast.success("הצ'ק ליסט עודכן בהצלחה!"); 
            onClose();
        },
        onError: () => toast.error('שגיאה בשמירה')
    });

    const addItem = () => {
        if (!newItemText.trim()) return;
        setChecklist([...checklist, { text: newItemText.trim(), order: checklist.length }]);
        setNewItemText('');
    };

    const removeItem = (index) => {
        const newList = checklist.filter((_, i) => i !== index);
        setChecklist(newList);
    };

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
                    <DialogTitle>ניהול צ'ק ליסט ראשי - {hotel.name}</DialogTitle>
                    <DialogDescription>
                        הגדר את סדר הפעולות הקבוע. רשימה זו תופיע אוטומטית בכל חדר בעת איפוס ל"מלוכלך".
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="הוסף משימה קבועה (למשל: בדיקת מיניבר)..." 
                            value={newItemText} 
                            onChange={e => setNewItemText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addItem()}
                        />
                        <Button onClick={addItem}><PlusCircle/></Button>
                    </div>

                    <div className="space-y-2 max-h-[60vh] overflow-y-auto bg-slate-50 p-2 rounded border">
                        {checklist.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border shadow-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-gray-400 w-6">{idx + 1}.</span>
                                    <span>{item.text}</span>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveItem(idx, -1)}>
                                        <ArrowUp size={14}/>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === checklist.length - 1} onClick={() => moveItem(idx, 1)}>
                                        <ArrowDown size={14}/>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 ml-2" onClick={() => removeItem(idx)}>
                                        <X size={14}/>
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {checklist.length === 0 && <p className="text-center text-gray-400 py-4">הרשימה ריקה.</p>}
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>ביטול</Button>
                    <Button onClick={() => updateMutation.mutate(checklist)} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? 'שומר...' : 'שמור שינויים'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// --- קומפוננטת ניהול סוגי חדרים ---
function RoomTypesManagerDialog({ hotel, isOpen, onClose }) {
    const queryClient = useQueryClient();
    const [newType, setNewType] = useState({ name: '', supplementPerNight: 0, isDefault: false });
    const { data: roomTypes = [], isLoading } = useQuery({
        queryKey: ['roomTypes', hotel._id],
        queryFn: () => fetchRoomTypes(hotel._id),
        enabled: !!hotel._id
    });
    const createMutation = useMutation({
        mutationFn: createRoomType,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roomTypes', hotel._id] });
            toast.success('סוג חדר נוסף!');
            setNewType({ name: '', supplementPerNight: 0, isDefault: false });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'שגיאה')
    });
    const deleteMutation = useMutation({
        mutationFn: deleteRoomType,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roomTypes', hotel._id] });
            toast.success('סוג חדר נמחק!');
        }
    });
    const handleSubmit = (e) => {
        e.preventDefault();
        createMutation.mutate({ ...newType, hotel: hotel._id });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>ניהול סוגי חדרים - {hotel.name}</DialogTitle>
                    <DialogDescription>הוסף חדרים מיוחדים ותמחור.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-lg border space-y-4 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input placeholder="שם (למשל: סוויטה)" value={newType.name} onChange={e => setNewType(p => ({ ...p, name: e.target.value }))} required />
                        <Input type="number" placeholder="תוספת ללילה" value={newType.supplementPerNight} onChange={e => setNewType(p => ({ ...p, supplementPerNight: Number(e.target.value) }))} min="0" />
                    </div>
                    <Button type="submit" size="sm" disabled={createMutation.isPending}><PlusCircle className="ml-2 h-4 w-4" /> הוסף</Button>
                </form>
                <div className="mt-4 max-h-[300px] overflow-y-auto">
                    {isLoading ? <p>טוען...</p> : (
                        <div className="space-y-2">
                            {roomTypes.map(rt => (
                                <div key={rt._id} className="flex justify-between items-center p-2 border-b">
                                    <span>{rt.name} (+{rt.supplementPerNight}₪)</span>
                                    <Button variant="ghost" size="icon" onClick={() => {if(window.confirm('למחוק?')) deleteMutation.mutate(rt._id)}}><Trash2 className="h-4 w-4 text-red-500"/></Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
