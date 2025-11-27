// client/src/pages/admin/ManageAnnouncementsPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/utils/api.js';
import { format } from 'date-fns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // ✨ ייבוא ה-CSS של העורך

// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from '@/components/ui/Label.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Megaphone, Trash2, Send, Users, User, Calendar, Edit, PlusCircle } from 'lucide-react';

// API Functions
const fetchAnnouncements = async () => (await api.get('/announcements/all')).data;
const createAnnouncement = (data) => api.post('/announcements', data);
const updateAnnouncement = ({ id, ...data }) => api.put(`/announcements/${id}`, data); // ✨ פונקציית העדכון
const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`);
const fetchUsers = async () => (await api.get('/admin/users')).data;

// --- הגדרות סרגל הכלים של העורך ---
const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }], // כותרות
    ['bold', 'italic', 'underline', 'strike'], // עיצוב בסיסי
    [{ 'color': [] }, { 'background': [] }], // ✨ צבעים ומרקרים
    [{ 'align': [] }], // ✨ יישור לימין/שמאל/מרכז
    [{ 'direction': 'rtl' }], // ✨ כיווניות (חשוב לעברית)
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['clean'] // ניקוי עיצוב
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'align', 'direction',
  'list', 'bullet'
];

export default function ManageAnnouncementsPage() {
  const queryClient = useQueryClient();

  // State לדיאלוג ולטופס
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // אם null -> יצירה חדשה, אחרת -> עריכה

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState('all');
  const [targetUser, setTargetUser] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // Queries
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['allAnnouncements'],
    queryFn: fetchAnnouncements
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: target === 'user'
  });

  // Mutations
  const commonMutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAnnouncements'] });
      handleCloseDialog();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה')
  };

  const createMutation = useMutation({
    ...commonMutationOptions,
    mutationFn: createAnnouncement,
    onSuccess: () => { 
        toast.success('ההודעה פורסמה בהצלחה!'); 
        commonMutationOptions.onSuccess(); 
    }
  });

  const updateMutation = useMutation({
    ...commonMutationOptions,
    mutationFn: updateAnnouncement,
    onSuccess: () => { 
        toast.success('ההודעה עודכנה בהצלחה!'); 
        commonMutationOptions.onSuccess(); 
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      toast.success('ההודעה נמחקה.');
      queryClient.invalidateQueries({ queryKey: ['allAnnouncements'] });
    },
    onError: (err) => toast.error('שגיאה במחיקת ההודעה')
  });

  // פונקציות עזר לניהול הטופס
  const handleOpenCreate = () => {
      setEditingId(null);
      setTitle('');
      setContent('');
      setTarget('all');
      setTargetUser('');
      setExpiresAt('');
      setIsDialogOpen(true);
  };

  const handleOpenEdit = (announcement) => {
      setEditingId(announcement._id);
      setTitle(announcement.title);
      setContent(announcement.content);
      setTarget(announcement.target);
      setTargetUser(announcement.targetUser?._id || '');
      setExpiresAt(announcement.expiresAt ? new Date(announcement.expiresAt).toISOString().split('T')[0] : '');
      setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
      setIsDialogOpen(false);
      setEditingId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !content) return toast.error('חובה להזין כותרת ותוכן.');
    if (target === 'user' && !targetUser) return toast.error('חובה לבחור משתמש.');

    const payload = {
      title,
      content,
      target,
      targetUser: target === 'user' ? targetUser : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    };

    if (editingId) {
        updateMutation.mutate({ id: editingId, ...payload });
    } else {
        createMutation.mutate(payload);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <header className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Megaphone className="text-primary" /> ניהול הודעות מערכת
            </h1>
            <p className="mt-2 text-gray-600">ניהול הודעות תפוצה, עריכה ומחיקה.</p>
        </div>
        <Button onClick={handleOpenCreate} size="lg" className="gap-2">
            <PlusCircle className="h-5 w-5"/> הודעה חדשה
        </Button>
      </header>

      {/* רשימת הודעות קיימות */}
      <Card>
        <CardHeader>
          <CardTitle>היסטוריית הודעות</CardTitle>
          <CardDescription>כל ההודעות הפעילות והישנות במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-gray-500">טוען הודעות...</p>
          ) : announcements.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                  <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">לא פורסמו הודעות עדיין.</p>
                  <Button variant="link" onClick={handleOpenCreate}>צור הודעה ראשונה</Button>
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {announcements.map(msg => (
                    <div key={msg._id} className="flex flex-col justify-between p-5 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all">
                        <div className="space-y-3">
                            <div className="flex items-start justify-between">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${msg.target === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {msg.target === 'all' ? 
                                        <span className="flex items-center gap-1"><Users size={12}/> לכולם</span> : 
                                        <span className="flex items-center gap-1"><User size={12}/> {msg.targetUser?.name || 'משתמש'}</span>
                                    }
                                </span>
                                {msg.expiresAt && new Date(msg.expiresAt) < new Date() && (
                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">פג תוקף</span>
                                )}
                            </div>

                            <h4 className="font-bold text-lg text-gray-900 line-clamp-1">{msg.title}</h4>
                            
                            {/* תצוגה מקדימה של התוכן (מנקה תגיות HTML) */}
                            <div 
                                className="text-gray-600 text-sm line-clamp-3 prose prose-sm"
                                dangerouslySetInnerHTML={{ __html: msg.content }}
                            />
                        </div>

                        <div className="mt-4 pt-4 border-t flex items-center justify-between">
                            <div className="text-xs text-gray-400">
                                {format(new Date(msg.createdAt), 'dd/MM/yyyy')}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(msg)} className="text-slate-500 hover:text-primary hover:bg-blue-50">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { if(window.confirm('למחוק את ההודעה?')) deleteMutation.mutate(msg._id) }} className="text-slate-500 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
              </div>
          )}
        </CardContent>
      </Card>

      {/* --- דיאלוג יצירה/עריכה --- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{editingId ? 'עריכת הודעה' : 'יצירת הודעה חדשה'}</DialogTitle>
                <DialogDescription>
                    ערוך את תוכן ההודעה באמצעות העורך המתקדם.
                </DialogDescription>
            </DialogHeader>

            <form id="announcementForm" onSubmit={handleSubmit} className="space-y-4 py-2">
                <div>
                    <Label>כותרת ההודעה</Label>
                    <Input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder='לדוגמה: עדכון חשוב לגבי חג הפסח'
                        required
                        className="font-semibold text-lg"
                    />
                </div>

                <div className="h-auto">
                    <Label className="mb-2 block">תוכן ההודעה</Label>
                    {/* ✨ העורך המתקדם ✨ */}
                    <div className="bg-white" dir="rtl">
                        <ReactQuill 
                            theme="snow"
                            value={content}
                            onChange={setContent}
                            modules={modules}
                            formats={formats}
                            className="h-64 mb-12" // mb-12 נותן מקום לסרגל התחתון של העורך
                            placeholder="הקלד כאן את תוכן ההודעה..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                        <Label>תפוצה</Label>
                        <Select value={target} onValueChange={setTarget}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">לכולם</SelectItem>
                                <SelectItem value="user">משתמש ספציפי</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>תוקף (אופציונלי)</Label>
                        <div className="relative">
                            <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                            <Input
                                type="date"
                                value={expiresAt}
                                onChange={e => setExpiresAt(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </div>

                {target === 'user' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label>בחר משתמש</Label>
                        <Select value={targetUser} onValueChange={setTargetUser}>
                            <SelectTrigger>
                                <SelectValue placeholder="חפש משתמש..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {users.map(u => (
                                    <SelectItem key={u._id} value={u._id}>{u.name} ({u.email})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </form>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>ביטול</Button>
                <Button type="submit" form="announcementForm" disabled={createMutation.isPending || updateMutation.isPending} className="gap-2">
                    <Send className="h-4 w-4" />
                    {editingId ? 'עדכן הודעה' : 'פרסם הודעה'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}