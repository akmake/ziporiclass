import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { format, isSameMonth } from 'date-fns';
import { he } from 'date-fns/locale';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { Label } from '@/components/ui/Label.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Input } from '@/components/ui/Input.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import {
    FileSpreadsheet, AlertTriangle, Save, Filter,
    CheckCircle2, Pencil, ChevronDown, ChevronUp, Trophy, Calendar, Percent, Database
} from 'lucide-react';

// --- הגדרות עמודות מהאקסל ---
// שמות טכניים נפוצים (אופטימה/סילברבייט) + שמות עבריים
const RES_COL_ARRIVAL_OPTIONS = [
    "c_arrival", "arrival", "checkin", "arrival_date", 
    "תאריך הגעה", "מתאריך", "הגעה", "תאריך כניסה"
];

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

// ✨ פונקציה משופרת לזיהוי תאריכים מקבצי CSV ישראליים
function findArrivalDate(row) {
    // 1. אם זו הזמנה מהמערכת (לא אקסל), התאריך כבר קיים
    if (row.eventDate) return new Date(row.eventDate);

    // 2. חיפוש בעמודות האפשריות
    for (const col of RES_COL_ARRIVAL_OPTIONS) {
        if (row[col] !== undefined && row[col] !== null && row[col] !== "") {
            const val = row[col];

            // א. אם זה מספר סידורי של אקסל
            if (typeof val === 'number') {
                // המרת Excel Serial Date (מתחיל מ-1900)
                return new Date(Math.round((val - 25569) * 86400 * 1000));
            }

            // ב. אם זו מחרוזת
            let dateStr = val.toString().trim();
            
            // טיפול בפורמט dd/mm/yyyy או dd.mm.yyyy
            // מחליפים נקודות בלוכסנים כדי ליישר קו
            dateStr = dateStr.replace(/\./g, '/');

            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                // מניחים פורמט ישראלי: יום/חודש/שנה
                if (parts.length === 3) {
                    let day = parseInt(parts[0], 10);
                    let month = parseInt(parts[1], 10);
                    let year = parseInt(parts[2], 10);

                    // תיקון שנים קצרות (23 -> 2023)
                    if (year < 100) year += 2000;

                    const d = new Date(year, month - 1, day);
                    if (!isNaN(d.getTime())) return d;
                }
            }

            // ג. פורמט ISO או סטנדרטי
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) return d;
        }
    }
    return null;
}

function getReportSummary(items) {
    const summary = {};
    items.forEach(item => {
        const name = item.clerkName || 'לא ידוע';
        if (!summary[name]) {
            summary[name] = { count: 0, totalRevenue: 0, totalCommission: 0 };
        }
        summary[name].count += 1;
        summary[name].totalRevenue += item.paidAmount || 0;
        summary[name].totalCommission += item.commission || 0;
    });

    return Object.entries(summary)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.totalCommission - a.totalCommission);
}

