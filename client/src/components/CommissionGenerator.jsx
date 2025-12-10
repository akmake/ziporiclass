// client/src/components/CommissionGenerator.jsx

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { Label } from '@/components/ui/Label.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Input } from '@/components/ui/Input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { AlertTriangle, Save, Filter, CheckCircle2, Pencil, Database, Percent } from 'lucide-react';

// ============================================================================
// 🛑 לוגיקה פנימית (Self-Contained Logic)
// ============================================================================

// הגדרות עמודות קשיחות (לפי קבצי המקור שלך)
const INV_COL_ID = "c_folio_number";
const INV_COL_NAME = "guest_name";
const INV_COL_AMOUNT = "invoice_amount";
const INV_COL_NUM = "c_invoice_number";

const RES_COL_CLERK = "c_taken_clerk";
const RES_COL_MASTER = "c_master_id";
const RES_COL_PRICE = "price_local"; 
const RES_COL_NAME = "guest_name";
const RES_COL_STATUS = "c_reservation_status";
const RES_COL_CODE = "c_price_code";

const ARRIVAL_KEYWORDS = ["מתאריך", "c_arrival", "arrival", "checkin", "arrival_date", "תאריך הגעה"];

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

function findArrivalDate(row) {
    if (row.eventDate) return new Date(row.eventDate);

    const keys = Object.keys(row);
    for (const key of keys) {
        const lowerKey = key.toLowerCase();
        if (ARRIVAL_KEYWORDS.some(k => lowerKey.includes(k))) {
            const val = row[key];
            if (!val) continue;

            if (val instanceof Date && !isNaN(val)) return val;

            if (typeof val === 'number' && val > 20000) {
                return new Date(Math.round((val - 25569) * 86400 * 1000));
            }

            if (typeof val === 'string') {
                const dateStr = val.trim().replace(/\./g, '/').replace(/-/g, '/');
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        let day = parseInt(parts[0]);
                        let month = parseInt(parts[1]);
                        let year = parseInt(parts[2]);
                        if (year < 100) year += 2000;
                        const d = new Date(year, month - 1, day);
                        if (!isNaN(d.getTime())) return d;
                    }
                }
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) return d;
            }
        }
    }
    return null;
}

// ============================================================================
// 🏁 הקומפוננטה הראשית
// ============================================================================

