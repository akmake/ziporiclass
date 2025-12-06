import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { Label } from '@/components/ui/Label.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Input } from '@/components/ui/Input.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { 
    UploadCloud, FileSpreadsheet, AlertTriangle, Save, Filter, 
    CheckCircle2, Pencil, History, ChevronDown, ChevronUp, Search
} from 'lucide-react';

// --- הגדרות עמודות מהאקסל ---
const INV_COL_ID = "c_folio_number";
const INV_COL_NAME = "guest_name";
const INV_COL_AMOUNT = "invoice_amount";
const INV_COL_NUM = "c_invoice_number";

// --- פונקציות עזר ---
function parseMoney(val) {
    if (!val) return 0;
    let cleanStr = val.toString().replace(/,/g, '').trim();
    let num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
}

function cleanStr(val) {
    if (val === undefined || val === null) return "";
    return val.toString().trim();
}

export default function CommissionsPage() {
    const [activeTab, setActiveTab] = useState("generator");

    return (
        <div className="container mx-auto p-6 space-y-6 bg-slate-50 min-h-screen">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <FileSpreadsheet className="text-purple-600"/> ניהול עמלות מרוכז
                </h1>
                <p className="text-gray-600 mt-1">מערכת הצלבה, חישוב עמלות והיסטוריית תשלומים.</p>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-white border p-1 grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="generator">מחולל דוחות (חדש)</TabsTrigger>
                    <TabsTrigger value="history">היסטוריית דוחות</TabsTrigger>
                </TabsList>

                <TabsContent value="generator" className="mt-6">
                    <CommissionGenerator onReportGenerated={() => setActiveTab("history")} />
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <ReportsHistory />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ============================================================================
// 🟢 קומפוננטה 1: המחולל (Generator)
// ============================================================================
function CommissionGenerator({ onReportGenerated }) {
    // Data State
    const [invoicesMap, setInvoicesMap] = useState(null);
    const [reservationsData, setReservationsData] = useState(null);
    const [allClerks, setAllClerks] = useState([]);
    const [selectedClerks, setSelectedClerks] = useState(new Set());
    
    // Process State
    const [processedRows, setProcessedRows] = useState([]); // כל השורות (ירוק+אדום)
    const [selectedRows, setSelectedRows] = useState(new Set()); // מה נבחר להפקה
    const [step, setStep] = useState(1); // 1=Upload, 2=SelectClerks, 3=Table
    
    // Fix Dialog State
    const [isFixDialogOpen, setIsFixDialogOpen] = useState(false);
    const [rowToFix, setRowToFix] = useState(null);
    const [fixAmount, setFixAmount] = useState('');
    const [fixNote, setFixNote] = useState('');

    const queryClient = useQueryClient();

    // 1. טעינת רשימת ה-IDs שכבר שולמו בעבר (כדי לסנן אותם)
    const { data: paidHistoryIds = [] } = useQuery({
        queryKey: ['paidCommissionsIds'],
        queryFn: async () => (await api.get('/admin/commissions/paid-ids')).data
    });

    // 2. שמירת הדוח בשרת
    const generateMutation = useMutation({
        mutationFn: (items) => api.post('/admin/commissions/generate', { items }),
        onSuccess: () => {
            toast.success('הדוח הופק ונשמר בהצלחה!');
            // רענון נתונים
            queryClient.invalidateQueries(['paidCommissionsIds']);
            queryClient.invalidateQueries(['commissionReports']);
            resetAll();
            onReportGenerated(); // מעבר לטאב היסטוריה
        },
        onError: (err) => toast.error('שגיאה בשמירת הדוח: ' + (err.response?.data?.message || err.message))
    });

    const resetAll = () => {
        setStep(1);
        setProcessedRows([]);
        setInvoicesMap(null);
        setReservationsData(null);
        setAllClerks([]);
        setSelectedClerks(new Set());
        setSelectedRows(new Set());
    };

    // --- שלב א': טעינת קבצים ---
    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
                if (type === 'invoices') processInvoices(jsonData);
                else processReservations(jsonData);
            } catch (error) {
                toast.error("שגיאה בקריאת הקובץ");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const processInvoices = (data) => {
        const map = {};
        data.forEach(row => {
            let folioRaw = row[INV_COL_ID];
            let nameRaw = row[INV_COL_NAME] || row["guestname"];
            let amount = parseMoney(row[INV_COL_AMOUNT]);
            let invNum = row[INV_COL_NUM];

            if (folioRaw) {
                let folioStr = folioRaw.toString().trim();
                let masterId = folioStr.length > 6 ? folioStr.slice(0, -2) : folioStr;
                let key = "ID_" + masterId;
                if (!map[key]) map[key] = { amount: 0, numbers: new Set() };
                map[key].amount += amount;
                if(invNum) map[key].numbers.add(invNum);
            }
            if (nameRaw) {
                let cleanName = nameRaw.toString().trim();
                if (cleanName) {
                    let key = "NAME_" + cleanName;
                    if (!map[key]) map[key] = { amount: 0, numbers: new Set() };
                    map[key].amount += amount;
                    if(invNum) map[key].numbers.add(invNum);
                }
            }
        });
        setInvoicesMap(map);
        toast.success(`נטענו ${data.length} שורות חשבוניות`);
    };

    const processReservations = (data) => {
        setReservationsData(data);
        const clerksSet = new Set();
        data.forEach(row => {
            const clerk = cleanStr(row["c_taken_clerk"]);
            if (clerk) clerksSet.add(clerk);
        });
        const sortedClerks = Array.from(clerksSet).sort();
        setAllClerks(sortedClerks);
        setSelectedClerks(new Set(sortedClerks));
        toast.success(`נטענו ${data.length} שורות הזמנות`);
    };

    // --- שלב ב': ביצוע ההצלבה (המוח של המערכת) ---
    const handleAnalyze = () => {
        if (!invoicesMap || !reservationsData) return toast.error("חסרים קבצים");
        if (selectedClerks.size === 0) return toast.error("בחר לפחות נציג אחד");
        
        const tempConsolidated = {};
        const newSelectedIds = new Set(); // כאן נאגור את הירוקים האוטומטיים

        reservationsData.forEach(row => {
            // סינון נציג
            const rowClerk = cleanStr(row["c_taken_clerk"]);
            if (!selectedClerks.has(rowClerk)) return;

            // סינון סטטוס
            let status = (row["c_reservation_status"] || "").toString().toLowerCase();
            if (status === "can") return;

            // מזהה הזמנה
            let masterId = (row["c_master_id"] || "").toString().trim();
            if (!masterId) return;

            // 🛑 סינון היסטוריה: אם ההזמנה הזו כבר קיימת בהיסטוריה, דלג עליה!
            if (paidHistoryIds.includes(masterId)) return;

            let price = parseMoney(row["price_local"]);

            // איחוד שורות (כי יכולים להיות כמה חדרים לאותה הזמנה)
            if (!tempConsolidated[masterId]) {
                tempConsolidated[masterId] = {
                    masterId: masterId,
                    guestName: cleanStr(row["guest_name"]),
                    status: row["c_reservation_status"],
                    clerk: rowClerk,
                    priceCode: cleanStr(row["c_price_code"] || ""),
                    totalOrderPrice: 0,
                    manualFix: false
                };
            }
            tempConsolidated[masterId].totalOrderPrice += price;
        });

        // חישובים סופיים לכל שורה
        const finalRows = Object.values(tempConsolidated).map(item => {
            let foundData = invoicesMap["ID_" + item.masterId] || invoicesMap["NAME_" + item.guestName];
            
            let finalInvoiceAmount = foundData ? parseFloat(foundData.amount) : 0;
            let finalInvNum = foundData ? Array.from(foundData.numbers).join(" | ") : "";

            let isGroup = item.priceCode.includes("קבוצות");
            let commissionRate = isGroup ? 0.015 : 0.03;
            
            let expectedWithVat = item.totalOrderPrice * 1.18;
            let diff = Math.abs(expectedWithVat - finalInvoiceAmount);
            
            // קביעת צבע
            let colorStatus = 'red'; // ברירת מחדל: בעייתי
            if (expectedWithVat > 0 || finalInvoiceAmount > 0) {
                if (diff < 5.0) colorStatus = 'green'; 
                else if (expectedWithVat < finalInvoiceAmount) colorStatus = 'yellow';
            }

            // ✨ אם ירוק -> הוסף לרשימת הנבחרים אוטומטית
            if (colorStatus === 'green') {
                newSelectedIds.add(item.masterId);
            }

            let commissionToPay = finalInvoiceAmount * commissionRate;

            return {
                ...item,
                finalInvoiceAmount,
                finalInvNum,
                commissionToPay,
                expectedWithVat,
                colorStatus,
                isGroup
            };
        });

        // הסרת שורות ריקות (0 הזמנה ו-0 תשלום)
        const relevantRows = finalRows.filter(r => r.finalInvoiceAmount > 0 || r.expectedWithVat > 0);

        setProcessedRows(relevantRows);
        setSelectedRows(newSelectedIds);
        setStep(3); // עבור לטבלה
    };

    // --- תיקון ידני ---
    const openFixDialog = (row) => {
        setRowToFix(row);
        // מציע את הסכום המלא כברירת מחדל לתיקון
        setFixAmount(row.expectedWithVat > 0 ? Math.round(row.expectedWithVat) : row.finalInvoiceAmount);
        setFixNote('');
        setIsFixDialogOpen(true);
    };

    const applyFix = () => {
        if (!rowToFix) return;
        const newAmount = parseFloat(fixAmount);
        
        const updatedRows = processedRows.map(r => {
            if (r.masterId === rowToFix.masterId) {
                const commissionRate = r.isGroup ? 0.015 : 0.03;
                return {
                    ...r,
                    finalInvoiceAmount: newAmount, // הסכום החדש הקובע
                    commissionToPay: newAmount * commissionRate, // עמלה מחושבת מחדש
                    finalInvNum: fixNote || r.finalInvNum || 'תיקון ידני',
                    colorStatus: 'green', // הופך לירוק
                    manualFix: true
                };
            }
            return r;
        });

        setProcessedRows(updatedRows);
        
        // מוסיף לרשימת הנבחרים
        const newSelected = new Set(selectedRows);
        newSelected.add(rowToFix.masterId);
        setSelectedRows(newSelected);

        setIsFixDialogOpen(false);
        toast.success("העסקה תוקנה ואושרה!");
    };

    // --- הפקת הדוח ---
    const handleGenerateReport = () => {
        const rowsToSave = processedRows.filter(r => selectedRows.has(r.masterId));
        
        if (rowsToSave.length === 0) return toast.error("לא נבחרו שורות להפקה");
        if (!window.confirm(`האם להפיק דוח עבור ${rowsToSave.length} עסקאות?\nהנתונים יישמרו והעסקאות יסומנו כ"שולמו".`)) return;

        generateMutation.mutate(rowsToSave);
    };

    const toggleRow = (id) => {
        const next = new Set(selectedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRows(next);
    };

    // --- סינון לתצוגה ---
    // אנחנו מציגים רק את מה ש*לא* ירוק (או מה שתוקן ידנית והפך לירוק עכשיו).
    // שורות שהיו ירוקות מלכתחילה מוסתרות מהטבלה הראשית.
    const visibleRows = processedRows.filter(r => r.colorStatus !== 'green' || r.manualFix);
    const hiddenGreenCount = processedRows.length - visibleRows.length;
    const totalSelectedCommission = processedRows.filter(r => selectedRows.has(r.masterId)).reduce((sum, r) => sum + r.commissionToPay, 0);

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* שלב 1: העלאת קבצים */}
            {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className={`border-2 border-dashed ${invoicesMap ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                        <CardHeader><CardTitle>1. דוח חשבוניות</CardTitle></CardHeader>
                        <CardContent className="text-center">
                            <input type="file" onChange={(e) => handleFileUpload(e, 'invoices')} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
                        </CardContent>
                    </Card>
                    <Card className={`border-2 border-dashed ${reservationsData ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                        <CardHeader><CardTitle>2. דוח הזמנות (250)</CardTitle></CardHeader>
                        <CardContent className="text-center">
                            <input type="file" onChange={(e) => handleFileUpload(e, 'reservations')} disabled={!invoicesMap} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
                        </CardContent>
                    </Card>
                    <div className="col-span-full">
                        <Button onClick={() => setStep(2)} disabled={!invoicesMap || !reservationsData} className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700">המשך לבחירת נציגים</Button>
                    </div>
                </div>
            )}

            {/* שלב 2: בחירת נציגים */}
            {step === 2 && (
                <Card className="max-w-4xl mx-auto">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>בחר נציגים לחישוב</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => {
                            if (selectedClerks.size === allClerks.length) setSelectedClerks(new Set());
                            else setSelectedClerks(new Set(allClerks));
                        }}>{selectedClerks.size === allClerks.length ? 'נקה הכל' : 'סמן הכל'}</Button>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border max-h-[300px] overflow-y-auto">
                            {allClerks.map(clerk => (
                                <div key={clerk} className="flex items-center gap-2 p-2 bg-white rounded border">
                                    <Checkbox checked={selectedClerks.has(clerk)} onCheckedChange={() => {
                                        const next = new Set(selectedClerks);
                                        if (next.has(clerk)) next.delete(clerk); else next.add(clerk);
                                        setSelectedClerks(next);
                                    }} />
                                    <Label className="truncate text-sm" title={clerk}>{clerk}</Label>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex justify-between">
                            <Button variant="outline" onClick={() => setStep(1)}>חזור</Button>
                            <Button onClick={handleAnalyze} className="bg-purple-700 hover:bg-purple-800 gap-2 w-48"><Filter size={18}/> בצע ניתוח</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* שלב 3: הטבלה וההפקה */}
            {step === 3 && (
                <div className="space-y-6">
                    {/* סיכום עליון */}
                    <Card className="bg-gradient-to-r from-white to-green-50 border-green-200">
                        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="bg-green-100 p-4 rounded-full text-green-700 shadow-sm"><CheckCircle2 size={32} /></div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">סיכום להפקה</h2>
                                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                                        <p>✅ <span className="font-bold text-green-700">{hiddenGreenCount}</span> עסקאות תקינות (הוסתרו אוטומטית)</p>
                                        <p>⚠️ <span className="font-bold text-red-600">{visibleRows.length}</span> עסקאות חריגות לבדיקה בטבלה למטה</p>
                                        <p className="pt-2 text-base">סה"כ עמלה לתשלום בדוח זה: <span className="font-bold text-purple-700 bg-purple-100 px-2 rounded">{totalSelectedCommission.toLocaleString()} ₪</span></p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={resetAll}>התחל מחדש</Button>
                                <Button onClick={handleGenerateReport} disabled={generateMutation.isPending} className="bg-green-600 hover:bg-green-700 gap-2 h-12 px-8 text-lg shadow-lg">
                                    <Save size={20}/> {generateMutation.isPending ? 'מפיק ושומר...' : `הפק דוח (${selectedRows.size})`}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* טבלת החריגים */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden border">
                        <div className="p-4 bg-red-50 border-b border-red-100 text-red-800 font-bold flex items-center gap-2">
                            <AlertTriangle size={18}/> רשימת חריגים לבדיקה ידנית (אדום/צהוב)
                        </div>
                        
                        {visibleRows.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <CheckCircle2 size={48} className="mx-auto text-green-400 mb-2"/>
                                אין חריגים! כל העסקאות ירוקות ומוכנות להפקה.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                        <tr>
                                            <th className="p-3 w-16 text-center">בחר</th>
                                            <th className="p-3 w-16 text-center">תיקון</th>
                                            <th className="p-3">חשבונית</th>
                                            <th className="p-3">הזמנה</th>
                                            <th className="p-3">אורח</th>
                                            <th className="p-3">נציג</th>
                                            <th className="p-3">ללא מע"מ</th>
                                            <th className="p-3">צפוי (כולל)</th>
                                            <th className="p-3">בפועל</th>
                                            <th className="p-3">עמלה</th>
                                            <th className="p-3">סטטוס</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {visibleRows.map(row => (
                                            <tr key={row.masterId} className={`hover:bg-slate-50 transition-colors ${selectedRows.has(row.masterId) ? 'bg-green-50' : ''}`}>
                                                <td className="p-3 text-center">
                                                    <Checkbox checked={selectedRows.has(row.masterId)} onCheckedChange={() => toggleRow(row.masterId)} />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <Button variant="ghost" size="icon" onClick={() => openFixDialog(row)} title="תיקון ידני / ח&quot;ן חיצונית">
                                                        <Pencil className="h-4 w-4 text-blue-600"/>
                                                    </Button>
                                                </td>
                                                <td className="p-3 text-xs">{row.finalInvNum}</td>
                                                <td className="p-3 font-mono">{row.masterId}</td>
                                                <td className="p-3">{row.guestName}</td>
                                                <td className="p-3">{row.clerk}</td>
                                                <td className="p-3 text-gray-500">{row.totalOrderPrice.toLocaleString()}</td>
                                                <td className="p-3 font-medium">{row.expectedWithVat.toLocaleString()}</td>
                                                <td className="p-3 font-bold">{row.finalInvoiceAmount.toLocaleString()}</td>
                                                <td className="p-3 text-purple-700 font-bold">{row.commissionToPay.toLocaleString()}</td>
                                                <td className="p-3">
                                                    {row.manualFix ? 
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">תוקן ידנית</span> :
                                                        row.colorStatus === 'red' ? 
                                                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">חסר</span> :
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">עודף</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* דיאלוג תיקון ידני */}
            <Dialog open={isFixDialogOpen} onOpenChange={setIsFixDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>תיקון עסקה - {rowToFix?.guestName}</DialogTitle>
                        <DialogDescription>
                            השתמש באפשרות זו אם הכסף שולם בחשבונית חיצונית או במזומן שלא עודכן בדוח.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>סכום לתשלום בפועל (כולל מע"מ)</Label>
                            <Input type="number" value={fixAmount} onChange={(e) => setFixAmount(e.target.value)} className="mt-1 font-bold text-lg"/>
                            <p className="text-xs text-gray-500 mt-1">העמלה תחושב מחדש לפי סכום זה.</p>
                        </div>
                        <div>
                            <Label>הערה / אסמכתא</Label>
                            <Input placeholder="למשל: חשבונית ידנית 305" value={fixNote} onChange={(e) => setFixNote(e.target.value)} className="mt-1"/>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFixDialogOpen(false)}>ביטול</Button>
                        <Button onClick={applyFix} className="bg-green-600 hover:bg-green-700">שמור ואשר עסקה</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ============================================================================
// 🟡 קומפוננטה 2: היסטוריית דוחות (History)
// ============================================================================
function ReportsHistory() {
    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['commissionReports'],
        queryFn: async () => (await api.get('/admin/commissions/reports')).data
    });

    const [expandedReportId, setExpandedReportId] = useState(null);

    const toggleExpand = (id) => {
        setExpandedReportId(expandedReportId === id ? null : id);
    };

    if (isLoading) return <div className="text-center p-10 text-gray-500">טוען היסטוריה...</div>;

    return (
        <Card>
            <CardHeader><CardTitle>דוחות שהופקו בעבר</CardTitle></CardHeader>
            <CardContent>
                {reports.length === 0 ? <p className="text-center py-8 text-gray-500">עדיין לא הופקו דוחות.</p> : (
                    <div className="space-y-4">
                        {reports.map(report => (
                            <div key={report._id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                <div 
                                    className="p-4 bg-slate-50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => toggleExpand(report._id)}
                                >
                                    <div className="flex gap-8 items-center">
                                        <div className="text-lg font-bold text-slate-800">
                                            {format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            <span className="font-bold">{report.itemsCount}</span> הזמנות
                                        </div>
                                        <div className="text-purple-700 font-bold text-lg border-r pr-8 mr-4 border-slate-300">
                                            סה"כ שולם: ₪{report.totalAmount.toLocaleString()}
                                        </div>
                                    </div>
                                    {expandedReportId === report._id ? <ChevronUp className="text-gray-400"/> : <ChevronDown className="text-gray-400"/>}
                                </div>

                                {expandedReportId === report._id && (
                                    <div className="p-0 border-t bg-white animate-in slide-in-from-top-2">
                                        <div className="max-h-[400px] overflow-y-auto">
                                            <table className="w-full text-sm text-right">
                                                <thead className="text-gray-500 border-b bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="p-3">הזמנה</th>
                                                        <th className="p-3">אורח</th>
                                                        <th className="p-3">נציג</th>
                                                        <th className="p-3">חשבוניות</th>
                                                        <th className="p-3">שווי הזמנה</th>
                                                        <th className="p-3">שולם בפועל</th>
                                                        <th className="p-3 text-purple-700">עמלה</th>
                                                        <th className="p-3">הערה</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {report.items.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50">
                                                            <td className="p-3 font-mono">{item.masterId}</td>
                                                            <td className="p-3">{item.guestName}</td>
                                                            <td className="p-3">{item.clerkName}</td>
                                                            <td className="p-3 text-xs">{item.invoiceNumbers?.join(', ')}</td>
                                                            <td className="p-3 text-gray-500">{item.orderAmount?.toLocaleString()}</td>
                                                            <td className="p-3 font-bold">{item.paidAmount?.toLocaleString()}</td>
                                                            <td className="p-3 text-purple-700 font-bold">{item.commission?.toLocaleString()} ₪</td>
                                                            <td className="p-3 text-xs text-gray-400">
                                                                {item.isManualFix && <span className="bg-blue-100 text-blue-700 px-1 rounded ml-1">ידני</span>}
                                                                {item.note}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}