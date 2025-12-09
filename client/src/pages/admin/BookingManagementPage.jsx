import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from '@/components/ui/Label.jsx';
import { UploadCloud, FileUp, CheckCircle, AlertTriangle, LoaderCircle } from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;

export default function BookingManagementPage() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState(null); // נתונים לתצוגה לפני שמירה

    const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: fetchHotels });

    const uploadMutation = useMutation({
        mutationFn: ({ formData }) => api.post('/bookings/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
        onSuccess: (res, variables) => {
            const isDryRun = variables.formData.get('dryRun') === 'true';
            
            if (isDryRun) {
                // שלב 1: הצגת סימולציה
                setPreviewData(res.data);
                toast.success('הקובץ נבדק! אנא אשר את השינויים.');
            } else {
                // שלב 2: שמירה סופית
                toast.success(res.data.message);
                setPreviewData(null);
                setFile(null);
            }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'שגיאה בהעלאה')
    });

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setPreviewData(null); // איפוס תצוגה מקדימה אם בוחרים קובץ חדש
        }
    };

    const handleProcess = (isDryRun) => {
        if (!file || !selectedHotel) return toast.error('חובה לבחור מלון וקובץ');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('hotelId', selectedHotel);
        formData.append('dryRun', isDryRun);

        uploadMutation.mutate({ formData });
    };

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-4xl">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <UploadCloud className="text-blue-600" /> קליטת סידור עבודה (אקסל)
                </h1>
                <p className="mt-2 text-gray-600">
                    העלה את דוח ההזמנות היומי. המערכת תזהה לבד כניסות, עזיבות, ומיטות נדרשות.
                </p>
            </header>

            <Card>
                <CardHeader><CardTitle>העלאת קובץ</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>בחר מלון</Label>
                            <Select value={selectedHotel || ''} onValueChange={setSelectedHotel}>
                                <SelectTrigger><SelectValue placeholder="בחר מלון..." /></SelectTrigger>
                                <SelectContent>
                                    {hotels.map(h => <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>קובץ אקסל</Label>
                            <div className="relative">
                                <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className="border border-input rounded-md p-2 bg-white flex items-center gap-2 text-sm text-gray-500">
                                    <FileUp size={16}/> {file ? file.name : "לחץ לבחירת קובץ..."}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        {!previewData ? (
                            <Button 
                                onClick={() => handleProcess(true)} 
                                disabled={!file || !selectedHotel || uploadMutation.isPending}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                            >
                                {uploadMutation.isPending ? <LoaderCircle className="animate-spin ml-2"/> : <UploadCloud className="ml-2"/>}
                                נתח קובץ והצג שינויים
                            </Button>
                        ) : (
                            <div className="flex gap-4 w-full animate-in fade-in">
                                <Button variant="outline" onClick={() => setPreviewData(null)} className="flex-1">ביטול</Button>
                                <Button 
                                    onClick={() => handleProcess(false)} 
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    disabled={uploadMutation.isPending}
                                >
                                    <CheckCircle className="ml-2 h-4 w-4"/>
                                    אשר ועדכן את החדרים
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* תצוגה מקדימה של התוצאות */}
            {previewData && (
                <div className="space-y-4 animate-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="p-4 text-center">
                                <p className="text-sm font-bold text-blue-800">חדרים לעדכון</p>
                                <p className="text-3xl font-black text-blue-900">{previewData.details?.length || 0}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-50 border-amber-200">
                            <CardContent className="p-4 text-center">
                                <p className="text-sm font-bold text-amber-800">חדרים חדשים שייווצרו</p>
                                <p className="text-3xl font-black text-amber-900">{previewData.createdRooms?.length || 0}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-green-50 border-green-200">
                            <CardContent className="p-4 text-center">
                                <p className="text-sm font-bold text-green-800">סטטוס תקינות</p>
                                <p className="text-xl font-black text-green-900 mt-1">קובץ תקין ✅</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader><CardTitle>פירוט השינויים הצפויים</CardTitle></CardHeader>
                        <CardContent className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="p-2">חדר</th>
                                        <th className="p-2">סטטוס זוהה</th>
                                        <th className="p-2">משימות</th>
                                        <th className="p-2">בקשות מיוחדות (מיטות/לולים)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.details?.map((room, idx) => (
                                        <tr key={idx} className="border-b">
                                            <td className="p-2 font-bold">{room.room}</td>
                                            <td className="p-2">
                                                <span className={`px-2 py-1 rounded text-xs font-bold 
                                                    ${room.status === 'arrival' ? 'bg-blue-100 text-blue-700' : 
                                                      room.status === 'departure' ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>
                                                    {room.status === 'arrival' ? 'כניסה' : room.status === 'departure' ? 'עזיבה' : room.status}
                                                </span>
                                            </td>
                                            <td className="p-2">{room.tasksCount}</td>
                                            <td className="p-2 font-bold text-amber-600">{room.specialRequests > 0 ? `${room.specialRequests} ⚠️` : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
