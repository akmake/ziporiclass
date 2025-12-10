// client/src/pages/admin/CommissionsPage.jsx
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { format, isSameMonth } from 'date-fns';
import { he } from 'date-fns/locale';

// ייבוא הרכיבים החדשים
import CommissionGenerator from '@/components/CommissionGenerator.jsx'; 
import { getReportSummary } from '@/utils/commissionLogic.js';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Button } from '@/components/ui/Button.jsx';
import { Label } from '@/components/ui/Label.jsx';
import { FileSpreadsheet, Trophy, Calendar, ChevronUp, ChevronDown } from 'lucide-react';

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

// --- טבלאות עזר פנימיות ---

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

function CommissionsByArrivalDate() {
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [showDetails, setShowDetails] = useState(false);

    const { data: reports = [] } = useQuery({
        queryKey: ['commissionReports'],
        queryFn: async () => (await api.get('/admin/commissions/reports')).data
    });

    const availableMonths = useMemo(() => {
        const monthsSet = new Set();
        reports.flatMap(r => r.items || []).forEach(item => {
            if (item.arrivalDate) {
                monthsSet.add(format(new Date(item.arrivalDate), 'yyyy-MM'));
            }
        });
        return Array.from(monthsSet).sort().reverse();
    }, [reports]);

    const { filteredItems, totalCommission } = useMemo(() => {
        if (selectedMonth === 'all') return { filteredItems: [], totalCommission: 0 };

        const [year, month] = selectedMonth.split('-');
        const targetDate = new Date(parseInt(year), parseInt(month) - 1, 1);

        const allItems = reports.flatMap(r => r.items || []);

        const filtered = allItems.filter(item => {
            if (!item.arrivalDate) return false;
            return isSameMonth(new Date(item.arrivalDate), targetDate);
        });

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