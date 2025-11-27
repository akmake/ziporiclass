import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { Layers, ArrowRight } from 'lucide-react';

export default function ManagePhysicalRoomsPage() {
    const [hotelId, setHotelId] = useState('');
    const [roomTypeId, setRoomTypeId] = useState('');
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    
    const queryClient = useQueryClient();

    // שליפת נתונים
    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: async () => (await api.get('/admin/hotels')).data });
    
    const { data: roomTypes = [] } = useQuery({
        queryKey: ['roomTypes', hotelId],
        queryFn: async () => (await api.get(`/admin/room-types/by-hotel/${hotelId}`)).data,
        enabled: !!hotelId
    });

    // יצירה
    const createMutation = useMutation({
        mutationFn: (data) => api.post('/rooms/bulk', data),
        onSuccess: (res) => {
            toast.success(res.data.message);
            setRangeStart('');
            setRangeEnd('');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'שגיאה ביצירה')
    });

    const handleSubmit = () => {
        if (!hotelId || !roomTypeId || !rangeStart || !rangeEnd) return toast.error('חסרים שדות');
        if (Number(rangeEnd) < Number(rangeStart)) return toast.error('טווח לא תקין');

        createMutation.mutate({
            hotel: hotelId,
            roomType: roomTypeId,
            startNumber: rangeStart,
            endNumber: rangeEnd
        });
    };

    return (
        <div className="container mx-auto p-6 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Layers className="text-blue-600"/> הקמת חדרים במערכת</CardTitle>
                    <CardDescription>יצירה מהירה של טווחי חדרים (למשל 101-120)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">1. בחר מלון</label>
                        <Select value={hotelId} onValueChange={setHotelId}>
                            <SelectTrigger><SelectValue placeholder="בחר מלון..." /></SelectTrigger>
                            <SelectContent>
                                {hotels.map(h => <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">2. בחר סוג חדר (עבור הטווח הזה)</label>
                        <Select value={roomTypeId} onValueChange={setRoomTypeId} disabled={!hotelId}>
                            <SelectTrigger><SelectValue placeholder={!hotelId ? "קודם בחר מלון" : "בחר סוג..."} /></SelectTrigger>
                            <SelectContent>
                                {roomTypes.map(rt => <SelectItem key={rt._id} value={rt._id}>{rt.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ממספר</label>
                            <Input type="number" placeholder="101" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <ArrowRight className="mb-3 text-gray-400" />
                            <div className="space-y-2 w-full">
                                <label className="text-sm font-medium">עד מספר</label>
                                <Input type="number" placeholder="120" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <Button className="w-full mt-4" onClick={handleSubmit} disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'יוצר חדרים...' : 'צור חדרים'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}