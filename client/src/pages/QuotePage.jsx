// client/src/pages/QuotePage.jsx
import React, { useRef, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ArrowRight, Download, Send, User, LoaderCircle, Mail, Calendar, Zap } from 'lucide-react';
import { formatPhoneForWhatsApp } from '@/utils/phone.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const SERVER_ROOT = API_BASE.replace(/\/api$/, '');
const LOGO_URL = `${SERVER_ROOT}/uploads/company-logo.png?t=${Date.now()}`;

const printStyles = `
  @media print {
    @page { size: A4; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; }
    .no-print { display: none !important; }
    .quote-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
  }
`;

const fetchOrder = async (orderId) => (await api.get(`/orders/public/${orderId}`)).data;

const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n+/g, '\n')
    .trim();
};

export default function QuotePage() {
  const { orderId } = useParams();
  const pagesContainerRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['publicOrder', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: !!orderId,
  });

  const whatsappNumber = order?.customerPhone ? formatPhoneForWhatsApp(order.customerPhone) : null;
  const hotel = order?.hotel || {};
  const brandColor = hotel?.brandColor || '#b45309';

  // --- לוגיקת חלוקת עמודים מתוקנת (מספור קבוע) ---
  const pages = useMemo(() => {
    if (!order) return [];

    // 1. נרמול חדרים + מתן מספר סידורי קבוע
    const roomItems = (order.rooms || []).map((room, idx) => ({
        _type: 'room',
        _id: `room-${idx}`,
        serialNumber: idx + 1, // ✨ מספר סידורי קבוע
        name: room.roomType || 'חדר רגיל',
        description: room.price_list_names?.join(' + '),
        roomNote: room.notes,
        details: room,
        price: room.price
    }));

    // 2. נרמול תוספות + המשך מספור סידורי
    const startExtraIndex = roomItems.length + 1;
    const extraItems = (order.extras || []).map((extra, idx) => ({
        _type: 'extra',
        _id: `extra-${idx}`,
        serialNumber: startExtraIndex + idx, // ✨ המשך מספור רציף
        name: extra.extraType,
        description: 'תוספת להזמנה',
        details: extra,
        price: extra.price * extra.quantity
    }));

    // 3. איחוד לרשימה אחת (כולל כותרת ללא מספר)
    let allContent = [...roomItems];
    if (extraItems.length > 0) {
        allContent.push({ _type: 'header', name: 'תוספות ושדרוגים' });
        allContent = [...allContent, ...extraItems];
    }

    // --- הגדרות עמודים ---
    const ITEMS_PER_FIRST_PAGE = 4;
    const ITEMS_PER_MIDDLE_PAGE = 7; // התיקון הקודם נשאר (7 ולא 8)
    const ITEMS_PER_LAST_PAGE = 7;

    const resultPages = [];
    if (allContent.length === 0) {
       resultPages.push({ items: [], isFirst: true, isLast: true, pageIndex: 0 });
       return resultPages;
    }

    // --- עמוד ראשון ---
    const firstPageItems = allContent.slice(0, ITEMS_PER_FIRST_PAGE);
    let remainingItems = allContent.slice(ITEMS_PER_FIRST_PAGE);

    resultPages.push({
        items: firstPageItems,
        isFirst: true,
        isLast: remainingItems.length === 0,
        pageIndex: 0
    });

    let pIndex = 1;

    // --- עמודי המשך ---
    while (remainingItems.length > 0) {
        if (remainingItems.length <= ITEMS_PER_MIDDLE_PAGE) {
            // אם נשאר קצת, נבדוק אם זה חורג מהעמוד האחרון
            if (remainingItems.length > ITEMS_PER_LAST_PAGE) {
                // צריך לפצל: עמוד אמצע + עמוד אחרון
                const takeCount = remainingItems.length - ITEMS_PER_LAST_PAGE;
                const chunk = remainingItems.slice(0, takeCount);
                remainingItems = remainingItems.slice(takeCount);

                resultPages.push({
                    items: chunk,
                    isFirst: false,
                    isLast: false,
                    pageIndex: pIndex
                });
                pIndex++;
            } else {
                // נכנס הכל בעמוד האחרון
                resultPages.push({
                    items: remainingItems,
                    isFirst: false,
                    isLast: true,
                    pageIndex: pIndex
                });
                remainingItems = [];
            }
        }
        else {
            // עמוד אמצע מלא
            const chunk = remainingItems.slice(0, ITEMS_PER_MIDDLE_PAGE);
            remainingItems = remainingItems.slice(ITEMS_PER_MIDDLE_PAGE);

            resultPages.push({
                items: chunk,
                isFirst: false,
                isLast: false,
                pageIndex: pIndex
            });
            pIndex++;
        }
    }

    return resultPages;
  }, [order]);

  const cleanNotes = useMemo(() => stripHtml(order?.notes), [order?.notes]);

  const generatePDF = async (action = 'download') => {
    if (!pagesContainerRef.current) return;
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();

      const pageElements = pagesContainerRef.current.querySelectorAll('.quote-page');
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        const canvas = await html2canvas(pageEl, {
            scale: 2, // הורדתי ל-2 לביצועים מהירים יותר, אפשר להחזיר ל-4 אם האיכות יורדת
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        const imgHeight = canvas.height * (pdfWidth / canvas.width);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
      }

      if (action === 'download') {
        const cleanName = (order.customerName || 'לקוח').replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_');
        pdf.save(`הצעת_מחיר_${cleanName}_${order.orderNumber}.pdf`);
        return true;
      } else if (action === 'blob') {
        return pdf.output('blob');
      }

    } catch (err) {
      console.error("PDF Gen Error:", err);
      toast.error('שגיאה ביצירת הקובץ');
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const toastId = toast.loading('מכין קובץ PDF...');
    await generatePDF('download');
    toast.success('הקובץ ירד!', { id: toastId });
    setIsDownloading(false);
  };

  const handleSendEmail = async () => {
    if (!targetEmail) return toast.error('נא להזין כתובת אימייל');
    setIsSendingEmail(true);
    const toastId = toast.loading('מייצר ושולח מייל...');

    try {
      const pdfBlob = await generatePDF('blob');
      if (!pdfBlob) throw new Error('Failed to generate PDF');

      const formData = new FormData();
      formData.append('pdf', pdfBlob, 'quote.pdf');
      formData.append('email', targetEmail);
      formData.append('customerName', order.customerName);
      await api.post(`/orders/${order._id}/email`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`המייל נשלח בהצלחה ל-${targetEmail}`, { id: toastId });
      setIsEmailDialogOpen(false);
      setTargetEmail('');
    } catch (error) {
      console.error(error);
      toast.error('שגיאה בשליחת המייל', { id: toastId });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleQuickSend = async () => {
      if (!order.customerEmail) {
           return toast.error('לא קיים כתובת מייל בהזמנה זו. השתמש בשליחה ידנית.');
      }

      if (!window.confirm(`לשלוח את ההצעה כעת ל-${order.customerEmail}?`)) return;
      setIsSendingEmail(true);
      const toastId = toast.loading(`מייצר ושולח מייל ל-${order.customerEmail}...`);

      try {
           const pdfBlob = await generatePDF('blob');
           if (!pdfBlob) throw new Error('Failed to generate PDF');

           const formData = new FormData();
           const fileName = `quote_${order.orderNumber}.pdf`;
           formData.append('pdf', pdfBlob, fileName);
           formData.append('email', order.customerEmail);
           formData.append('customerName', order.customerName);

           await api.post(`/orders/${order._id}/email`, formData, {
               headers: { 'Content-Type': 'multipart/form-data' }
           });
           toast.success('המייל נשלח ללקוח בהצלחה!', { id: toastId });
      } catch (error) {
           console.error(error);
           toast.error('שגיאה בשליחת המייל האוטומטי', { id: toastId });
      } finally {
           setIsSendingEmail(false);
      }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><LoaderCircle className="animate-spin h-10 w-10 text-amber-600"/></div>;
  if (isError) return <div className="text-center p-10">שגיאה בטעינת ההזמנה.</div>;

  return (
    <div className="min-h-screen bg-gray-200 pb-10 font-sans">
      <style>{printStyles}</style>

      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm no-print">
          <div className="flex items-center gap-4">
              <Button variant="ghost" asChild>
                <Link to="/orders-history"><ArrowRight className="ml-2 h-4 w-4"/> חזור</Link>
              </Button>
            <span className="font-bold text-gray-700 hidden sm:inline">תצוגה מקדימה ({pages.length} דפים)</span>
          </div>
        <div className="flex gap-2">
            <Button onClick={handleDownloadPDF} disabled={isDownloading} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm">
                {isDownloading ? <LoaderCircle className="animate-spin h-4 w-4"/> : <Download className="h-4 w-4"/>}
                <span className="hidden sm:inline">הורד PDF</span>
            </Button>

            {order.customerEmail && (
               <Button
                 onClick={handleQuickSend}
                 disabled={isSendingEmail || isDownloading}
                 className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                 title={`שלח אוטומטית ל-${order.customerEmail}`}
               >
                 {isSendingEmail ? <LoaderCircle className="animate-spin h-4 w-4"/> : <Zap className="h-4 w-4" />}
                 <span className="hidden sm:inline">שלח ללקוח</span>
               </Button>
            )}

            <Button onClick={() => setIsEmailDialogOpen(true)} variant="outline" className="gap-2 border-blue-600 text-blue-700 hover:bg-blue-50">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">שלח למייל אחר</span>
            </Button>

            {whatsappNumber && (
                 <Button onClick={() => { handleDownloadPDF().then(() => {
                   setTimeout(() => {
                        const text = `היי ${order.customerName}, מצורפת הצעת המחיר שלך.`;
                        window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank');
                   }, 1500);
              }) }} variant="outline" className="gap-2 border-green-600 text-green-700 hover:bg-green-50">
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">וואטסאפ</span>
                 </Button>
            )}
        </div>
      </header>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>שליחת הצעה במייל (ידני)</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">מייל</Label>
              <Input id="email" type="email" placeholder="כתובת מייל הלקוח" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
              <Button type="submit" onClick={handleSendEmail} disabled={isSendingEmail}>
               {isSendingEmail && <LoaderCircle className="ml-2 h-4 w-4 animate-spin" />} שלח הצעה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col items-center py-8 gap-8" ref={pagesContainerRef}>
        {pages.map((pageData, index) => (
           <div
                key={index}
                className="quote-page bg-white shadow-2xl w-[210mm] min-h-[297mm] relative text-slate-800 mx-auto flex flex-col"
                style={{ padding: '15mm' }}
           >
                {/* === כותרת ופרטים (רק בעמוד הראשון) === */}
                {pageData.isFirst ? (
                    <>
                        <div className="flex justify-between items-start border-b-2 border-gray-100 pb-8 mb-8">
                           <div className="w-1/2">
                                <h1 className="text-4xl font-extrabold text-slate-900 mb-2">הצעת מחיר</h1>
                                <p className="text-slate-500 text-sm">תאריך הפקה: {format(new Date(), 'dd/MM/yyyy')}</p>
                                <p className="text-slate-500 text-sm">מספר הזמנה: <span className="font-mono font-bold text-slate-700">#{order.orderNumber}</span></p>
                            </div>
                            <div className="w-1/2 flex flex-col items-end text-left">
                                <img src={LOGO_URL} alt="Logo" className="h-40 object-contain mb-3" crossOrigin="anonymous" onError={(e) => e.target.style.display = 'none'} />
                                <div className="text-sm text-gray-500 space-y-1 text-right" dir="ltr">
                                    {hotel.address && <p>{hotel.address}</p>}
                                    {hotel.phone && <p>{hotel.phone}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-6 mb-10 border border-gray-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                                <User className="h-5 w-5 text-slate-400"/> פרטי המזמין
                            </h3>
                            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                <div><span className="text-xs text-gray-500 uppercase tracking-wider block">שם לקוח</span><p className="text-lg font-medium">{order.customerName}</p></div>
                                <div><span className="text-xs text-gray-500 uppercase tracking-wider block">טלפון</span><p className="text-lg font-medium text-right" dir="ltr">{order.customerPhone}</p></div>

                                {order.customerEmail && (
                                    <div><span className="text-xs text-gray-500 uppercase tracking-wider block">אימייל</span><p className="text-base font-medium text-slate-700">{order.customerEmail}</p></div>
                                )}
                                {order.eventDate && (
                                    <div><span className="text-xs text-gray-500 uppercase tracking-wider block">תאריך אירוע/הגעה</span><p className="text-lg font-medium">{format(new Date(order.eventDate), 'dd/MM/yyyy')}</p></div>
                                )}

                                <div><span className="text-xs text-gray-500 uppercase tracking-wider block">מלון</span><p className="text-lg font-medium">{hotel.name}</p></div>
                                <div><span className="text-xs text-gray-500 uppercase tracking-wider block">לילות</span><p className="text-lg font-medium">{order.numberOfNights || 1}</p></div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="border-b border-gray-100 pb-4 mb-6 flex justify-between items-center opacity-60">
                        <span className="text-sm font-bold">המשך הזמנה #{order.orderNumber}</span>
                        <span className="text-xs">דף {index + 1} מתוך {pages.length}</span>
                    </div>
                )}


                {/* === טבלת הפירוט === */}
                <div className="flex-grow">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">
                         {pageData.isFirst ? 'פירוט ההזמנה' : 'המשך פירוט'}
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-right">
                           <thead className="bg-gray-100 text-gray-600">
                                <tr>
                                    <th className="py-3 px-4 border-b font-semibold w-12 text-center">#</th>
                                    <th className="py-3 px-4 border-b font-semibold">תיאור</th>
                                    <th className="py-3 px-4 border-b font-semibold w-1/3">הרכב / כמות</th>
                                    <th className="py-3 px-4 border-b font-semibold text-left w-32">מחיר</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pageData.items.map((item, idx) => {
                                    if (item._type === 'header') {
                                        return (
                                            <tr key={`header-${idx}`} className="bg-slate-50">
                                                <td colSpan="4" className="py-2 px-4 font-bold text-slate-700 text-sm border-y">
                                                      {item.name}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <tr key={idx}>
                                            {/* ✨ שימוש במספר הסידורי הקבוע במקום בחישוב */}
                                            <td className="py-4 px-4 align-top text-gray-500 text-center">{item.serialNumber}</td>

                                            <td className="py-4 px-4 align-top">
                                                 <p className="font-bold text-slate-800 text-base">{item.name}</p>
                                                {item._type === 'room' && (
                                                    <>
                                                        <p className="text-xs text-gray-500 mt-1 bg-gray-100 inline-block px-2 py-0.5 rounded">
                                                            {item.description}
                                                        </p>
                                                        {item.roomNote && (
                                                            <p className="text-xs text-amber-700 mt-1 italic bg-amber-50 px-2 py-1 rounded border border-amber-100/50 inline-block mr-2">
                                                                הערה: {item.roomNote}
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                                {item._type === 'extra' && (
                                                    <p className="text-xs text-blue-600 mt-1">תוספת</p>
                                                )}
                                            </td>

                                            <td className="py-4 px-4 align-top">
                                                {item._type === 'room' ? (
                                                    <div className="flex flex-wrap gap-2 text-gray-700">
                                                        {item.details.adults > 0 && <span>{item.details.adults} מבוגרים</span>}
                                                        {item.details.teens > 0 && <span>• {item.details.teens} נערים</span>}
                                                        {item.details.children > 0 && <span>• {item.details.children} ילדים</span>}
                                                        {item.details.babies > 0 && <span>• {item.details.babies} תינוקות</span>}
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-700 font-medium">
                                                        כמות: {item.details.quantity}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-4 px-4 align-top text-left font-medium text-slate-900">
                                                {item.price.toLocaleString()} ₪
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* === פוטר והערות (רק בעמוד האחרון) === */}
                {pageData.isLast ? (
                    <div className="mt-auto">
                        {/* 1. קודם ההערות */}
                        {order.notes && (
                            <div className="mb-6 border-t border-dashed border-gray-300 pt-6">
                                <h4 className="font-bold text-sm text-slate-800 mb-3 underline decoration-amber-400 decoration-2 underline-offset-4">הערות ודגשים להזמנה:</h4>
                                <div
                                    className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none bg-yellow-50/50 p-4 rounded-lg border border-yellow-100/50"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                >
                                     {cleanNotes}
                                </div>
                            </div>
                        )}

                        {/* 2. אחר כך המחיר והסיכום */}
                        <div className="border-t-2 border-slate-100 pt-6 mb-8">
                            {order.discountPercent > 0 && (
                                <div className="flex justify-end mb-2 text-sm">
                                    <div className="w-1/2 flex justify-between items-center text-red-600">
                                        <span className="font-medium">הנחה ({order.discountPercent}%):</span>
                                        <span className="font-bold">
                                            - {((order.total_price / (1 - order.discountPercent/100)) * (order.discountPercent/100)).toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-500 w-1/2">
                                    <p>* הצעה זו תקפה בכפוף לזמינות החדרים במלון.</p>
                                    <p>* ט.ל.ח.</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-gray-500 text-sm mb-1">סה"כ לתשלום:</p>
                                    <p className="text-4xl font-extrabold" style={{ color: brandColor }}>{order.total_price.toLocaleString()} ₪</p>
                                </div>
                            </div>
                        </div>

                        <div className="text-center mt-8">
                            <div className="w-24 h-1 bg-gray-200 mx-auto mb-4 rounded-full"></div>
                            <p className="text-gray-400 text-xs">הופק באמצעות מערכת ניהול הזמנות • {hotel.name}</p>
                        </div>
                    </div>
                ) : (
                    /* תיקון כיתוב פוטר אמצעי */
                    <div className="mt-auto text-center pt-8">
                        <p className="text-gray-300 text-xs">המשך בעמוד הבא...</p>
                    </div>
                )}

           </div>
        ))}
      </div>

    </div>
  );
}