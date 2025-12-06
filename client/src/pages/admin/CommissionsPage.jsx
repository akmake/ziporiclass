import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { Label } from '@/components/ui/Label.jsx';
import { UploadCloud, FileSpreadsheet, AlertTriangle, Save, Filter, CheckCircle2 } from 'lucide-react';

// --- הגדרות עמודות ---
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
    // State
    const [invoicesMap, setInvoicesMap] = useState(null);
    const [reservationsData, setReservationsData] = useState(null);
    
    // ניהול נציגים
    const [allClerks, setAllClerks] = useState([]);
    const [selectedClerks, setSelectedClerks] = useState(new Set());

    // תוצאות
    const [processedRows, setProcessedRows] = useState([]);
    const [selectedRows, setSelectedRows] = useState(new Set()); // IDs שנבחרו להפקה (כולל ירוקים נסתרים)
    const [step, setStep] = useState(1); // 1=Upload, 2=ClerkSelect, 3=Review

    const queryClient = useQueryClient();

    // שליפת היסטוריה
    const { data: paidHistoryIds = [] } = useQuery({
        queryKey: ['paidCommissions'],
        queryFn: async () => (await api.get('/admin/commissions/paid-ids')).data
    });

    const saveMutation = useMutation({
        mutationFn: (items) => api.post('/admin/commissions/mark-paid', { items }),
        onSuccess: () => {
            toast.success('הדוח הופק והנתונים נשמרו!');
            queryClient.invalidateQueries(['paidCommissions']);
            resetAll();
        },
        onError: () => toast.error('שגיאה בשמירת הנתונים')
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

    // --- טעינת קבצים ---
    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

            if (type === 'invoices') processInvoices(jsonData);
            else processReservations(jsonData);
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
        
        // חילוץ רשימת נציגים ייחודית
        const clerksSet = new Set();
        data.forEach(row => {
            const clerk = cleanStr(row["c_taken_clerk"]);
            if (clerk) clerksSet.add(clerk);
        });
        
        const sortedClerks = Array.from(clerksSet).sort();
        setAllClerks(sortedClerks);
        setSelectedClerks(new Set(sortedClerks)); // ברירת מחדל: כולם מסומנים

        toast.success(`נטענו ${data.length} שורות. נמצאו ${sortedClerks.length} נציגים.`);
    };

    // --- ניהול נציגים (Checkbox) ---
    const toggleClerk = (clerk) => {
        const next = new Set(selectedClerks);
        if (next.has(clerk)) next.delete(clerk);
        else next.add(clerk);
        setSelectedClerks(next);
    };

    const toggleAllClerks = () => {
        if (selectedClerks.size === allClerks.length) setSelectedClerks(new Set());
        else setSelectedClerks(new Set(allClerks));
    };

    // --- לוגיקת הניתוח ---
    const handleAnalyze = () => {
        if (!invoicesMap || !reservationsData) return toast.error("חסרים קבצים");
        if (selectedClerks.size === 0) return toast.error("יש לבחור לפחות נציג אחד");

        const tempConsolidated = {};
        const newSelectedIds = new Set();

        reservationsData.forEach(row => {
            // 1. סינון נציגים
            const rowClerk = cleanStr(row["c_taken_clerk"]);
            if (!selectedClerks.has(rowClerk)) return;

            // 2. סינונים בסיסיים
            let status = (row["c_reservation_status"] || "").toString().toLowerCase();
            if (status === "can") return;

            let masterId = (row["c_master_id"] || "").toString().trim();
            if (!masterId) return;

            // 🛑 3. סינון היסטוריה (דילוג על מה שכבר שולם)
            if (paidHistoryIds.includes(masterId)) return;

            let price = parseMoney(row["price_local"]);

            if (!tempConsolidated[masterId]) {
                tempConsolidated[masterId] = {
                    masterId: masterId,
                    guestName: cleanStr(row["guest_name"]),
                    status: row["c_reservation_status"],
                    clerk: rowClerk,
                    priceCode: cleanStr(row["c_price_code"] || ""),
                    roomCount: 0,
                    totalOrderPrice: 0
                };
            }
            tempConsolidated[masterId].totalOrderPrice += price;
            tempConsolidated[masterId].roomCount += 1;
        });

        // חישוב סופי
        const finalRows = Object.values(tempConsolidated).map(item => {
            let foundData = invoicesMap["ID_" + item.masterId] || invoicesMap["NAME_" + item.guestName];
            
            let finalInvoiceAmount = foundData ? parseFloat(foundData.amount) : 0;
            let finalInvNum = foundData ? Array.from(foundData.numbers).join(" | ") : "";

            let isGroup = item.priceCode.includes("קבוצות");
            let commissionRate = isGroup ? 0.015 : 0.03;
            let commissionToPay = finalInvoiceAmount * commissionRate;

            let expectedWithVat = item.totalOrderPrice * 1.18;
            let diff = Math.abs(expectedWithVat - finalInvoiceAmount);
            
            let colorStatus = 'red'; // ברירת מחדל: חסר/בעייתי
            if (expectedWithVat > 0 || finalInvoiceAmount > 0) {
                if (diff < 5.0) colorStatus = 'green'; 
                else if (expectedWithVat < finalInvoiceAmount) colorStatus = 'yellow';
            }

            // ✨ אוטומציה: ירוק נכנס ל-Selected אוטומטית!
            if (colorStatus === 'green') {
                newSelectedIds.add(item.masterId);
            }

            return {
                ...item,
                finalInvoiceAmount,
                finalInvNum,
                commissionToPay,
                expectedWithVat,
                colorStatus
            };
        });

        // סינון שורות ריקות לחלוטין
        const relevantRows = finalRows.filter(r => r.finalInvoiceAmount > 0 || r.expectedWithVat > 0);

        setProcessedRows(relevantRows);
        setSelectedRows(newSelectedIds);
        setStep(3); // מעבר למסך התוצאות
    };

    // --- UI של טבלה ---
    const handleRowSelection = (id) => {
        const next = new Set(selectedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRows(next);
    };

    const handleFinalize = () => {
        // שולחים את כל מה שמסומן (כולל הירוקים הנסתרים)
        const rowsToPay = processedRows.filter(r => selectedRows.has(r.masterId));
        
        if (rowsToPay.length === 0) return toast.error("לא נבחרו שורות לתשלום");

        if (!window.confirm(`סה"כ ${rowsToPay.length} עסקאות יסומנו כ"שולמו" (כולל ירוקות).\nהאם להמשיך?`)) return;

        generateExcel(rowsToPay);

        const dbPayload = rowsToPay.map(r => ({
            masterId: r.masterId,
            clerkName: r.clerk,
            guestName: r.guestName,
            commissionAmount: r.commissionToPay,
            invoiceNumbers: r.finalInvNum.split('|'),
            status: 'paid'
        }));

        saveMutation.mutate(dbPayload);
    };

    const generateExcel = (rows) => {
        const clerkSummary = {};
        rows.forEach(r => {
            if (!clerkSummary[r.clerk]) clerkSummary[r.clerk] = 0;
            clerkSummary[r.clerk] += r.commissionToPay;
        });

        const summaryData = Object.entries(clerkSummary).map(([name, total]) => ({
            "שם הנציג": name,
            "סה\"כ עמלה": total
        }));

        const detailsData = rows.map(r => ({
            "חשבוניות": r.finalInvNum,
            "הזמנה": r.masterId,
            "אורח": r.guestName,
            "פקיד": r.clerk,
            "מחיר הזמנה (ללא מעמ)": r.totalOrderPrice,
            "צפוי (כולל מעמ)": r.expectedWithVat,
            "שולם בפועל": r.finalInvoiceAmount,
            "עמלה לתשלום": r.commissionToPay,
            "סטטוס התאמה": r.colorStatus === 'green' ? 'תקין' : r.colorStatus === 'yellow' ? 'עודף' : 'חוסר'
        }));

        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "סיכום נציגים");
        const wsDetails = XLSX.utils.json_to_sheet(detailsData);
        XLSX.utils.book_append_sheet(wb, wsDetails, "פירוט עסקאות");
        XLSX.writeFile(wb, `Commissions_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    // חישוב כמה ירוקים יש סה"כ (לתצוגה)
    const greenCount = processedRows.filter(r => r.colorStatus === 'green').length;
    // סינון שורות לתצוגה (רק לא ירוקות)
    const visibleRows = processedRows.filter(r => r.colorStatus !== 'green');

    return (
        <div className="container mx-auto p-6 space-y-8 bg-slate-50 min-h-screen">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <FileSpreadsheet className="text-purple-600"/> מחולל דוחות עמלות
                </h1>
                <p className="text-gray-600 mt-1">
                    המערכת תזהה אוטומטית עסקאות תקינות (ירוק) ותסתיר אותן. עליך לאשר רק את החריגים.
                </p>
            </header>

            {/* שלב 1: העלאת קבצים */}
            {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className={`border-2 border-dashed ${invoicesMap ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                        <CardHeader><CardTitle>1. דוח חשבוניות</CardTitle></CardHeader>
                        <CardContent className="text-center">
                            <input type="file" onChange={(e) => handleFileUpload(e, 'invoices')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
                        </CardContent>
                    </Card>

                    <Card className={`border-2 border-dashed ${reservationsData ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                        <CardHeader><CardTitle>2. דוח הזמנות (250)</CardTitle></CardHeader>
                        <CardContent className="text-center">
                            <input type="file" onChange={(e) => handleFileUpload(e, 'reservations')} disabled={!invoicesMap} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
                        </CardContent>
                    </Card>

                    <div className="col-span-full">
                        <Button onClick={() => setStep(2)} disabled={!invoicesMap || !reservationsData} className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700">
                            המשך לבחירת נציגים
                        </Button>
                    </div>
                </div>
            )}

            {/* שלב 2: בחירת נציגים */}
            {step === 2 && (
                <Card className="max-w-4xl mx-auto">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>בחר נציגים לחישוב</CardTitle>
                        <div className="space-x-2 space-x-reverse">
                            <Button variant="outline" size="sm" onClick={toggleAllClerks}>
                                {selectedClerks.size === allClerks.length ? 'נקה הכל' : 'סמן הכל'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border max-h-[300px] overflow-y-auto">
                            {allClerks.map(clerk => (
                                <div key={clerk} className="flex items-center gap-2 p-2 bg-white rounded border">
                                    <Checkbox 
                                        id={`c_${clerk}`} 
                                        checked={selectedClerks.has(clerk)}
                                        onCheckedChange={() => toggleClerk(clerk)}
                                    />
                                    <Label htmlFor={`c_${clerk}`} className="cursor-pointer truncate text-sm" title={clerk}>
                                        {clerk}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex justify-between">
                            <Button variant="outline" onClick={() => setStep(1)}>חזור</Button>
                            <Button onClick={handleAnalyze} className="bg-purple-700 hover:bg-purple-800 gap-2 w-48">
                                <Filter size={18}/> בצע ניתוח
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* שלב 3: תוצאות */}
            {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    
                    {/* סיכום עליון */}
                    <div className="bg-white p-4 rounded-lg shadow border border-green-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-3 rounded-full text-green-700">
                                <CheckCircle2 size={32} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">ניתוח הושלם!</h2>
                                <p className="text-gray-600">
                                    <span className="font-bold text-green-700">{greenCount}</span> עסקאות תקינות (ירוקות) סומנו אוטומטית והוסתרו.
                                    <br/>
                                    לפניך <span className="font-bold text-red-600">{visibleRows.length}</span> עסקאות חריגות לבדיקה ידנית.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={resetAll}>התחל מחדש</Button>
                            <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700 gap-2 h-12 px-6 text-lg shadow-md">
                                <Save size={20}/> הפק דוח סופי ({selectedRows.size})
                            </Button>
                        </div>
                    </div>

                    {/* טבלה (רק לא ירוקים) */}
                    <div className="bg-white rounded-lg shadow overflow-hidden border">
                        <div className="p-3 bg-red-50 border-b border-red-100 text-red-800 text-sm font-bold flex items-center gap-2">
                            <AlertTriangle size={16}/> רשימת חריגים לבדיקה (אדום/צהוב בלבד)
                        </div>
                        
                        {visibleRows.length === 0 ? (
                            <div className="p-10 text-center text-gray-500">
                                אין חריגים! כל העסקאות ירוקות ומוכנות להפקה.
                            </div>
                        ) : (
                            <table className="w-full text-sm text-right">
                                <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                    <tr>
                                        <th className="p-3 w-12 text-center">אשר</th>
                                        <th className="p-3">הזמנה</th>
                                        <th className="p-3">אורח</th>
                                        <th className="p-3">נציג</th>
                                        <th className="p-3">צפוי (כולל מע"מ)</th>
                                        <th className="p-3">בפועל (חשבונית)</th>
                                        <th className="p-3">הפרש</th>
                                        <th className="p-3">סטטוס</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {visibleRows.map(row => (
                                        <tr key={row.masterId} className={`hover:bg-slate-50 transition-colors ${selectedRows.has(row.masterId) ? 'bg-green-50' : ''}`}>
                                            <td className="p-3 text-center">
                                                <Checkbox 
                                                    checked={selectedRows.has(row.masterId)}
                                                    onCheckedChange={() => handleRowSelection(row.masterId)}
                                                />
                                            </td>
                                            <td className="p-3 font-mono">{row.masterId}</td>
                                            <td className="p-3">{row.guestName}</td>
                                            <td className="p-3">{row.clerk}</td>
                                            <td className="p-3">{row.expectedWithVat.toLocaleString()} ₪</td>
                                            <td className="p-3 font-bold">{row.finalInvoiceAmount.toLocaleString()} ₪</td>
                                            <td className="p-3 text-gray-500" dir="ltr">
                                                {(row.finalInvoiceAmount - row.expectedWithVat).toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                {row.colorStatus === 'red' && <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">חסר כסף</span>}
                                                {row.colorStatus === 'yellow' && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">שולם יותר</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}