export default function CommissionGenerator({ onReportGenerated }) {
    const [invoicesMap, setInvoicesMap] = useState(null);
    const [reservationsData, setReservationsData] = useState(null);
    const [allClerks, setAllClerks] = useState([]);
    const [selectedClerks, setSelectedClerks] = useState(new Set());

    const [processedRows, setProcessedRows] = useState([]);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [step, setStep] = useState(1);

    // State לדיאלוג התיקון
    const [isFixDialogOpen, setIsFixDialogOpen] = useState(false);
    const [rowToFix, setRowToFix] = useState(null);
    const [fixAmount, setFixAmount] = useState('');
    const [fixRate, setFixRate] = useState('');
    const [fixNote, setFixNote] = useState('');

    const queryClient = useQueryClient();

    // 1. שליפת היסטוריית תשלומים
    const { data: paidHistoryIds = [] } = useQuery({
        queryKey: ['paidCommissionsIds'],
        queryFn: async () => (await api.get('/admin/commissions/paid-ids')).data
    });

    // 2. שליפת מפת ההזמנות (היברידית)
    const { data: dbOrdersMap = {} } = useQuery({
        queryKey: ['ordersCommissionMap'],
        queryFn: async () => (await api.get('/admin/orders/commission-map')).data,
        staleTime: 1000 * 60 * 5 
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

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'dd/mm/yyyy' });
                const sheetName = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

                if (type === 'invoices') processInvoices(jsonData);
                else processReservations(jsonData);
            } catch (error) {
                console.error(error);
                toast.error("שגיאה בקריאת הקובץ");
            }
        };
        reader.readAsArrayBuffer(file);
    };

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
                return toast.error('לא נמצאו הזמנות פתוחות.');
            }

            const convertedData = relevantOrders.map(order => ({
                [RES_COL_CLERK]: order.salespersonName,
                [RES_COL_STATUS]: "OK",
                [RES_COL_MASTER]: order.orderNumber.toString(),
                [RES_COL_PRICE]: order.total_price / 1.18, 
                [RES_COL_NAME]: order.customerName,
                [RES_COL_CODE]: "REGULAR",
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
            const clerk = cleanStr(row[RES_COL_CLERK]);
            if (clerk) clerksSet.add(clerk);
        });
        const sortedClerks = Array.from(clerksSet).sort();
        setAllClerks(sortedClerks);
        setSelectedClerks(new Set(sortedClerks));
        toast.success(`נטענו ${data.length} שורות הזמנות`);
    };

    // --- הפונקציה הראשית לניתוח ---
    const handleAnalyze = () => {
        const currentInvoicesMap = invoicesMap || {};

        if (!reservationsData) return toast.error("אין נתוני הזמנות לניתוח");
        if (selectedClerks.size === 0) return toast.error("בחר לפחות נציג אחד");

        const tempConsolidated = {};
        const newSelectedIds = new Set();

        reservationsData.forEach(row => {
            const rowClerkExcel = cleanStr(row[RES_COL_CLERK]);
            let status = (row[RES_COL_STATUS] || "").toString().toLowerCase();
            let masterId = (row[RES_COL_MASTER] || "").toString().trim();
            let price = parseMoney(row[RES_COL_PRICE]);
            let arrivalDate = findArrivalDate(row);
            let priceCode = cleanStr(row[RES_COL_CODE] || "");

            if (status.includes("can") || status.includes("בוטל")) return;
            if (!masterId) return;
            if (paidHistoryIds.includes(masterId)) return;

            // --- 🛑 בדיקה היברידית 🛑 ---
            const dbOrder = dbOrdersMap[masterId];
            
            // תרחיש א: פיצול (העולם החדש)
            if (dbOrder && dbOrder.creator && dbOrder.closer) {
                
                // האם המשתמשים הנבחרים ב-UI רלוונטיים להזמנה זו?
                const isCreatorSelected = selectedClerks.has(dbOrder.creator);
                const isCloserSelected = selectedClerks.has(dbOrder.closer);

                if (!isCreatorSelected && !isCloserSelected) return; 

                // האם יש באמת פיצול (אנשים שונים)?
                if (dbOrder.isSplit) {
                    
                    // 1. שורה ליוצר (80%)
                    if (isCreatorSelected) {
                        const keyCreator = `${masterId}_creator`;
                        if (!tempConsolidated[keyCreator]) {
                            tempConsolidated[keyCreator] = {
                                masterId: masterId,
                                uniqueKey: keyCreator,
                                guestName: cleanStr(row[RES_COL_NAME]),
                                status: status,
                                clerk: dbOrder.creator, // מה-DB
                                priceCode: priceCode,
                                totalOrderPrice: 0,
                                manualFix: false,
                                arrivalDate: arrivalDate,
                                isSplit: true,
                                splitRole: 'creator' // 80%
                            };
                        }
                        tempConsolidated[keyCreator].totalOrderPrice += price;
                    }

                    // 2. שורה לסוגר (20%)
                    if (isCloserSelected) {
                        const keyCloser = `${masterId}_closer`;
                        if (!tempConsolidated[keyCloser]) {
                            tempConsolidated[keyCloser] = {
                                masterId: masterId,
                                uniqueKey: keyCloser,
                                guestName: cleanStr(row[RES_COL_NAME]),
                                status: status,
                                clerk: dbOrder.closer, // מה-DB
                                priceCode: priceCode,
                                totalOrderPrice: 0,
                                manualFix: false,
                                arrivalDate: arrivalDate,
                                isSplit: true,
                                splitRole: 'closer' // 20%
                            };
                        }
                        tempConsolidated[keyCloser].totalOrderPrice += price;
                    }
                } 
                else {
                    // יוצר וסוגר הם אותו אדם (100%), אבל לוקחים את השם מה-DB
                    if (isCreatorSelected) {
                        if (!tempConsolidated[masterId]) {
                            tempConsolidated[masterId] = {
                                masterId: masterId,
                                uniqueKey: masterId,
                                guestName: cleanStr(row[RES_COL_NAME]),
                                status: status,
                                clerk: dbOrder.creator, // מה-DB
                                priceCode: priceCode,
                                totalOrderPrice: 0,
                                manualFix: false,
                                arrivalDate: arrivalDate,
                                isSplit: false
                            };
                        }
                        tempConsolidated[masterId].totalOrderPrice += price;
                    }
                }

            } else {
                // תרחיש ב: Fallback (העולם הישן - אקסל בלבד)
                if (!selectedClerks.has(rowClerkExcel)) return;

                if (!tempConsolidated[masterId]) {
                    tempConsolidated[masterId] = {
                        masterId: masterId,
                        uniqueKey: masterId,
                        guestName: cleanStr(row[RES_COL_NAME]),
                        status: status,
                        clerk: rowClerkExcel, // מהאקסל
                        priceCode: priceCode,
                        totalOrderPrice: 0,
                        manualFix: false,
                        arrivalDate: arrivalDate,
                        isSplit: false
                    };
                }
                tempConsolidated[masterId].totalOrderPrice += price;
            }
        });

        // --- חישוב כספי סופי ---
        const finalRows = Object.values(tempConsolidated).map(item => {
            let foundData = currentInvoicesMap["ID_" + item.masterId] || currentInvoicesMap["NAME_" + item.guestName];
            let finalInvoiceAmount = foundData ? parseFloat(foundData.amount) : 0;
            let finalInvNum = foundData ? Array.from(foundData.numbers).join(" | ") : "";

            let isGroup = item.priceCode.includes("קבוצות");
            let baseRate = isGroup ? 0.015 : 0.03;
            let commissionRate = baseRate;

            // יישום הפיצול בפועל
            if (item.isSplit) {
                if (item.splitRole === 'creator') commissionRate = baseRate * 0.8;
                else if (item.splitRole === 'closer') commissionRate = baseRate * 0.2;
            }

            let expectedWithVat = item.totalOrderPrice * 1.18;
            let diff = Math.abs(expectedWithVat - finalInvoiceAmount);

            let colorStatus = 'red';
            if (expectedWithVat > 0 || finalInvoiceAmount > 0) {
                if (diff < 5.0) colorStatus = 'green';
                else if (expectedWithVat < finalInvoiceAmount) colorStatus = 'yellow';
            }

            if (colorStatus === 'green') {
                newSelectedIds.add(item.uniqueKey);
            }

            return {
                ...item,
                finalInvoiceAmount,
                finalInvNum,
                commissionToPay: finalInvoiceAmount * commissionRate,
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
        const defaultRate = row.commissionRate ? row.commissionRate.toString() : '3';
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
            if (r.uniqueKey === rowToFix.uniqueKey) {
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
        newSelected.add(rowToFix.uniqueKey);
        setSelectedRows(newSelected);
        setIsFixDialogOpen(false);
        toast.success(`העסקה עודכנה!`);
    };

    const handleGenerateReport = () => {
        const rowsToSave = processedRows.filter(r => selectedRows.has(r.uniqueKey));
        if (rowsToSave.length === 0) return toast.error("לא נבחרו שורות");
        if (!window.confirm(`האם להפיק דוח?`)) return;
        generateMutation.mutate(rowsToSave);
    };

    const toggleRow = (id) => {
        const next = new Set(selectedRows);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedRows(next);
    };

    const visibleRows = processedRows.filter(r => r.colorStatus !== 'green' || r.manualFix);
    const hiddenGreenCount = processedRows.length - visibleRows.length;
    const totalSelectedCommission = processedRows.filter(r => selectedRows.has(r.uniqueKey)).reduce((sum, r) => sum + r.commissionToPay, 0);

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
                                            <tr key={row.uniqueKey} className={`hover:bg-slate-50 transition-colors ${selectedRows.has(row.uniqueKey) ? 'bg-green-50' : ''}`}>
                                                <td className="p-3 text-center">
                                                    <Checkbox checked={selectedRows.has(row.uniqueKey)} onCheckedChange={() => toggleRow(row.uniqueKey)} />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <Button variant="ghost" size="icon" onClick={() => openFixDialog(row)} title="תיקון ידני">
                                                        <Pencil className="h-4 w-4 text-blue-600"/>
                                                    </Button>
                                                </td>
                                                <td className="p-3 text-xs text-right">{row.finalInvNum}</td>
                                                <td className="p-3 font-mono text-right">{row.masterId}</td>
                                                <td className="p-3 text-right">{row.guestName}</td>
                                                <td className="p-3 text-right text-xs">
                                                    {row.arrivalDate ? format(row.arrivalDate, 'dd/MM/yy') : '-'}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {row.clerk}
                                                    {row.isSplit && <span className="mr-1 text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{row.splitRole === 'creator' ? 'יוצר' : 'סוגר'}</span>}
                                                </td>
                                                <td className="p-3 text-gray-500 text-right">{row.totalOrderPrice.toLocaleString()}</td>
                                                <td className="p-3 font-medium text-right">{row.expectedWithVat.toLocaleString()}</td>
                                                <td className="p-3 font-bold text-right">{row.finalInvoiceAmount.toLocaleString()}</td>
                                                <td className="p-3 text-purple-700 font-bold text-right">
                                                    {row.commissionToPay.toLocaleString()}
                                                    <span className="text-xs text-gray-400 font-normal mr-1">
                                                        ({(row.commissionRate.toFixed(1))}%)
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
                                    <span className="font-bold text-lg text-purple-700">{((parseFloat(fixAmount) || 0) * (parseFloat(fixRate) || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 1 })} ₪</span>
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