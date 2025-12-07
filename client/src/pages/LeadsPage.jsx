import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore.js';

// UI Components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog.jsx";
import { Button } from '@/components/ui/Button.jsx';
import { Input } from "@/components/ui/Input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
// ✨ הוספנו את ArrowUp לאייקונים
import { LoaderCircle, Trash2, Phone, User, ArrowUp } from 'lucide-react';

// צבעים
const GOLD_COLOR = '#bfa15f';
const BLUE_COLOR = '#3b82f6'; // כחול בולט ללידים חדשים

// --- API Functions ---
const fetchLeads = async () => {
  const { data } = await api.get('/leads');
  return data;
};

const updateLeadStatusApi = async ({ leadId, status, rejectionReason }) => {
  const { data } = await api.patch(`/leads/${leadId}/status`, { status, rejectionReason });
  return data;
};

const deleteLeadApi = async (leadId) => {
    await api.delete(`/leads/${leadId}`);
};

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [selectedLead, setSelectedLead] = useState(null);
  const [noteToView, setNoteToView] = useState(null);
  const [rejectionDialogLeadId, setRejectionDialogLeadId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // ✨ State למיון
  const [showNewFirst, setShowNewFirst] = useState(false);

  const { data: leads, isLoading, isError, error } = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
    refetchInterval: 15000
  });

  const updateStatusMutation = useMutation({
    mutationFn: updateLeadStatusApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('סטטוס עודכן');
      setRejectionDialogLeadId(null);
      setRejectionReason('');
    },
    onError: () => toast.error('שגיאה בעדכון'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLeadApi,
    onSuccess: () => {
        toast.success('נמחק בהצלחה');
        queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: () => toast.error('שגיאה במחיקה'),
  });

  const handleStatusChange = (leadId, newStatus) => {
      if (newStatus === 'not_relevant') {
          setRejectionDialogLeadId(leadId);
      } else {
          updateStatusMutation.mutate({ leadId, status: newStatus });
      }
  };

  const submitRejection = () => {
      if (!rejectionReason.trim()) return toast.error('חובה לכתוב סיבה');
      updateStatusMutation.mutate({
          leadId: rejectionDialogLeadId,
          status: 'not_relevant',
          rejectionReason
      });
  };

  const handleDelete = (leadId) => {
    if (window.confirm("למחוק את הפנייה?")) {
        deleteMutation.mutate(leadId);
    }
  };

  // ✨ לוגיקת המיון הדינמית
  const displayedLeads = useMemo(() => {
      if (!leads) return [];
      if (!showNewFirst) return leads;

      return [...leads].sort((a, b) => {
          const isANew = a.status === 'new';
          const isBNew = b.status === 'new';
          if (isANew && !isBNew) return -1;
          if (!isANew && isBNew) return 1;
          return 0;
      });
  }, [leads, showNewFirst]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* ✨ Header מעודכן עם הכפתור, שומר על העיצוב הקיים */}
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">ניהול פניות</h1>
        
        <Button 
            variant="outline"
            onClick={() => setShowNewFirst(!showNewFirst)}
            className={`gap-2 transition-colors ${showNewFirst ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
        >
            <ArrowUp size={16} className={showNewFirst ? "text-blue-700" : "text-gray-500"}/>
            {showNewFirst ? 'מציג: חדשים תחילה' : 'הקפץ לא נענו'}
        </Button>
      </header>

      <div>
        {isLoading && <div className="text-center py-20"><LoaderCircle className="animate-spin h-10 w-10 mx-auto text-gray-400"/></div>}
        {isError && <div className="text-center text-red-500 py-10">{error.message}</div>}

        {!isLoading && leads && (
            <div className="space-y-2" dir="rtl">
                {displayedLeads.map(lead => (
                  <LeadStrip
                    key={lead._id}
                    lead={lead}
                    onStatusChange={handleStatusChange}
                    onViewRaw={() => setSelectedLead(lead)}
                    onViewNote={() => setNoteToView(lead)}
                    onDelete={user?.role === 'admin' ? handleDelete : undefined}
                  />
                ))}
                {leads.length === 0 && (
                    <p className="text-center text-gray-500 py-10 border-dashed border rounded bg-gray-50">אין פניות חדשות.</p>
                )}
            </div>
        )}
      </div>

      {/* דיאלוגים (ללא שינוי) */}
      <Dialog open={!!rejectionDialogLeadId} onOpenChange={(o) => !o && setRejectionDialogLeadId(null)}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>סיבת ביטול</DialogTitle>
                  <DialogDescription>מדוע הפנייה לא רלוונטית?</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3">
                  <Input
                    placeholder="הקלד סיבה..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2">
                      {['יקר מדי', 'תאריך תפוס', 'לא עונה', 'רצה משהו אחר'].map(r => (
                          <span
                            key={r}
                            className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-xs border"
                            onClick={() => setRejectionReason(r)}
                          >
                              {r}
                          </span>
                      ))}
                  </div>
              </div>

              <DialogFooter>
                  <Button variant="outline" onClick={() => setRejectionDialogLeadId(null)}>ביטול</Button>
                  <Button onClick={submitRejection} className="bg-red-600 hover:bg-red-700 text-white">אישור</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLead} onOpenChange={(o) => !o && setSelectedLead(null)}>
          <DialogContent className="max-w-xl max-h-[80vh] overflow-auto"><pre className="text-xs whitespace-pre-wrap" dir="ltr">{selectedLead?.body}</pre></DialogContent>
      </Dialog>

      <Dialog open={!!noteToView} onOpenChange={(o) => !o && setNoteToView(null)}>
        <DialogContent>
            <DialogHeader><DialogTitle>פרטים מלאים</DialogTitle></DialogHeader>
            <div className="py-4 text-right whitespace-pre-wrap">
                <p className="font-bold mb-2 text-lg">{noteToView?.hotel}</p>
                <p className="text-gray-700">{noteToView?.parsedNote}</p>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- הרכיב המעוצב (זהה לחלוטין למקור) ---
const LeadStrip = ({ lead, onStatusChange, onViewRaw, onViewNote, onDelete }) => {

  const isNew = lead.status === 'new';

  // הגדרת צבעים לפי סטטוס
  const statusStyles = {
      'new': 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 font-bold',
      'in_progress': 'bg-amber-50 border-amber-200 text-amber-700',
      'closed': 'bg-green-50 border-green-200 text-green-700 font-bold',
      'not_relevant': 'bg-gray-100 border-gray-200 text-gray-400 decoration-slice'
  };

  // קביעת צבע הפס הצידי: כחול לחדשים, זהב לכל השאר
  const sideBorderColor = isNew ? BLUE_COLOR : GOLD_COLOR;

  // רקע שורה: כחלחל עדין מאוד לחדשים, לבן לאחרים
  const rowBackground = isNew ? 'bg-blue-50/30' : 'bg-white';

  const handlePhoneClick = () => {
      if (lead.status === 'new') {
          onStatusChange(lead._id, 'in_progress');
      }
  };

  return (
    <div
        className={`
            flex flex-col md:flex-row items-center gap-4 p-3 border-b border-gray-100 hover:bg-gray-50/80 transition-all group
            ${rowBackground}
        `}
        style={{ borderRight: `4px solid ${sideBorderColor}` }}
    >
        {/* 1. אזור שם ותאריך */}
        <div className="w-full md:w-[180px] flex flex-col justify-center min-w-[180px]">
            <div
                className={`font-bold text-sm md:text-base truncate cursor-pointer hover:text-blue-600 flex items-center gap-2 ${isNew ? 'text-black' : 'text-gray-700'}`}
                onClick={onViewRaw}
                title={lead.parsedName}
            >
                <User size={14} className="text-gray-400 shrink-0" />
                {lead.parsedName || 'ללא שם'}
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-1 pr-6">
                {format(new Date(lead.receivedAt), 'dd/MM HH:mm')}
            </div>
        </div>

        {/* 2. טלפון */}
        <div className="w-full md:w-[130px] flex items-center min-w-[130px]">
            {lead.parsedPhone ? (
                <a
                    href={`https://wa.me/${lead.parsedPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-sm font-medium hover:text-blue-600 transition-colors flex items-center gap-2 ${isNew ? 'text-blue-700' : 'text-gray-600'}`}
                    onClick={handlePhoneClick}
                    dir="ltr"
                >
                    <Phone size={14} className={isNew ? "text-blue-400" : "text-gray-300"} />
                    {lead.parsedPhone}
                </a>
            ) : (
                <span className="text-gray-300 text-xs">-</span>
            )}
        </div>

        {/* 3. מלון והערה */}
        <div
            className="w-full md:flex-1 flex flex-col justify-center min-w-0 cursor-pointer pr-4 border-r md:border-r-0 border-gray-100"
            onClick={onViewNote}
        >
            <div className="flex items-center gap-2 mb-1">
                {lead.hotel && (
                    <span className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-1.5 rounded shadow-sm">
                        {lead.hotel}
                    </span>
                )}
            </div>
            <span className="text-sm text-gray-600 truncate" title={lead.parsedNote}>
                {lead.parsedNote || <span className="text-gray-300 text-xs">אין הערות</span>}
            </span>
        </div>

        {/* 4. סטטוס ומחיקה */}
        <div className="w-full md:w-[200px] flex items-center gap-3 justify-between md:justify-end min-w-[200px]">

            <div className="flex-grow md:flex-grow-0 w-full md:w-[160px]">
                <Select
                    value={lead.status}
                    onValueChange={(val) => onStatusChange(lead._id, val)}
                >
                    <SelectTrigger className={`h-8 text-xs shadow-sm ${statusStyles[lead.status] || 'bg-white border-gray-200'}`}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="new">לא נענה</SelectItem>
                        <SelectItem value="in_progress">בטיפול</SelectItem>
                        <SelectItem value="closed">נסגר בהצלחה</SelectItem>
                        <SelectItem value="not_relevant">לא רלוונטי</SelectItem>
                    </SelectContent>
                </Select>

                {lead.rejectionReason && lead.status === 'not_relevant' && (
                    <p className="text-[10px] text-gray-400 truncate mt-1 text-center md:text-right w-full">
                        {lead.rejectionReason}
                    </p>
                )}
            </div>

            {onDelete && (
                <button
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    onClick={(e) => { e.stopPropagation(); onDelete(lead._id); }}
                    title="מחק פנייה"
                >
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    </div>
  );
};