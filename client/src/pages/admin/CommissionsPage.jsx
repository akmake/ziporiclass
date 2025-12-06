import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Checkbox } from '@/components/ui/Checkbox.jsx';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, Download, Save } from 'lucide-react';

// --- הגדרות עמודות מהקובץ המקורי ---
const INV_COL_ID = "c_folio_number";
const INV_COL_NAME = "guest_name";
const INV_COL_AMOUNT = "invoice_amount";
const INV_COL_NUM = "c_invoice_number";

// --- פונקציות עזר (לוגיקה מה-HTML) ---
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
    const [processedRows, setProcessedRows] = useState([]);
    const [selectedRows, setSelectedRows] = useState(new Set()); // IDs שנבחרו להפקה
    const [step, setStep] = useState(1); // 1=Upload, 2=Review, 3=Done

    const queryClient = useQueryClient();

    // שליפת רשימת ההזמנות שכבר שולמו (היסטוריה)
    const { data: paidHistoryIds = [] } = useQuery({
        queryKey: ['paidCommissions'],
        queryFn: async () => (await api.get('/admin/commissions/paid-ids')).data
    });

    // מוטציה לשמירת ההזמנות ששולמו
    const saveMutation = useMutation({
        mutationFn: (items) => api.post('/admin/commissions/mark-paid', { items }),
        onSuccess: () => {
            toast.success('הדוח הופק והנתונים נשמרו בהיסטוריה!');
            queryClient.invalidateQueries(['paidCommissions']);
            setStep(1); // חזרה להתחלה או רענון
            setProcessedRows([]);
            setInvoicesMap(null);
            setReservationsData(null);
        },
        onError: () => toast.error('שגיאה בשמירת הנתונים')
    });

    // --- קריאת קבצים ---
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
        toast.success(`נטענו ${data.length} שורות הזמנות`);
    };

    // --- הלוגיקה הראשית: הצלבה וסינון ---
    const handleAnalyze = () => {
        if (!invoicesMap || !reservationsData) return toast.error("חובה להעלות את שני הקבצים");

        const tempConsolidated = {};
        const newSelected = new Set();

        reservationsData.forEach(row => {
            // סינונים בסיסיים
            let status = (row["c_reservation_status"] || "").toString().toLowerCase();
            if (status === "can") return; // מבוטל

            let masterId = (row["c_master_id"] || "").toString().trim();
            if (!masterId) return;

            // 🛑 סינון קריטי: אם כבר שולם בעבר - דלג!
            if (paidHistoryIds.includes(masterId)) return;

            let price = parseMoney(row["price_local"]);

            if (!tempConsolidated[masterId]) {
                tempConsolidated[masterId] = {
                    masterId: masterId,
                    guestName: cleanStr(row["guest_name"]),
                    status: row["c_reservation_status"],
                    clerk: cleanStr(row["c_taken_clerk"]),
                    priceCode: cleanStr(row["c_price_code"] || ""),
                    roomCount: 0,
                    totalOrderPrice: 0
                };
            }
            tempConsolidated[masterId].totalOrderPrice += price;
            tempConsolidated[masterId].roomCount += 1;
        });

        // חישוב סופי לכל שורה
        const finalRows = Object.values(tempConsolidated).map(item => {
            // חיפוש בחשבוניות
            let foundData = invoicesMap["ID_" + item.masterId] || invoicesMap["NAME_" + item.guestName];
            
            let finalInvoiceAmount = foundData ? parseFloat(foundData.amount) : 0;
            let finalInvNum = foundData ? Array.from(foundData.numbers).join(" | ") : "";

            // חישוב עמלה
            let isGroup = item.priceCode.includes("קבוצות");
            let commissionRate = isGroup ? 0.015 : 0.03;
            let commissionToPay = finalInvoiceAmount * commissionRate;

            // צבעים ולוגיקה
            let expectedWithVat = item.totalOrderPrice * 1.18;
            let diff = Math.abs(expectedWithVat - finalInvoiceAmount);
            
            let colorStatus = 'red'; // ברירת מחדל: חסר כסף
            if (expectedWithVat > 0 || finalInvoiceAmount > 0) {
                if (diff < 5.0) colorStatus = 'green'; // תואם
                else if (expectedWithVat < finalInvoiceAmount) colorStatus = 'yellow'; // שולם יותר
            }

            // אוטומציה: אם ירוק - סמן אוטומטית!
            if (colorStatus === 'green') {
                newSelected.add(item.masterId);
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

        // סינון שורות ללא חשבונית וללא תשלום (לא רלוונטיות לדוח)
        const relevantRows = finalRows.filter(r => r.finalInvoiceAmount > 0 || r.expectedWithVat > 0);

        setProcessedRows(relevantRows);
        setSelectedRows(newSelected);
        setStep(2);
    };

    // --- פעולות בטבלה ---
    const toggleRow = (id) => {
        const next = new Set(selectedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRows(next);
    };

    // --- הפקת דוח וסיום ---
    const handleFinalize = () => {
        const rowsToPay = processedRows.filter(r => selectedRows.has(r.masterId));
        
        if (rowsToPay.length === 0) return toast.error("לא נבחרו שורות לתשלום");

        if (!window.confirm(`אתה עומד לאשר תשלום עמלות עבור ${rowsToPay.length} הזמנות.\nהזמנות אלו יסומנו כ"שולמו" ולא יופיעו בדוחות הבאים.\nלהמשיך?`)) return;

        // 1. יצירת אקסל להורדה (כמו ב-HTML המקורי)
        generateExcel(rowsToPay);

        // 2. שמירה בשרת
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
        // חישוב סיכום לפי נציג
        const clerkSummary = {};
        rows.forEach(r => {
            if (!clerkSummary[r.clerk]) clerkSummary[r.clerk] = 0;
            clerkSummary[r.clerk] += r.commissionToPay;
        });

        // הכנת הנתונים לגיליון
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

    // --- UI Render ---
    return (
        <div className="container mx-auto p-6 space-y-8 bg-slate-50 min-h-screen">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <FileSpreadsheet className="text-purple-600"/> מחולל דוחות עמלות (V16)
                </h1>
                <p className="text-gray-600 mt-1">
                    המערכת תזהה אוטומטית הזמנות חדשות שנסגרו ותחשב עמלות. הזמנות שאושרו בעבר לא יופיעו שוב.
                </p>
            </header>

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
                        <Button onClick={handleAnalyze} disabled={!invoicesMap || !reservationsData} className="w-full h-12 text-lg bg-purple-700 hover:bg-purple-800">
                            <UploadCloud className="ml-2"/> בצע הצלבה וניתוח
                        </Button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow border">
                        <div>
                            <h2 className="text-xl font-bold">תוצאות ניתוח</h2>
                            <p className="text-sm text-gray-500">סה"כ {processedRows.length} הזמנות רלוונטיות (שלא שולמו בעבר).</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setStep(1)}>התחל מחדש</Button>
                            <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700 gap-2">
                                <Save size={18}/> הפק דוח וסמן כ"שולם"
                            </Button>
                        </div>
                    </div>

                    {/* מקרא */}
                    <div className="flex gap-4 justify-center text-sm font-bold">
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded border border-green-200 flex items-center gap-2"><CheckCircle size={14}/> ירוק: תואם (נבחר אוטומטית)</span>
                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded border border-red-200 flex items-center gap-2"><AlertTriangle size={14}/> אדום: חסר כסף</span>
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded border border-yellow-200 flex items-center gap-2"><AlertTriangle size={14}/> צהוב: שולם יותר</span>
                    </div>

                    <div className="bg-white rounded-lg shadow overflow-hidden border">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                <tr>
                                    <th className="p-3 w-10">בחר</th>
                                    <th className="p-3">הזמנה</th>
                                    <th className="p-3">אורח</th>
                                    <th className="p-3">נציג</th>
                                    <th className="p-3">צפוי (כולל מע"מ)</th>
                                    <th className="p-3">בפועל (חשבונית)</th>
                                    <th className="p-3">עמלה</th>
                                    <th className="p-3">סטטוס</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {processedRows.map(row => (
                                    <tr key={row.masterId} className={`hover:bg-slate-50 transition-colors ${selectedRows.has(row.masterId) ? 'bg-purple-50' : ''}`}>
                                        <td className="p-3 text-center">
                                            <Checkbox 
                                                checked={selectedRows.has(row.masterId)}
                                                onCheckedChange={() => toggleRow(row.masterId)}
                                            />
                                        </td>
                                        <td className="p-3 font-mono">{row.masterId}</td>
                                        <td className="p-3">{row.guestName}</td>
                                        <td className="p-3">{row.clerk}</td>
                                        <td className="p-3">{row.expectedWithVat.toLocaleString()} ₪</td>
                                        <td className="p-3 font-bold">{row.finalInvoiceAmount.toLocaleString()} ₪</td>
                                        <td className="p-3 text-purple-700 font-bold">{row.commissionToPay.toLocaleString()} ₪</td>
                                        <td className="p-3">
                                            {row.colorStatus === 'green' && <span className="inline-block w-3 h-3 rounded-full bg-green-500" title="תואם"></span>}
                                            {row.colorStatus === 'red' && <span className="inline-block w-3 h-3 rounded-full bg-red-500" title="חסר"></span>}
                                            {row.colorStatus === 'yellow' && <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" title="עודף"></span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}