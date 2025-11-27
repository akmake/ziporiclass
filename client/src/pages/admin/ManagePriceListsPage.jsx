// client/src/pages/admin/ManagePriceListsPage.jsx

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/utils/api.js';
import { Button } from '@/components/ui/Button.jsx';
import { PlusCircle, Trash2, Edit, Lock, Eye, EyeOff, ArrowUpDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Switch } from '@/components/ui/Switch'; // ✨ ייבוא ה-Switch

// --- API Functions ---
const fetchPriceLists = async () => (await api.get('/pricelists')).data;
const fetchHotels = async () => (await api.get('/admin/hotels')).data;
const createPriceList = (data) => api.post('/pricelists', data);
const updatePriceList = ({ id, ...data }) => api.put(`/pricelists/${id}`, data);
const deletePriceList = (id) => api.delete(`/pricelists/${id}`);

// --- Helper Component for Form Fields ---
const InputGroup = ({ label, children, icon }) => (
  <div className="relative">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
       {children}
    </div>
  </div>
);

// --- Main Page Component ---
export default function ManagePriceListsPage() {
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: priceLists = [], isLoading: isLoadingPriceLists } = useQuery({
    queryKey: ['priceLists'],
    queryFn: fetchPriceLists,
  });

  const { data: hotels = [], isLoading: isLoadingHotels } = useQuery({
    queryKey: ['hotels'],
    queryFn: fetchHotels,
  });

  const commonMutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceLists'] });
      handleClearForm();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'אירעה שגיאה'),
  };

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: createPriceList,
    onSuccess: () => { toast.success('מחירון נוצר בהצלחה!'); commonMutationOptions.onSuccess(); },
    onError: commonMutationOptions.onError,
  });

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: updatePriceList,
    onSuccess: () => { toast.success('מחירון עודכן בהצלחה!'); commonMutationOptions.onSuccess(); },
    onError: commonMutationOptions.onError,
  });

  const { mutate: remove } = useMutation({
    mutationFn: deletePriceList,
    onSuccess: () => { toast.success('המחירון נמחק!'); commonMutationOptions.onSuccess(); },
    onError: commonMutationOptions.onError,
  });

  const handleClearForm = () => {
    // ✨ איפוס כולל שדות חדשים
    setFormData({ 
        name: '', hotel: '', 
        couple: 0, teen: 0, child: 0, baby: 0, single_room: 0, 
        maxNights: 0, 
        displayOrder: 0, isVisible: true 
    });
    setEditingId(null);
  };

  const handleSelectForEdit = (priceList) => {
    setEditingId(priceList._id);
    // Ensure hotel ID is used for form state
    const formData = { 
        ...priceList, 
        hotel: priceList.hotel._id,
        // מבטיח ערכי ברירת מחדל אם הם חסרים בדאטהבייס ישן
        displayOrder: priceList.displayOrder || 0,
        isVisible: priceList.isVisible !== undefined ? priceList.isVisible : true
    };
    setFormData(formData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.hotel) {
        toast.error('חובה לבחור מלון.');
        return;
    }
    const dataToSave = { ...formData };
    
    // ניקוי שדות מספריים
    ['couple', 'teen', 'child', 'baby', 'single_room', 'maxNights', 'displayOrder'].forEach(field => {
        if (dataToSave[field] === '' || dataToSave[field] === undefined) {
            dataToSave[field] = 0;
        }
    });

    if (editingId) {
      update({ id: editingId, ...dataToSave });
    } else {
      create(dataToSave);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value) => {
      setFormData(prev => ({ ...prev, hotel: value }));
  };

  if (isLoadingPriceLists || isLoadingHotels) return <div className="text-center p-10">טוען נתונים...</div>;

  return (
    <div className="container mx-auto p-4 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">ניהול מחירונים</h1>
        <p className="mt-1 text-gray-600">הוסף, ערוך ומחק את המחירונים הזמינים למערכת ההזמנות.</p>
      </header>

      {/* --- Form Section --- */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">{editingId ? 'עריכת מחירון' : 'יצירת מחירון חדש'}</h2>
            {editingId && <Button type="button" variant="outline" onClick={handleClearForm}>צור חדש</Button>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup label="שם המחירון (למשל: סופש, חגים)">
                <input name="name" value={formData.name || ''} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md" />
            </InputGroup>
            <InputGroup label="שיוך למלון">
                <Select value={formData.hotel || ''} onValueChange={handleSelectChange}>
                    <SelectTrigger><SelectValue placeholder="בחר מלון..." /></SelectTrigger>
                    <SelectContent>
                        {hotels.map(hotel => <SelectItem key={hotel._id} value={hotel._id}>{hotel.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </InputGroup>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <InputGroup label="מחיר לזוג">
              <input type="number" name="couple" value={formData.couple || 0} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
            </InputGroup>
            <InputGroup label="מחיר ליחיד">
              <input type="number" name="single_room" value={formData.single_room || 0} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
            </InputGroup>
            <InputGroup label="מחיר לנער">
              <input type="number" name="teen" value={formData.teen || 0} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
            </InputGroup>
            <InputGroup label="מחיר לילד">
              <input type="number" name="child" value={formData.child || 0} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
            </InputGroup>
            <InputGroup label="מחיר לתינוק">
              <input type="number" name="baby" value={formData.baby || 0} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
            </InputGroup>

            {/* ✨ שדה הגבלת לילות */}
            <InputGroup label="הגבלת לילות (0=ללא)" icon={<Lock className="h-4 w-4"/>}>
                <input
                    type="number"
                    name="maxNights"
                    value={formData.maxNights || 0}
                    onChange={handleChange}
                    className="w-full p-2 pl-10 border border-amber-200 bg-amber-50 rounded-md focus:border-amber-500"
                />
            </InputGroup>

            {/* ✨ שדה סדר תצוגה */}
            <InputGroup label="סדר תצוגה (עדיפות)" icon={<ArrowUpDown className="h-4 w-4"/>}>
                <input
                    type="number"
                    name="displayOrder"
                    value={formData.displayOrder || 0}
                    onChange={handleChange}
                    className="w-full p-2 pl-10 border border-blue-200 bg-blue-50 rounded-md focus:border-blue-500"
                    title="מספר נמוך יותר יופיע ראשון ברשימה"
                />
            </InputGroup>
          </div>

          {/* ✨ מתג נראות */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-md border">
              <Switch 
                  checked={formData.isVisible ?? true} 
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isVisible: checked }))}
              />
              <label className="text-sm font-medium text-gray-700 cursor-pointer select-none">הצג מחירון זה למוכר בעת יצירת הזמנה</label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isCreating || isUpdating}>
              <PlusCircle className="ml-2 h-4 w-4" />
              {editingId ? 'שמור שינויים' : 'הוסף מחירון'}
            </Button>
          </div>
        </form>
      </section>


      {/* --- Price Lists Table Section --- */}
      <section className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right font-medium text-gray-600">שם</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">מלון</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">מחירים (זוג/יחיד)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">סדר</th> {/* ✨ */}
                <th className="px-4 py-3 text-right font-medium text-gray-600">סטטוס</th> {/* ✨ */}
                <th className="px-4 py-3 text-right font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {priceLists.map((pl) => (
                <tr key={pl._id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                      {pl.name}
                      {/* אינדיקציה למגבלת לילות */}
                      {pl.maxNights > 0 && (
                          <span className="mr-2 inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                              <Lock size={8} /> {pl.maxNights} לילות
                          </span>
                      )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{pl.hotel?.name || 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-600">{pl.couple}₪ / {pl.single_room}₪</td>
                  
                  {/* ✨ הצגת סדר */}
                  <td className="px-4 py-3 font-mono text-gray-500">{pl.displayOrder}</td>

                  {/* ✨ הצגת נראות */}
                  <td className="px-4 py-3">
                      {pl.isVisible ? 
                        <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><Eye size={14}/> גלוי</span> : 
                        <span className="flex items-center gap-1 text-gray-400 text-xs"><EyeOff size={14}/> מוסתר</span>
                      }
                  </td>

                  <td className="px-4 py-3 space-x-2 space-x-reverse">
                    <Button variant="outline" size="sm" onClick={() => handleSelectForEdit(pl)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => {if(window.confirm(`האם למחוק את המחירון "${pl.name}"?`)) remove(pl._id)}}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}