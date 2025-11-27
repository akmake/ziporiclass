import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Users, Edit, ArrowRightLeft, Search, Trophy, CheckCircle2 } from 'lucide-react';

const fetchStats = async () => (await api.get('/referrers/stats')).data;
const upsertAlias = (data) => api.post('/referrers', data);

export default function ManageReferrersPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editData, setEditData] = useState({ source: '', target: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    const { data: referrers = [], isLoading } = useQuery({
        queryKey: ['referrerStats'],
        queryFn: fetchStats
    });

    const updateMutation = useMutation({
        mutationFn: upsertAlias,
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['referrerStats'] });
            toast.success(res.data.message);
            setIsDialogOpen(false);
        },
        onError: () => toast.error('שגיאה')
    });

    const filteredList = referrers.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleEditClick = (referrer) => {
        setEditData({ source: referrer.name, target: referrer.name });
        setIsDialogOpen(true);
    };

    return (
        <div className="container mx-auto p-6 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Users className="text-blue-600" /> דוח שותפים (נסתר)
                </h1>
                <p className="text-gray-600 mt-1">
                    נתונים פנימיים למנהל בלבד. המוכרים רואים את הליד כרגיל.
                </p>
            </header>

            <Card className="shadow-md">
                <CardHeader className="pb-3 border-b bg-gray-50/50">
                    <div className="flex justify-between items-center">
                        <CardTitle>טבלת ביצועים</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
                            <Input className="pl-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="חפש..." />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="min-w-full text-sm divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                            <tr>
                                <th className="px-6 py-3 text-right">שם שותף</th>
                                <th className="px-6 py-3 text-right">לידים</th>
                                <th className="px-6 py-3 text-right">מכירות</th>
                                <th className="px-6 py-3 text-left">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {isLoading ? <tr><td colSpan="4" className="p-6 text-center">טוען...</td></tr> :
                             filteredList.length === 0 ? <tr><td colSpan="4" className="p-6 text-center text-gray-500">אין נתונים</td></tr> :
                             filteredList.map((item, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-gray-800 flex items-center gap-2">
                                        {idx === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                                        {item.name}
                                    </td>
                                    <td className="px-6 py-4"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">{item.count}</span></td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full font-bold ${item.sales > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                                {item.sales}
                                            </span>
                                            {item.count > 0 && <span className="text-xs text-gray-400">({Math.round((item.sales/item.count)*100)}%)</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left">
                                        <Button variant="outline" size="sm" onClick={() => handleEditClick(item)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                            <Edit className="h-3.5 w-3.5 ml-1.5"/> ערוך שם
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>מיזוג שמות</DialogTitle></DialogHeader>
                    <div className="py-4 flex items-center gap-2 justify-center">
                        <span className="line-through text-red-500">{editData.source}</span>
                        <ArrowRightLeft className="text-gray-400" />
                        <Input value={editData.target} onChange={e => setEditData(p => ({...p, target: e.target.value}))} className="w-40 font-bold text-center" />
                    </div>
                    <DialogFooter><Button onClick={() => updateMutation.mutate({ alias: editData.source, officialName: editData.target })}>שמור ועדכן</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
