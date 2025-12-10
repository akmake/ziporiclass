import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from '@/components/ui/Label.jsx';
import { UploadCloud, AlertTriangle, CheckCircle, FileUp, LoaderCircle } from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;

export default function BookingManagementPage() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [file, setFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);

    const { data: hotels = [] } = useQuery({
        queryKey: ['hotels'],
        queryFn: fetchHotels,
    });

    const uploadMutation = useMutation({
        mutationFn: (formData) => api.post('/bookings/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
        onSuccess: (res) => {
            const data = res.data;
            if (data.status === 'simulation') {
                setUploadResult(data);
                if (data.conflicts.length === 0) {
                    toast.success('קובץ תקין, שומר...');
                    handleUpload(false);
                } else {
                    toast("נמצאו התנגשויות", { icon: '⚠️' });
                }
            } else {
                toast.success(data.message);
                setUploadResult(null);
                setFile(null);
            }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'שגיאה')
    });

    const resolveConflictMutation = useMutation({
        mutationFn: (payload) => api.post('/bookings/resolve', payload),
        onSuccess: (res) => {
            toast.success(res.data.message);
            setUploadResult(prev => ({
                ...prev,
                conflicts: prev.conflicts.filter(c => c.roomNumber !== res.data.resolvedRoomNumber) // (זהירות, הלוגיקה כאן פשוטה לתצוגה)
            }));
            // בפועל השרת מטפל בזה, אנחנו רק מרעננים את ה-UI
            // אפשר גם לאפס את התוצאות אם רוצים להעלות מחדש
        },
        onError: () => toast.error('שגיאה')
    });

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setUploadResult(null);
        }
    };

    const handleUpload = (isDryRun) => {
        if (!file || !selectedHotel) return toast.error('חסרים פרטים');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('hotelId', selectedHotel);
        formData.append('dryRun', isDryRun);
        uploadMutation.mutate(formData);
    };

    const handleResolve = (conflict, action) => {
        resolveConflictMutation.mutate({
            action,
            conflictData: conflict
        }, {
            onSuccess: () => {
                // הסרה מקומית מהרשימה
                setUploadResult(prev => ({
                    ...prev,
                    conflicts: prev.conflicts.filter(c => c !== conflict)
                }));
            }
        });
    };

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-5xl" dir="rtl">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <UploadCloud className="text-blue-600" /> קליטת אקסל הזמנות
                </h1>
                <p className="mt-2 text-gray-600">
                    טעינת קובץ השיבוץ. לאחר הקליטה, יש לעבור למסך "סידור עבודה" כדי להפיץ את הנתונים לחדרים.
                </p>
            </header>

            <Card>
                <CardHeader><CardTitle>העלאת קובץ</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>בחר מלון</Label>
                            <Select value={selectedHotel || ''} onValueChange={setSelectedHotel}>
                                <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                                <SelectContent>
                                    {hotels.map(h => <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>קובץ XLSX</Label>
                            <div className="relative">
                                <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className="border border-input rounded-md p-2 bg-white flex items-center gap-2 text-sm text-gray-500 h-10">
                                    <FileUp size={16}/>
                                    {file ? file.name : "לחץ לבחירה..."}
                                </div>
                            </div>
                        </div>
                    </div>

                    <Button 
                        onClick={() => handleUpload(true)} 
                        disabled={!file || !selectedHotel || uploadMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
                    >
                        {uploadMutation.isPending ? <LoaderCircle className="animate-spin ml-2"/> : <UploadCloud className="ml-2"/>}
                        טען למערכת
                    </Button>
                </CardContent>
            </Card>

            {uploadResult && (
                <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-green-50 border-green-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <CheckCircle className="text-green-600 h-8 w-8" />
                                <div>
                                    <p className="text-sm text-green-800 font-bold">תקינים</p>
                                    <p className="text-2xl font-bold text-green-900">{uploadResult.validCount}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className={`${uploadResult.conflicts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                            <CardContent className="p-4 flex items-center gap-4">
                                <AlertTriangle className={`${uploadResult.conflicts.length > 0 ? 'text-red-600' : 'text-gray-400'} h-8 w-8`} />
                                <div>
                                    <p className={`text-sm font-bold ${uploadResult.conflicts.length > 0 ? 'text-red-800' : 'text-gray-500'}`}>התנגשויות</p>
                                    <p className={`text-2xl font-bold ${uploadResult.conflicts.length > 0 ? 'text-red-900' : 'text-gray-600'}`}>{uploadResult.conflicts.length}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {uploadResult.conflicts.length > 0 && (
                        <div className="bg-white rounded-lg border border-red-100 shadow-sm overflow-hidden">
                            <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2 text-red-800 font-bold">
                                <AlertTriangle size={20}/> יש לפתור את ההתנגשויות הבאות:
                            </div>
                            <div className="divide-y divide-gray-100">
                                {uploadResult.conflicts.map((conflict, idx) => (
                                    <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-slate-200 text-slate-800 px-2 py-1 rounded text-xs font-bold">חדר {conflict.roomNumber}</span>
                                                <span className="text-red-600 text-sm font-bold">כפילות תאריכים</span>
                                            </div>
                                            <p className="text-sm text-gray-600">יש כבר שיבוץ פעיל בתאריכים אלו.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => handleResolve(conflict, 'ignore')}>התעלם מהחדש</Button>
                                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleResolve(conflict, 'overwrite')}>דרוס את הישן</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}