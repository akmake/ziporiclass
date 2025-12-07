import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';
// UI Components
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/Dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Badge } from '@/components/ui/Badge.jsx';
import { Users, Trash2, PlusCircle, Edit, X, Clock } from 'lucide-react';

// API Functions
const fetchUsers = async () => (await api.get('/admin/users')).data;
const updateUser = (userData) => api.put(`/admin/users/${userData._id}`, userData);
const createUser = (userData) => api.post('/admin/users', userData);
const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);
const fetchReportNames = async () => (await api.get('/admin/commissions/names')).data;

const roleLabels = {
    admin: 'מנהל מערכת',
    sales: 'איש מכירות',
    maintenance: 'תחזוקה ונקיון'
};

export default function ManageUsersPage() {
    const queryClient = useQueryClient();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const { data: availableReportNames = [] } = useQuery({
        queryKey: ['commissionNames'],
        queryFn: fetchReportNames,
        staleTime: 1000 * 60 * 5 
    });

    // ✨ הוספנו את forcedLogoutTime לסטייט
    const [newUserForm, setNewUserForm] = useState({
        name: '', email: '', password: '', role: 'sales',
        canManagePriceLists: false, canViewCommissions: false,
        reportNames: [], forcedLogoutTime: '' 
    });

    const [editingUser, setEditingUser] = useState(null);

    const { data: users = [], isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

    const commonMutationOptions = {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
        onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה'),
    };

    const updateUserMutation = useMutation({
        mutationFn: updateUser,
        onSuccess: () => {
            toast.success('פרטי המשתמש עודכנו!');
            setIsEditDialogOpen(false);
            setEditingUser(null);
            commonMutationOptions.onSuccess();
        },
        onError: commonMutationOptions.onError
    });

    const createUserMutation = useMutation({
        ...commonMutationOptions,
        mutationFn: createUser,
        onSuccess: () => {
            commonMutationOptions.onSuccess();
            setIsCreateDialogOpen(false);
            // ✨ איפוס הטופס כולל השדה החדש
            setNewUserForm({ name: '', email: '', password: '', role: 'sales', canManagePriceLists: false, canViewCommissions: false, reportNames: [], forcedLogoutTime: '' });
            toast.success('משתמש נוצר בהצלחה!');
        },
    });

    const deleteUserMutation = useMutation({ ...commonMutationOptions, mutationFn: deleteUser });

    const handlePermissionChange = (user, field, value) => {
        updateUserMutation.mutate({ ...user, [field]: value });
    };

    const addReportNameCreate = (name) => {
        if (!newUserForm.reportNames.includes(name)) {
            setNewUserForm(prev => ({ ...prev, reportNames: [...prev.reportNames, name] }));
        }
    };
    const removeReportNameCreate = (name) => {
        setNewUserForm(prev => ({ ...prev, reportNames: prev.reportNames.filter(n => n !== name) }));
    };

    const addReportNameEdit = (name) => {
        if (!editingUser.reportNames.includes(name)) {
            setEditingUser(prev => ({ ...prev, reportNames: [...prev.reportNames, name] }));
        }
    };
    const removeReportNameEdit = (name) => {
        setEditingUser(prev => ({ ...prev, reportNames: prev.reportNames.filter(n => n !== name) }));
    };

    const handleCreateUser = (e) => {
        e.preventDefault();
        createUserMutation.mutate(newUserForm);
    };

    const handleEditUserSubmit = (e) => {
        e.preventDefault();
        if (!editingUser) return;

        updateUserMutation.mutate({
            _id: editingUser._id,
            role: editingUser.role,
            canManagePriceLists: editingUser.canManagePriceLists,
            canViewCommissions: editingUser.canViewCommissions,
            reportNames: editingUser.reportNames,
            forcedLogoutTime: editingUser.forcedLogoutTime // ✨ שליחת השעה לעדכון
        });
    };

    const openEditDialog = (user) => {
        setEditingUser({
            ...user,
            reportNames: user.reportNames || [],
            forcedLogoutTime: user.forcedLogoutTime || '' // ✨ טעינת השעה הקיימת
        });
        setIsEditDialogOpen(true);
    };

    const handleDeleteUser = (userId) => {
        if (window.confirm('האם אתה בטוח שברצונך למחוק את המשתמש?')) {
            deleteUserMutation.mutate(userId);
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Users /> ניהול משתמשים</h1>
                    <p className="mt-2 text-gray-600">צפייה, הרשאות, שעות פעילות והגדרת שמות לדוחות.</p>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)}><PlusCircle className="ml-2" /> צור משתמש חדש</Button>
            </header>

            <main className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-right font-medium">שם</th>
                                <th className="px-4 py-3 text-right font-medium">אימייל</th>
                                <th className="px-4 py-3 text-right font-medium">תפקיד</th>
                                <th className="px-4 py-3 text-right font-medium">שעת ניתוק</th> {/* ✨ עמודה חדשה */}
                                <th className="px-4 py-3 text-right font-medium">שמות מקושרים</th>
                                <th className="px-4 py-3 text-right font-medium">ניהול מחירונים</th>
                                <th className="px-4 py-3 text-right font-medium">עמלות</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {isLoading && <tr><td colSpan="8" className="p-8 text-center">טוען משתמשים...</td></tr>}
                            {isError && <tr><td colSpan="8" className="p-8 text-center text-red-600">שגיאה בטעינת משתמשים</td></tr>}

                            {users.map(user => (
                                <tr key={user._id} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3 font-medium">{user.name}</td>
                                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                                            ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                            user.role === 'maintenance' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {roleLabels[user.role] || user.role}
                                        </span>
                                    </td>

                                    {/* ✨ הצגת שעת ניתוק */}
                                    <td className="px-4 py-3 font-mono text-gray-600">
                                        {user.forcedLogoutTime ? (
                                            <span className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs">
                                                <Clock size={12}/> {user.forcedLogoutTime}
                                            </span>
                                        ) : '-'}
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {user.reportNames && user.reportNames.length > 0 ? (
                                                user.reportNames.map(name => (
                                                    <Badge key={name} variant="outline" className="text-xs bg-slate-50 font-normal">
                                                        {name}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-slate-400 text-xs">-</span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-4 py-3">
                                        <Switch
                                            checked={user.canManagePriceLists}
                                            onCheckedChange={(checked) => handlePermissionChange(user, 'canManagePriceLists', checked)}
                                            disabled={updateUserMutation.isPending || user.role === 'admin'}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <Switch
                                            checked={user.canViewCommissions}
                                            onCheckedChange={(checked) => handlePermissionChange(user, 'canViewCommissions', checked)}
                                            disabled={updateUserMutation.isPending || user.role === 'admin'}
                                        />
                                    </td>

                                    <td className="px-4 py-3 text-left flex gap-2 justify-end">
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                                            <Edit className="h-4 w-4 text-slate-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user._id)} disabled={user.role === 'admin'}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Create User Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>יצירת משתמש חדש</DialogTitle></DialogHeader>
                    <form id="createUserForm" onSubmit={handleCreateUser} className="space-y-4 pt-4">
                        <Input name="name" placeholder="שם מלא" value={newUserForm.name} onChange={(e) => setNewUserForm(p => ({...p, name: e.target.value}))} required />
                        <Input name="email" type="email" placeholder="אימייל" value={newUserForm.email} onChange={(e) => setNewUserForm(p => ({...p, email: e.target.value}))} required />
                        <Input name="password" type="password" placeholder="סיסמה" value={newUserForm.password} onChange={(e) => setNewUserForm(p => ({...p, password: e.target.value}))} required />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="mb-2 block">תפקיד במערכת</Label>
                                <Select value={newUserForm.role} onValueChange={(v) => setNewUserForm(p => ({...p, role: v}))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sales">איש מכירות (רגיל)</SelectItem>
                                        <SelectItem value="maintenance">עובד תחזוקה/נקיון</SelectItem>
                                        <SelectItem value="admin">מנהל מערכת (Admin)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {/* ✨ שדה שעת ניתוק חדש */}
                            <div>
                                <Label className="mb-2 block">שעת ניתוק אוטומטי</Label>
                                <Input 
                                    type="time" 
                                    value={newUserForm.forcedLogoutTime} 
                                    onChange={(e) => setNewUserForm(p => ({...p, forcedLogoutTime: e.target.value}))}
                                    className="ltr-input" // אם יש לך מחלקה ליישור משמאל
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded border space-y-2">
                            <Label className="block">שיוך שמות מדוחות עמלות</Label>
                            <Select onValueChange={addReportNameCreate}>
                                <SelectTrigger className="bg-white border-slate-300">
                                    <SelectValue placeholder="בחר שם מהרשימה..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {availableReportNames.length > 0 ? (
                                        availableReportNames.map(name => (
                                            <SelectItem key={name} value={name}>{name}</SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="none" disabled>אין שמות זמינים בדוחות</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>

                            <div className="flex flex-wrap gap-2 mt-2 min-h-[30px]">
                                {newUserForm.reportNames.map(name => (
                                    <Badge key={name} className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 flex items-center gap-1 pl-1 pr-2 cursor-default">
                                        <X size={14} className="cursor-pointer hover:text-red-600 mr-1" onClick={() => removeReportNameCreate(name)}/>
                                        {name}
                                    </Badge>
                                ))}
                                {newUserForm.reportNames.length === 0 && <span className="text-xs text-gray-400">לא נבחרו שמות</span>}
                            </div>
                        </div>

                        {newUserForm.role !== 'admin' && newUserForm.role !== 'maintenance' && (
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-3 rounded border">
                                    <Switch id="canManage" checked={newUserForm.canManagePriceLists} onCheckedChange={(c) => setNewUserForm(p => ({...p, canManagePriceLists: c}))} />
                                    <Label htmlFor="canManage">הרשאה לניהול מחירונים</Label>
                                </div>
                                <div className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-3 rounded border">
                                    <Switch id="canViewComm" checked={newUserForm.canViewCommissions} onCheckedChange={(c) => setNewUserForm(p => ({...p, canViewCommissions: c}))} />
                                    <Label htmlFor="canViewComm">הרשאה לצפייה בעמלות</Label>
                                </div>
                            </div>
                        )}
                    </form>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose>
                        <Button type="submit" form="createUserForm" disabled={createUserMutation.isPending}>
                            {createUserMutation.isPending ? 'יוצר...' : 'שמור משתמש'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>עריכת משתמש - {editingUser?.name}</DialogTitle></DialogHeader>
                    {editingUser && (
                        <form id="editUserForm" onSubmit={handleEditUserSubmit} className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="mb-2 block">תפקיד</Label>
                                    <Select value={editingUser.role} onValueChange={(v) => setEditingUser(p => ({...p, role: v}))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sales">איש מכירות</SelectItem>
                                            <SelectItem value="maintenance">תחזוקה</SelectItem>
                                            <SelectItem value="admin">מנהל</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* ✨ שדה שעת ניתוק בעריכה */}
                                <div>
                                    <Label className="mb-2 block">שעת ניתוק אוטומטי</Label>
                                    <Input 
                                        type="time" 
                                        value={editingUser.forcedLogoutTime || ''} 
                                        onChange={(e) => setEditingUser(p => ({...p, forcedLogoutTime: e.target.value}))}
                                        className="ltr-input"
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded border space-y-2">
                                <Label className="block">שיוך שמות מדוחות עמלות</Label>
                                <Select onValueChange={addReportNameEdit}>
                                    <SelectTrigger className="bg-white border-slate-300">
                                        <SelectValue placeholder="בחר שם מהרשימה..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        {availableReportNames.length > 0 ? (
                                            availableReportNames.map(name => (
                                                <SelectItem key={name} value={name}>{name}</SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="none" disabled>אין שמות זמינים בדוחות</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>

                                <div className="flex flex-wrap gap-2 mt-2 min-h-[30px]">
                                    {(editingUser.reportNames || []).map(name => (
                                        <Badge key={name} className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 flex items-center gap-1 pl-1 pr-2 cursor-default">
                                            <X size={14} className="cursor-pointer hover:text-red-600 mr-1" onClick={() => removeReportNameEdit(name)}/>
                                            {name}
                                        </Badge>
                                    ))}
                                    {(!editingUser.reportNames || editingUser.reportNames.length === 0) && <span className="text-xs text-gray-400">לא שויכו שמות</span>}
                                </div>
                            </div>

                            {editingUser.role !== 'admin' && (
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-3 rounded border">
                                        <Switch checked={editingUser.canManagePriceLists} onCheckedChange={(c) => setEditingUser(p => ({...p, canManagePriceLists: c}))} />
                                        <Label>ניהול מחירונים</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-3 rounded border">
                                        <Switch checked={editingUser.canViewCommissions} onCheckedChange={(c) => setEditingUser(p => ({...p, canViewCommissions: c}))} />
                                        <Label>צפייה בעמלות</Label>
                                    </div>
                                </div>
                            )}
                        </form>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>ביטול</Button>
                        <Button type="submit" form="editUserForm" disabled={updateUserMutation.isPending}>
                            {updateUserMutation.isPending ? 'מעדכן...' : 'שמור שינויים'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}