function ReportSummaryTable({ items }) {
    const summaryData = useMemo(() => getReportSummary(items), [items]);

    return (
        <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200 text-right" dir="rtl">
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> סיכום ביצועים לפי נציג
            </h4>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right bg-white rounded-md shadow-sm border">
                    <thead className="bg-slate-100 text-slate-600 font-semibold">
                        <tr>
                            <th className="p-2 border-b text-right">שם הנציג</th>
                            <th className="p-2 border-b text-center">כמות עסקאות</th>
                            <th className="p-2 border-b text-right">סך הכנסות (שולם)</th>
                            <th className="p-2 border-b text-right text-purple-700">סך עמלה לתשלום</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {summaryData.map((row) => (
                            <tr key={row.name} className="hover:bg-slate-50">
                                <td className="p-2 font-medium text-right">{row.name}</td>
                                <td className="p-2 text-center">{row.count}</td>
                                <td className="p-2 text-right">{row.totalRevenue.toLocaleString()} ₪</td>
                                <td className="p-2 font-bold text-purple-700 text-right">{row.totalCommission.toLocaleString()} ₪</td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                            <td className="p-2 text-right">סה"כ כללי</td>
                            <td className="p-2 text-center">{summaryData.reduce((sum, r) => sum + r.count, 0)}</td>
                            <td className="p-2 text-right">{summaryData.reduce((sum, r) => sum + r.totalRevenue, 0).toLocaleString()} ₪</td>
                            <td className="p-2 text-purple-700 text-right">{summaryData.reduce((sum, r) => sum + r.totalCommission, 0).toLocaleString()} ₪</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function CommissionsPage() {
    const [activeTab, setActiveTab] = useState("generator");

    return (
        <div className="container mx-auto p-6 space-y-6 bg-slate-50 min-h-screen text-right" dir="rtl">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <FileSpreadsheet className="text-purple-600"/> ניהול עמלות מרוכז
                </h1>
                <p className="text-gray-600 mt-1">מערכת הצלבה, חישוב עמלות והיסטוריית תשלומים.</p>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
                <TabsList className="bg-white border p-1 grid w-full grid-cols-3 lg:w-[600px]">
                    <TabsTrigger value="generator">מחולל דוחות (חדש)</TabsTrigger>
                    <TabsTrigger value="history">היסטוריית דוחות</TabsTrigger>
                    <TabsTrigger value="by-date">דוח לפי חודשי הגעה</TabsTrigger>
                </TabsList>

                <TabsContent value="generator" className="mt-6">
                    <CommissionGenerator onReportGenerated={() => setActiveTab("history")} />
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <ReportsHistory />
                </TabsContent>

                <TabsContent value="by-date" className="mt-6">
                    <CommissionsByArrivalDate />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ============================================================================
// 🟢 קומפוננטה 1: המחולל (Generator)
// ============================================================================
function CommissionGenerator({ onReportGenerated }) {
    const [invoicesMap, setInvoicesMap] = useState(null);
    const [reservationsData, setReservationsData] = useState(null);
    const [allClerks, setAllClerks] = useState([]);
    const [selectedClerks, setSelectedClerks] = useState(new Set());

    const [processedRows, setProcessedRows] = useState([]);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [step, setStep] = useState(1);

    // --- State לדיאלוג התיקון ---
    const [isFixDialogOpen, setIsFixDialogOpen] = useState(false);
    const [rowToFix, setRowToFix] = useState(null);
    const [fixAmount, setFixAmount] = useState('');
    const [fixRate, setFixRate] = useState(''); 
    const [fixNote, setFixNote] = useState('');

    const queryClient = useQueryClient();

    const { data: paidHistoryIds = [] } = useQuery({
        queryKey: ['paidCommissionsIds'],
        queryFn: async () => (await api.get('/admin/commissions/paid-ids')).data
    });

    const generateMutation = useMutation({
        mutationFn: (items) => api.post('/admin/commissions/generate', { items }),
        onSuccess: () => {
            toast.success('הדוח הופק ונשמר בהצלחה!');
            queryClient.invalidateQueries(['paidCommissionsIds']);
            queryClient.invalidateQueries(['commissionReports']);
            resetAll();
            onReportGenerated();
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

    // ✨ פונקציה חכמה למציאת שורת הכותרות (מדלגת על לוגו/כותרות עליונות)
    const findHeaderRow = (worksheet) => {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        // סורקים את 20 השורות הראשונות
        for (let R = range.s.r; R <= Math.min(range.e.r, 20); ++R) {
            const rowValues = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = worksheet[XLSX.utils.encode_cell({r: R, c: C})];
                if (cell && cell.v) rowValues.push(cell.v.toString());
            }
            
            // בדיקה אם זו שורת כותרות: האם היא מכילה מילות מפתח קריטיות?
            const rowStr = rowValues.join(' ').toLowerCase();
            // מילים שיכולות להופיע בכותרת דוח הזמנות או חשבוניות
            if (
                (rowStr.includes('c_taken_clerk') || rowStr.includes('פקיד')) || 
                (rowStr.includes('c_folio_number') || rowStr.includes('חשבונית')) ||
                (rowStr.includes('תאריך') && rowStr.includes('שם'))
            ) {
                return R; // מצאנו את האינדקס של שורת הכותרות
            }
        }
        return 0; // ברירת מחדל: שורה ראשונה
    };

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // ✨ שימוש בזיהוי חכם של שורת הכותרות
                const headerRowIndex = findHeaderRow(worksheet);
                
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                    range: headerRowIndex, // מתחיל לקרוא רק מהשורה הזו ומטה
                    defval: "" 
                });

                if (type === 'invoices') processInvoices(jsonData);
                else processReservations(jsonData);
            } catch (error) {
                console.error(error);
                toast.error("שגיאה בקריאת הקובץ - וודא שזהו קובץ אקסל תקין");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // ✨ הפונקציה החדשה: טעינת הזמנות מהדאטה-בייס
    const handleLoadFromDB = async () => {
        const toastId = toast.loading('טוען הזמנות מהמערכת...');
        try {
            const { data: allOrders } = await api.get('/admin/orders');
            
            const relevantOrders = allOrders.filter(order => 
                order.status === 'בוצע' && 
                !paidHistoryIds.includes(order.orderNumber.toString())
            );

            if (relevantOrders.length === 0) {
                toast.dismiss(toastId);
                return toast.error('לא נמצאו הזמנות פתוחות (בוצעו ולא שולמו).');
            }

            const convertedData = relevantOrders.map(order => ({
                "c_taken_clerk": order.salespersonName,
                "c_reservation_status": "OK",
                "c_master_id": order.orderNumber.toString(),
                "price_local": order.total_price,
                "guest_name": order.customerName,
                "c_price_code": "REGULAR", 
                "eventDate": order.eventDate 
            }));

            processReservations(convertedData);
            toast.success(`נטענו ${convertedData.length} הזמנות פתוחות!`, { id: toastId });

        } catch (error) {
            console.error(error);
            toast.error('שגיאה בטעינת הנתונים', { id: toastId });
        }
    };

    const processInvoices = (data) => {
        const map = {};
        // חיפוש דינמי של שמות עמודות (במקרה שהשם הוא בעברית או באנגלית)
        const findCol = (row, options) => {
            for (const opt of options) {
                if (row[opt] !== undefined) return row[opt];
            }
            return undefined;
        };

        const idCols = ["c_folio_number", "מספר הזמנה", "master_id", "הזמנה"];
        const nameCols = ["guest_name", "שם אורח", "שם", "guestname"];
        const amountCols = ["invoice_amount", "סכום", "לתשלום", "amount"];
        const numCols = ["c_invoice_number", "מספר חשבונית", "חשבונית"];

        data.forEach(row => {
            let folioRaw = findCol(row, idCols);
            let nameRaw = findCol(row, nameCols);
            let amount = parseMoney(findCol(row, amountCols));
            let invNum = findCol(row, numCols);

            if (folioRaw) {
                let folioStr = folioRaw.toString().trim();
                // טיפול ב-Folio שיש לו סיומת (לפעמים מופיע כ 12345/1)
                let masterId = folioStr.split('/')[0].split('.')[0]; 
                
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
        
        // עמודות אפשריות לשם הפקיד
        const clerkCols = ["c_taken_clerk", "פקיד", "clerk", "user"];

        data.forEach(row => {
            let clerk = "";
            for (const col of clerkCols) {
                if (row[col]) {
                    clerk = cleanStr(row[col]);
                    break;
                }
            }
            if (clerk) clerksSet.add(clerk);
        });
        const sortedClerks = Array.from(clerksSet).sort();
        setAllClerks(sortedClerks);
        setSelectedClerks(new Set(sortedClerks));
    };

    const handleAnalyze = () => {
        // אם לא הועלו חשבוניות, יוצרים מפה ריקה כדי לאפשר עבודה ידנית
        const currentInvoicesMap = invoicesMap || {}; 
        
        if (!reservationsData) return toast.error("אין נתוני הזמנות לניתוח");
        if (selectedClerks.size === 0) return toast.error("בחר לפחות נציג אחד");

        const tempConsolidated = {};
        const newSelectedIds = new Set();

        const idCols = ["c_master_id", "מספר הזמנה", "הזמנה", "res_no"];
        const statusCols = ["c_reservation_status", "סטטוס", "status"];
        const clerkCols = ["c_taken_clerk", "פקיד", "clerk"];
        const priceCols = ["price_local", "מחיר", "סכום", "total"];
        const nameCols = ["guest_name", "שם אורח", "שם"];
        const codeCols = ["c_price_code", "קוד מחיר", "market"];

        const findVal = (row, options) => {
            for (const opt of options) if (row[opt] !== undefined) return row[opt];
            return undefined;
        };

        reservationsData.forEach(row => {
            const rowClerk = cleanStr(findVal(row, clerkCols));
            if (!selectedClerks.has(rowClerk)) return;

            let status = (findVal(row, statusCols) || "").toString().toLowerCase();
            // סינון ביטולים נפוצים
            if (status.includes("can") || status.includes("בוטל")) return;

            let masterId = (findVal(row, idCols) || "").toString().trim();
            if (!masterId) return;

            if (paidHistoryIds.includes(masterId)) return;

            let price = parseMoney(findVal(row, priceCols));
            let arrivalDate = findArrivalDate(row);

            if (!tempConsolidated[masterId]) {
                tempConsolidated[masterId] = {
                    masterId: masterId,
                    guestName: cleanStr(findVal(row, nameCols)),
                    status: status,
                    clerk: rowClerk,
                    priceCode: cleanStr(findVal(row, codeCols) || ""), 
                    totalOrderPrice: 0,
                    manualFix: false,
                    arrivalDate: arrivalDate
                };
            }
            tempConsolidated[masterId].totalOrderPrice += price;
        });

        const finalRows = Object.values(tempConsolidated).map(item => {
            let foundData = currentInvoicesMap["ID_" + item.masterId] || currentInvoicesMap["NAME_" + item.guestName];

            let finalInvoiceAmount = foundData ? parseFloat(foundData.amount) : 0;
            let finalInvNum = foundData ? Array.from(foundData.numbers).join(" | ") : "";

            let isGroup = item.priceCode.includes("קבוצות") || item.priceCode.includes("GROUP");
            let commissionRate = isGroup ? 0.015 : 0.03;

            let expectedWithVat = item.totalOrderPrice * 1.18;
            let diff = Math.abs(expectedWithVat - finalInvoiceAmount);

            let colorStatus = 'red';
            if (expectedWithVat > 0 || finalInvoiceAmount > 0) {
                if (diff < 5.0) colorStatus = 'green';
                else if (expectedWithVat < finalInvoiceAmount) colorStatus = 'yellow';
            }

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
                isGroup,
                commissionRate: commissionRate * 100
            };
        });

        const relevantRows = finalRows.filter(r => r.finalInvoiceAmount > 0 || r.expectedWithVat > 0);

        setProcessedRows(relevantRows);
        setSelectedRows(newSelectedIds);
        setStep(3);
    };

    const openFixDialog = (row) => {
        setRowToFix(row);
        setFixAmount(row.expectedWithVat > 0 ? Math.round(row.expectedWithVat) : row.finalInvoiceAmount);
        
        const defaultRate = row.isGroup ? '1.5' : '3';
        setFixRate(row.manualRate ? row.manualRate.toString() : defaultRate);
        
        setFixNote('');
        setIsFixDialogOpen(true);
    };

    const applyFix = () => {
        if (!rowToFix) return;
        
        const newAmount = parseFloat(fixAmount);
        const rate = parseFloat(fixRate);

        const calculatedCommission = newAmount * (rate / 100);

        const updatedRows = processedRows.map(r => {
            if (r.masterId === rowToFix.masterId) {
                return {
                    ...r,
                    finalInvoiceAmount: newAmount,
                    commissionToPay: calculatedCommission,
                    commissionRate: rate,
                    manualRate: rate,
                    finalInvNum: fixNote || r.finalInvNum || 'תיקון ידני',
                    colorStatus: 'green',
                    manualFix: true
                };
            }
            return r;
        });

        setProcessedRows(updatedRows);
        const newSelected = new Set(selectedRows);
        newSelected.add(rowToFix.masterId);
        setSelectedRows(newSelected);

        setIsFixDialogOpen(false);
        toast.success(`העסקה עודכנה לפי ${rate}%!`);
    };

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

    const visibleRows = processedRows.filter(r => r.colorStatus !== 'green' || r.manualFix);
    const hiddenGreenCount = processedRows.length - visibleRows.length;
    const totalSelectedCommission = processedRows.filter(r => selectedRows.has(r.masterId)).reduce((sum, r) => sum + r.commissionToPay, 0);

    const previewCommission = (parseFloat(fixAmount || 0) * (parseFloat(fixRate || 0) / 100));

    return (
        <div className="space-y-6 animate-in fade-in text-right">
            {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className={`border-2 border-dashed ${invoicesMap ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                        <CardHeader><CardTitle>1. דו"ח חשבוניות (442)</CardTitle></CardHeader>
                        <CardContent className="text-center">
                            <input type="file" onChange={(e) => handleFileUpload(e, 'invoices')} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
                        </CardContent>
                    </Card>

                    <Card className={`border-2 border-dashed ${reservationsData ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                        <CardHeader><CardTitle>2. דו"ח הזמנות (250)</CardTitle></CardHeader>
                        <CardContent className="text-center space-y-4">
                            <input type="file" onChange={(e) => handleFileUpload(e, 'reservations')} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
                            
                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-gray-300"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">או</span>
                                <div className="flex-grow border-t border-gray-300"></div>
                            </div>

                            {/* ✨ הכפתור החדש לטעינת נתונים מהמערכת */}
                            <Button variant="outline" onClick={handleLoadFromDB} className="w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                                <Database className="ml-2 h-4 w-4"/> טען הזמנות פתוחות מהמערכת
                            </Button>
                        </CardContent>
                    </Card>
                    <div className="col-span-full">
                        <Button onClick={() => setStep(2)} disabled={!reservationsData} className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700">המשך לבחירת נציגים</Button>
                    </div>
                </div>
            )}

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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border max-h-[300px] overflow-y-auto" dir="rtl">
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

            {step === 3 && (
                <div className="space-y-6">
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
                                            <th className="p-3 text-right">חשבונית</th>
                                            <th className="p-3 text-right">הזמנה</th>
                                            <th className="p-3 text-right">אורח</th>
                                            <th className="p-3 text-right">ת. הגעה</th>
                                            <th className="p-3 text-right">נציג</th>
                                            <th className="p-3 text-right">ללא מע"מ</th>
                                            <th className="p-3 text-right">צפוי (כולל)</th>
                                            <th className="p-3 text-right">בפועל</th>
                                            <th className="p-3 text-right">עמלה</th>
                                            <th className="p-3 text-right">סטטוס</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {visibleRows.map(row => (
                                            <tr key={row.masterId} className={`hover:bg-slate-50 transition-colors ${selectedRows.has(row.masterId) ? 'bg-green-50' : ''}`}>
                                                <td className="p-3 text-center">
                                                    <Checkbox checked={selectedRows.has(row.masterId)} onCheckedChange={() => toggleRow(row.masterId)} />
                                                </td>
                                                {/* ✨ הנה כפתור העיפרון המבוקש ✨ */}
                                                <td className="p-3 text-center">
                                                    <Button variant="ghost" size="icon" onClick={() => openFixDialog(row)} title="תיקון ידני / ח&quot;ן חיצונית">
                                                        <Pencil className="h-4 w-4 text-blue-600"/>
                                                    </Button>
                                                </td>
                                                <td className="p-3 text-xs text-right">{row.finalInvNum}</td>
                                                <td className="p-3 font-mono text-right">{row.masterId}</td>
                                                <td className="p-3 text-right">{row.guestName}</td>
                                                <td className="p-3 text-right text-xs">
                                                    {row.arrivalDate ? format(row.arrivalDate, 'dd/MM/yy') : '-'}
                                                </td>
                                                <td className="p-3 text-right">{row.clerk}</td>
                                                <td className="p-3 text-gray-500 text-right">{row.totalOrderPrice.toLocaleString()}</td>
                                                <td className="p-3 font-medium text-right">{row.expectedWithVat.toLocaleString()}</td>
                                                <td className="p-3 font-bold text-right">{row.finalInvoiceAmount.toLocaleString()}</td>
                                                <td className="p-3 text-purple-700 font-bold text-right">
                                                    {row.commissionToPay.toLocaleString()}
                                                    <span className="text-xs text-gray-400 font-normal mr-1">
                                                        ({(row.commissionRate || (row.isGroup ? 1.5 : 3))}%)
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
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

            <Dialog open={isFixDialogOpen} onOpenChange={setIsFixDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>תיקון עסקה - {rowToFix?.guestName}</DialogTitle>
                        <DialogDescription>
                            עדכון סכום לתשלום ואחוז עמלה.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>סכום לתשלום בפועל (כולל מע"מ)</Label>
                            <Input type="number" value={fixAmount} onChange={(e) => setFixAmount(e.target.value)} className="mt-1 font-bold text-lg"/>
                            <p className="text-xs text-gray-500 mt-1">סכום העסקה שנכנס לקופה.</p>
                        </div>

                        <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                            <Label className="text-purple-900">אחוז עמלה (%)</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input
                                    type="number"
                                    value={fixRate}
                                    onChange={(e) => setFixRate(e.target.value)}
                                    className="font-bold text-lg border-purple-300 text-purple-800 w-24"
                                />
                                <span className="text-purple-700 font-bold"><Percent size={18}/></span>
                                
                                <div className="mr-auto text-left">
                                    <span className="text-xs text-gray-500 block">עמלה שתחושב:</span>
                                    <span className="font-bold text-lg text-purple-700">{previewCommission.toLocaleString(undefined, { maximumFractionDigits: 1 })} ₪</span>
                                </div>
                            </div>
                            <p className="text-xs text-purple-600/70 mt-1">
                                שנה את האחוז במידת הצורך (ברירת מחדל: 3% או 1.5%).
                            </p>
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
// 🟡 קומפוננטה 2: היסטוריית דוחות
// ============================================================================
function ReportsHistory() {
    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['commissionReports'],
        queryFn: async () => (await api.get('/admin/commissions/reports')).data
    });

    const [expandedReportId, setExpandedReportId] = useState(null);

    if (isLoading) return <div className="text-center p-10 text-gray-500">טוען היסטוריה...</div>;

    return (
        <Card className="text-right" dir="rtl">
            <CardHeader><CardTitle>דוחות שהופקו בעבר</CardTitle></CardHeader>
            <CardContent>
                {reports.length === 0 ? <p className="text-center py-8 text-gray-500">עדיין לא הופקו דוחות.</p> : (
                    <div className="space-y-4">
                        {reports.map(report => (
                            <div key={report._id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                <div
                                    className="p-4 bg-slate-50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => setExpandedReportId(expandedReportId === report._id ? null : report._id)}
                                >
                                    <div className="flex gap-8 items-center">
                                        <div className="text-lg font-bold text-slate-800">
                                            {format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            <span className="font-bold">{report.itemsCount}</span> הזמנות
                                        </div>
                                        <div className="text-purple-700 font-bold text-lg border-l pl-8 ml-4 border-slate-300">
                                            סה"כ שולם: ₪{report.totalAmount.toLocaleString()}
                                        </div>
                                    </div>
                                    {expandedReportId === report._id ? <ChevronUp className="text-gray-400"/> : <ChevronDown className="text-gray-400"/>}
                                </div>

                                {expandedReportId === report._id && (
                                    <div className="p-4 border-t bg-white animate-in slide-in-from-top-2">
                                        <ReportSummaryTable items={report.items} />

                                        <h4 className="text-sm font-bold text-slate-500 uppercase mb-2 mt-6">פירוט מלא</h4>
                                        <div className="max-h-[400px] overflow-y-auto border rounded-md">
                                            <table className="w-full text-sm text-right">
                                                <thead className="text-gray-500 border-b bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="p-3 text-right">הזמנה</th>
                                                        <th className="p-3 text-right">אורח</th>
                                                        <th className="p-3 text-right">ת. הגעה</th>
                                                        <th className="p-3 text-right">נציג</th>
                                                        <th className="p-3 text-right">חשבוניות</th>
                                                        <th className="p-3 text-right">שווי הזמנה</th>
                                                        <th className="p-3 text-right">שולם בפועל</th>
                                                        <th className="p-3 text-right text-purple-700">עמלה</th>
                                                        <th className="p-3 text-right">הערה</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {report.items.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50">
                                                            <td className="p-3 font-mono text-right">{item.masterId}</td>
                                                            <td className="p-3 text-right">{item.guestName}</td>
                                                            <td className="p-3 text-right text-xs text-gray-500">
                                                                {item.arrivalDate ? format(new Date(item.arrivalDate), 'dd/MM/yy') : '-'}
                                                            </td>
                                                            <td className="p-3 text-right">{item.clerkName}</td>
                                                            <td className="p-3 text-xs text-right">{item.invoiceNumbers?.join(', ')}</td>
                                                            <td className="p-3 text-gray-500 text-right">{item.orderAmount?.toLocaleString()}</td>
                                                            <td className="p-3 font-bold text-right">{item.paidAmount?.toLocaleString()}</td>
                                                            <td className="p-3 text-purple-700 font-bold text-right">{item.commission?.toLocaleString()} ₪</td>
                                                            <td className="p-3 text-xs text-gray-400 text-right">
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

// ============================================================================
// 🔵 קומפוננטה 3: דוח לפי תאריכי הגעה (מנגנון חכם)
// ============================================================================
function CommissionsByArrivalDate() {
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [showDetails, setShowDetails] = useState(false);

    // שליפת כל הדוחות הקיימים כדי לבנות את המאגר
    const { data: reports = [] } = useQuery({
        queryKey: ['commissionReports'],
        queryFn: async () => (await api.get('/admin/commissions/reports')).data
    });

    // ✨ לוגיקה חכמה 1: איסוף כל החודשים הזמינים מתוך הנתונים
    const availableMonths = useMemo(() => {
        const monthsSet = new Set();
        reports.flatMap(r => r.items || []).forEach(item => {
            if (item.arrivalDate) {
                // מפתח: YYYY-MM
                monthsSet.add(format(new Date(item.arrivalDate), 'yyyy-MM'));
            }
        });
        // המרה חזרה למערך ומיון יורד (מהחדש לישן)
        return Array.from(monthsSet).sort().reverse();
    }, [reports]);

    // ✨ לוגיקה חכמה 2: סינון לפי החודש הנבחר
    const { filteredItems, totalCommission } = useMemo(() => {
        if (selectedMonth === 'all') return { filteredItems: [], totalCommission: 0 };

        const [year, month] = selectedMonth.split('-');
        const targetDate = new Date(parseInt(year), parseInt(month) - 1, 1); // ה-1 לחודש הנבחר

        // אוספים את כל השורות מכל הדוחות ההיסטוריים
        const allItems = reports.flatMap(r => r.items || []);

        const filtered = allItems.filter(item => {
            if (!item.arrivalDate) return false;
            return isSameMonth(new Date(item.arrivalDate), targetDate);
        });

        // מיון לפי תאריך הגעה
        filtered.sort((a, b) => new Date(a.arrivalDate) - new Date(b.arrivalDate));

        const total = filtered.reduce((sum, item) => sum + (item.commission || 0), 0);
        return { filteredItems: filtered, totalCommission: total };
    }, [reports, selectedMonth]);

    return (
        <div className="space-y-6 animate-in slide-in-from-top-2">
            <Card className="bg-white border-blue-200">
                <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="text-blue-600"/> סינון לפי חודש הגעה</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="w-full sm:w-64">
                            <Label className="mb-2 block">בחר חודש לפעילות (מתוך הקיים)</Label>
                            
                            {/* ✨ במקום תאריך - דרופדאון חכם */}
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger>
                                    <SelectValue placeholder="בחר חודש..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableMonths.length === 0 ? 
                                        <SelectItem value="none" disabled>אין נתונים היסטוריים</SelectItem> :
                                        availableMonths.map(mStr => {
                                            const [y, m] = mStr.split('-');
                                            const label = format(new Date(parseInt(y), parseInt(m)-1, 1), 'MMMM yyyy', { locale: he });
                                            return <SelectItem key={mStr} value={mStr}>{label}</SelectItem>;
                                        })
                                    }
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {selectedMonth !== 'all' && (
                <div className="space-y-6">
                    {/* כרטיסי סיכום */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-blue-50 border-blue-200 text-center shadow-sm">
                            <CardContent className="p-6">
                                <p className="text-gray-500 font-medium">סה"כ עמלות לתשלום (בחודש זה)</p>
                                <p className="text-4xl font-bold text-blue-700">{totalCommission.toLocaleString()} ₪</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-gray-200 text-center shadow-sm">
                            <CardContent className="p-6">
                                <p className="text-gray-500 font-medium">כמות עסקאות (לפי הגעה)</p>
                                <p className="text-4xl font-bold text-gray-800">{filteredItems.length}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* כפתור הרחבה */}
                    <div className="text-center">
                        <Button
                            variant="outline"
                            onClick={() => setShowDetails(!showDetails)}
                            className="gap-2"
                            disabled={filteredItems.length === 0}
                        >
                            {showDetails ? <>הסתר פירוט <ChevronUp/></> : <>הצג פירוט עסקאות <ChevronDown/></>}
                        </Button>
                    </div>

                    {/* טבלה מפורטת */}
                    {showDetails && (
                        <Card className="overflow-hidden border-t-4 border-t-purple-500 animate-in zoom-in-95">
                            <div className="max-h-[500px] overflow-y-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-purple-50 text-purple-900 font-bold border-b sticky top-0 shadow-sm">
                                        <tr>
                                            <th className="p-3">ת. הגעה</th>
                                            <th className="p-3">אורח</th>
                                            <th className="p-3">נציג</th>
                                            <th className="p-3">שולם בפועל</th>
                                            <th className="p-3">עמלה</th>
                                            <th className="p-3">הזמנה</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-3 font-medium text-slate-800">
                                                    {item.arrivalDate ? format(new Date(item.arrivalDate), 'dd/MM/yyyy') : '-'}
                                                </td>
                                                <td className="p-3">{item.guestName}</td>
                                                <td className="p-3">{item.clerkName}</td>
                                                <td className="p-3 text-slate-600">{item.paidAmount?.toLocaleString()}</td>
                                                <td className="p-3 font-bold text-purple-700">{item.commission?.toLocaleString()} ₪</td>
                                                <td className="p-3 font-mono text-xs text-gray-400">{item.masterId}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
