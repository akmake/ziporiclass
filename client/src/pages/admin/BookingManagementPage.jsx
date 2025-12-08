import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from '@/components/ui/Label.jsx';
import { UploadCloud, AlertTriangle, CheckCircle, FileUp, LoaderCircle, ArrowLeft } from 'lucide-react';

const fetchHotels = async () => (await api.get('/admin/hotels')).data;

export default function BookingManagementPage() {
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [file, setFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null); // כאן נשמור את תוצאת הסימולציה/העלאה
    
    const queryClient = useQueryClient();

    const { data: hotels = [], isLoading: isLoadingHotels } = useQuery({
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
                    toast.success('הקובץ תקין! ניתן לאשר יצירה.');
                } else {
                    toast("נמצאו התנגשויות - יש לטפל בהן.", { icon: '⚠️' });
                }
            } else {
                // הצלחה מלאה
                toast.success(data.message);
                setUploadResult(null);
                setFile(null);
            }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'שגיאה בהעלאה')
    });

    const resolveConflictMutation = useMutation({
        mutationFn: (payload) => api.post('/bookings/resolve', payload),
        onSuccess: (res) => {
            toast.success(res.data.message);
            // מסירים את ההתנגשות מהרשימה המקומית כדי שהמשתמש יראה התקדמות
            setUploadResult(prev => ({
                ...prev,
                conflicts: prev.conflicts.filter(c => 
                    // מסננים את הקונפליקט שטופל (לפי חדר או מזהה אחר)
                    // כאן לצורך הפשטות נניח שאנחנו מרעננים את המסך או שמסירים לפי אינדקס אם היה לנו
                    // בגרסה פשוטה: פשוט נסיר את הראשון שמתאים לחדר
                    c.roomNumber !== res.data.resolvedRoomNumber // נצטרך שהשרת יחזיר את זה, או שנעשה אופטימיסטי
                )
            }));
            
            // מכיוון שאין לנו מזהה ייחודי לקונפליקט בזיכרון כרגע (אלא אם השרת מחזיר), 
            // הכי נכון זה פשוט לרענן או להסתיר ידנית.
            // לגרסה הזו: נבקש מהמשתמש להעלות שוב כדי לוודא? לא, זה מתיש.
            // נשאיר את זה פשוט: נסיר את ההתנגשות שטופלה מהסטייט המקומי.
        },
        onError: () => toast.error('שגיאה בפתרון ההתנגשות')
    });

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setUploadResult(null); // איפוס תוצאות קודמות
        }
    };

    const handleUpload = (isDryRun) => {
        if (!file || !selectedHotel) return toast.error('חובה לבחור מלון וקובץ');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('hotelId', selectedHotel);
        formData.append('dryRun', isDryRun);

        uploadMutation.mutate(formData);
    };

    const handleResolve = (conflict, action) => {
        // action: 'overwrite' | 'ignore'
        resolveConflictMutation.mutate({
            action,
            conflictData: conflict
        }, {
            onSuccess: () => {
                // עדכון לוקאלי של הרשימה
                setUploadResult(prev => ({
                    ...prev,
                    conflicts: prev.conflicts.filter(c => c !== conflict)
                }));
            }
        });
    };

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-5xl">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <UploadCloud className="text-blue-600" /> קליטת סידור עבודה (אקסל)
                </h1>
                <p className="mt-2 text-gray-600">
                    העלאת קובץ שיבוץ חדרים, זיהוי חדרים חדשים ופתרון התנגשויות תאריכים.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>העלאת קובץ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>בחר מלון</Label>
                            <Select value={selectedHotel || ''} onValueChange={setSelectedHotel}>
                                <SelectTrigger>
                                    <SelectValue placeholder="בחר מלון..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {hotels.map(h => <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>קובץ אקסל (XLSX)</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-grow">
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="border border-input rounded-md p-2 bg-white flex items-center gap-2 text-sm text-gray-500">
                                        <FileUp size={16}/>
                                        {file ? file.name : "לחץ לבחירת קובץ..."}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Button 
                            onClick={() => handleUpload(true)} 
                            disabled={!file || !selectedHotel || uploadMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {uploadMutation.isPending ? <LoaderCircle className="animate-spin ml-2"/> : <UploadCloud className="ml-2"/>}
                            בדוק קובץ (סימולציה)
                        </Button>
                        
                        {/* כפתור שמירה סופי מופיע רק אם הכל תקין בסימולציה */}
                        {uploadResult?.status === 'simulation' && uploadResult.conflicts.length === 0 && (
                            <Button 
                                onClick={() => handleUpload(false)} 
                                className="bg-green-600 hover:bg-green-700 animate-in fade-in"
                            >
                                <CheckCircle className="ml-2"/> אשר וצור שיבוצים
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* אזור תוצאות הסימולציה */}
            {uploadResult && (
                <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">
                    
                    {/* סיכום */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-green-50 border-green-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <CheckCircle className="text-green-600 h-8 w-8" />
                                <div>
                                    <p className="text-sm text-green-800 font-bold">שיבוצים תקינים</p>
                                    <p className="text-2xl font-bold text-green-900">{uploadResult.validCount}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <FileUp className="text-blue-600 h-8 w-8" />
                                <div>
                                    <p className="text-sm text-blue-800 font-bold">חדרים חדשים שייווצרו</p>
                                    <p className="text-2xl font-bold text-blue-900">{uploadResult.newRoomsCreated?.length || 0}</p>
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

                    {/* רשימת התנגשויות */}
                    {uploadResult.conflicts.length > 0 && (
                        <div className="bg-white rounded-lg border border-red-100 shadow-sm overflow-hidden">
                            <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2 text-red-800 font-bold">
                                <AlertTriangle size={20}/>
                                יש לפתור את ההתנגשויות הבאות כדי להמשיך:
                            </div>
                            <div className="divide-y divide-gray-100">
                                {uploadResult.conflicts.map((conflict, idx) => (
                                    <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                        
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-slate-200 text-slate-800 px-2 py-1 rounded text-xs font-bold">חדר {conflict.roomNumber}</span>
                                                <span className="text-red-600 text-sm font-bold">חפיפת תאריכים</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="bg-white border p-2 rounded">
                                                    <p className="text-gray-500 text-xs mb-1">קיים במערכת:</p>
                                                    <p className="font-medium text-gray-700">
                                                        {format(new Date(conflict.existingBooking.start), 'dd/MM')} - {format(new Date(conflict.existingBooking.end), 'dd/MM')}
                                                    </p>
                                                </div>
                                                <div className="bg-blue-50 border border-blue-100 p-2 rounded">
                                                    <p className="text-blue-600 text-xs mb-1">חדש מהקובץ:</p>
                                                    <p className="font-bold text-blue-900">
                                                        {format(new Date(conflict.newBooking.start), 'dd/MM')} - {format(new Date(conflict.newBooking.end), 'dd/MM')}
                                                    </p>
                                                    <p className="text-xs text-blue-800">
                                                        {conflict.newBooking.pax} אורחים
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 items-center">
                                            <Button size="sm" variant="outline" onClick={() => handleResolve(conflict, 'ignore')}>
                                                התעלם מהחדש
                                            </Button>
                                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleResolve(conflict, 'overwrite')}>
                                                דרוס את הישן
                                            </Button>
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