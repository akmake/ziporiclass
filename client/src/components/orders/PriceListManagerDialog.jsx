// client/src/components/orders/PriceListManagerDialog.jsx

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/utils/api.js';
// UI Components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Edit, Trash2, PlusCircle, Lock } from 'lucide-react';

// API Functions
const fetchPriceListsForHotel = async (hotelId) => (await api.get(`/pricelists?hotelId=${hotelId}`)).data;
const createPriceList = (data) => api.post('/pricelists', data);
const updatePriceList = ({ id, ...data }) => api.put(`/pricelists/${id}`, data);
const deletePriceList = (id) => api.delete(`/pricelists/${id}`);

// Helper component for the form
const PriceListForm = ({ hotelId, priceList, onSave, onCancel, isSaving }) => {
    // ✨ הוספנו את maxNights לסטייט ההתחלתי
    const [formData, setFormData] = useState({
        name: '', couple: 0, teen: 0, child: 0, baby: 0, single_room: 0, maxNights: 0
    });

    useEffect(() => {
        if (priceList) {
            setFormData({ ...priceList });
        } else {
            // ✨ איפוס כולל maxNights
            setFormData({ name: '', hotel: hotelId, couple: 0, teen: 0, child: 0, baby: 0, single_room: 0, maxNights: 0 });
        }
    }, [priceList, hotelId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = Object.fromEntries(
            Object.entries(formData).map(([key, value]) => [key, value === '' ? 0 : value])
        );
        onSave({ ...dataToSave, hotel: hotelId });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">{priceList ? 'עריכת מחירון' : 'הוספת מחירון חדש'}</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <Input name="name" placeholder="שם (למשל: סופש)" value={formData.name || ''} onChange={handleChange} required />
                </div>
                
                <Input name="couple" type="number" placeholder="מחיר לזוג" value={formData.couple || ''} onChange={handleChange} />
                <Input name="single_room" type="number" placeholder="מחיר ליחיד" value={formData.single_room || ''} onChange={handleChange} />

                <Input name="teen" type="number" placeholder="מחיר לנער" value={formData.teen || ''} onChange={handleChange} />
                <Input name="child" type="number" placeholder="מחיר לילד" value={formData.child || ''} onChange={handleChange} />
                <Input name="baby" type="number" placeholder="מחיר לתינוק" value={formData.baby || ''} onChange={handleChange} />

                {/* ✨ שדה חדש להגבלת לילות */}
                <div className="relative">
                    <Lock className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input 
                        name="maxNights" 
                        type="number" 
                        placeholder="הגבלת לילות (0 = ללא)" 
                        value={formData.maxNights || ''} 
                        onChange={handleChange} 
                        className="pl-8 bg-amber-50/50 border-amber-200 focus:border-amber-500"
                        title="השאר 0 ללא הגבלה. רשום 1 כדי לקבע ללילה אחד."
                    />
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onCancel}>ביטול</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? 'שומר...' : 'שמור'}</Button>
            </div>
        </form>
    );
};


export default function PriceListManagerDialog({ isOpen, onClose, hotelId }) {
    const queryClient = useQueryClient();
    const [editingPriceList, setEditingPriceList] = useState(null); // null for new, object for editing

    const { data: priceLists = [], refetch } = useQuery({
        queryKey: ['priceListsMap', hotelId],
        queryFn: () => fetchPriceListsForHotel(hotelId),
        enabled: !!hotelId,
    });

    const commonMutationOptions = {
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['priceListsMap', hotelId] });
            setEditingPriceList(null); // Close form on success
        },
        onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה'),
    };

    const createMutation = useMutation({ ...commonMutationOptions, mutationFn: createPriceList, onSuccess: () => { toast.success('מחירון נוצר!'); commonMutationOptions.onSuccess(); } });
    const updateMutation = useMutation({ ...commonMutationOptions, mutationFn: updatePriceList, onSuccess: () => { toast.success('מחירון עודכן!'); commonMutationOptions.onSuccess(); } });
    const deleteMutation = useMutation({ ...commonMutationOptions, mutationFn: deletePriceList, onSuccess: () => { toast.success('מחירון נמחק!'); commonMutationOptions.onSuccess(); } });

    const handleSave = (data) => {
        if (editingPriceList && editingPriceList._id) {
            updateMutation.mutate({ id: editingPriceList._id, ...data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleDelete = (id) => {
        if (window.confirm('האם למחוק את המחירון?')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>ניהול מחירונים</DialogTitle>
                    <DialogDescription>ניהול מהיר של המחירונים עבור המלון הנבחר.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {priceLists.length > 0 ? (
                        priceLists.map(pl => (
                            <div key={pl._id} className="flex justify-between items-center p-2 rounded-md hover:bg-slate-50">
                                <div>
                                    <span className="font-medium">{pl.name}</span>
                                    {/* ✨ תצוגה ויזואלית אם יש מגבלה */}
                                    {pl.maxNights > 0 && (
                                        <span className="mr-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex-inline items-center gap-1">
                                            <Lock size={10} className="inline" /> 
                                            {pl.maxNights === 1 ? 'לילה 1 בלבד' : `עד ${pl.maxNights} לילות`}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => setEditingPriceList(pl)}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(pl._id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-slate-500 py-4">לא קיימים מחירונים למלון זה.</p>
                    )}
                </div>

                <PriceListForm
                    hotelId={hotelId}
                    priceList={editingPriceList}
                    onSave={handleSave}
                    onCancel={() => setEditingPriceList(null)}
                    isSaving={createMutation.isPending || updateMutation.isPending}
                />
            </DialogContent>
        </Dialog>
    );
}