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
import { Users, Trash2, PlusCircle, Briefcase, Wrench, Shield } from 'lucide-react';

// API Functions
const fetchUsers = async () => (await api.get('/admin/users')).data;
const updateUser = (userData) => api.put(`/admin/users/${userData._id}`, userData);
const createUser = (userData) => api.post('/admin/users', userData);
const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);

// מילון תצוגה לתפקידים
const roleLabels = {
    admin: 'מנהל מערכת',
    sales: 'איש מכירות',
    maintenance: 'תחזוקה ונקיון'
};

export default function ManageUsersPage() {
    const queryClient = useQueryClient();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'sales', canManagePriceLists: false });

    const { data: users = [], isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

    const commonMutationOptions = {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
        onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה'),
    };

    const updateUserMutation = useMutation({ ...commonMutationOptions, mutationFn: updateUser });
    const createUserMutation = useMutation({
        ...commonMutationOptions,
        mutationFn: createUser,
        onSuccess: () => {
            commonMutationOptions.onSuccess();
            setIsCreateDialogOpen(false);
            setNewUserForm({ name: '', email: '', password: '', role: 'sales', canManagePriceLists: false });
            toast.success('משתמש נוצר בהצלחה!');
        },
    });
    const deleteUserMutation = useMutation({ ...commonMutationOptions, mutationFn: deleteUser });

    const handlePermissionChange = (user, canManagePriceLists) => {
        updateUserMutation.mutate({ ...user, canManagePriceLists });
    };

    const handleCreateUser = (e) => {
        e.preventDefault();
        createUserMutation.mutate(newUserForm);
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
                    <p className="mt-2 text-gray-600">צפייה, הרשאות ויצירת משתמשים חדשים.</p>
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
                                <th className="px-4 py-3 text-right font-medium">ניהול מחירונים</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {isLoading && <tr><td colSpan="5" className="p-8 text-center">טוען משתמשים...</td></tr>}
                            {isError && <tr><td colSpan="5" className="p-8 text-center text-red-600">שגיאה בטעינת משתמשים</td></tr>}
                            
                            {users.map(user => (
                                <tr key={user._id} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3 font-medium">{user.name}</td>
                                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                                            ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                                              user.role === 'maintenance' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {user.role === 'admin' && <Shield size={12}/>}
                                            {user.role === 'maintenance' && <Wrench size={12}/>}
                                            {user.role === 'sales' && <Briefcase size={12}/>}
                                            {roleLabels[user.role] || user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Switch
                                            checked={user.canManagePriceLists}
                                            onCheckedChange={(checked) => handlePermissionChange(user, checked)}
                                            disabled={updateUserMutation.isPending || user.role === 'admin'}
                                            aria-label="ניהול מחירונים"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-left">
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

                        {/* הרשאת מחירונים רלוונטית רק לאנשי מכירות */}
                        {newUserForm.role !== 'admin' && newUserForm.role !== 'maintenance' && (
                            <div className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-3 rounded border">
                                <Switch id="canManage" checked={newUserForm.canManagePriceLists} onCheckedChange={(c) => setNewUserForm(p => ({...p, canManagePriceLists: c}))} />
                                <Label htmlFor="canManage">הרשאה לניהול מחירונים</Label>
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
        </div>
    );
}