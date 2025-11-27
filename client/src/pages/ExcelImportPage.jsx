import React, { useState, useEffect, useRef } from 'react';
import api from '@/utils/api.js';
import * as XLSX from 'xlsx';

// --- ייבוא רכיבי UI מהספרייה שלך ---
import { Button } from "@/components/ui/Button.jsx";import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { UploadCloud, FileText, Settings, CheckCircle, AlertTriangle } from 'lucide-react';

// --- הגדרות קבועות ---
const CREATE_NEW_CATEGORY_VALUE = "CREATE_NEW";

// --- פונקציות עזר לעיבוד אקסל ---
function cleanFile(data, type) {
  if (type === 'cal') {
    if (data.length < 5) throw new Error("הקובץ נראה קצר מדי עבור פורמט 'כאל'.");
    const trimmed = data.slice(1, -3);
    return trimmed.map(row => ({
      "תאריך עסקה": row[0],
      "שם בית העסק": String(row[1] || '').trim(),
      "סכום": row[2],
    }));
  }
  if (type === 'max') {
    if (data.length < 7) throw new Error("הקובץ נראה קצר מדי עבור פורמט 'מקס'.");
    const trimmed = data.slice(3, -3);
    if (trimmed.length < 1) throw new Error("לא נמצאו נתונים בקובץ לאחר הניקוי.");
    const headers = trimmed[0].map(h => String(h || '').trim().replace(/\s+/g, ' '));
    const rows = trimmed.slice(1);
    
    if (!headers.includes('שם בית העסק') || !headers.includes('תאריך עסקה') || !headers.includes('סכום עסקה מקורי')) {
        throw new Error('העמודות הנדרשות לא נמצאו בקובץ "מקס".');
    }

    return rows.map(rowArray => {
      let rowObject = {};
      headers.forEach((header, index) => { rowObject[header] = rowArray[index]; });
      return rowObject;
    });
  }
  throw new Error('סוג ייבוא לא ידוע.');
}

// --- רכיב הדף הראשי ---
export default function ExcelImportPage() {
  const [stage, setStage] = useState('select');
  const [importerType, setImporterType] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [unseenMerchants, setUnseenMerchants] = useState([]);
  const [mappings, setMappings] = useState({});
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState('');
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentMerchantForNewCategory, setCurrentMerchantForNewCategory] = useState(null);
  const fileInputRef = useRef(null);

  const fetchCategories = () => {
    return api.get('/categories')
      .then(res => setCategories(res.data))
      .catch(err => console.error("Could not fetch categories", err));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleImportButtonClick = (type) => {
    setImporterType(type);
    fileInputRef.current.click();
  };

  const handleFileSelected = (event) => {
    const file = event.target.files[0];
    if (file) {
      analyzeFile(file, importerType);
    }
    event.target.value = null;
  };

  const analyzeFile = (file, type) => {
    setStage('processing');
    setMessage('קורא ומנתח את קובץ האקסל...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const cleanedData = cleanFile(rawData, type);
        setParsedData(cleanedData);
        const merchantNames = [...new Set(cleanedData.map(row => row['שם בית העסק']).filter(Boolean))];
        const { data: response } = await api.post('/import/check-merchants', { merchantNames });
        if (response.unseenMerchants && response.unseenMerchants.length > 0) {
          setUnseenMerchants(response.unseenMerchants);
          const initialMappings = {};
          response.unseenMerchants.forEach(name => {
            initialMappings[name] = { newName: name, category: '' };
          });
          setMappings(initialMappings);
          setStage('map');
        } else {
          processData([], cleanedData);
        }
      } catch (error) {
        setMessage(error.message || 'שגיאה בקריאת הקובץ.');
        setStage('result');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingChange = (originalName, field, value) => {
    if (field === 'category' && value === CREATE_NEW_CATEGORY_VALUE) {
        setCurrentMerchantForNewCategory(originalName);
        setIsCategoryDialogOpen(true);
    } else {
        setMappings(prev => ({ ...prev, [originalName]: { ...prev[originalName], [field]: value } }));
    }
  };
  
  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const { data: newCategory } = await api.post('/categories', { name: newCategoryName.trim(), type: 'הוצאה' });
      // Real-time update
      setCategories(prev => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
      if (currentMerchantForNewCategory) {
          handleMappingChange(currentMerchantForNewCategory, 'category', newCategory._id);
      }
      setIsCategoryDialogOpen(false);
      setNewCategoryName('');
      setCurrentMerchantForNewCategory(null);
    } catch (err) {
      alert(`שגיאה ביצירת קטגוריה: ${err.response?.data?.message || err.message}`);
    }
  };

  const processData = async (mappingsToSave, dataToProcess) => {
    setStage('processing');
    setMessage('מעבד עסקאות ושולח לשרת...');
    try {
      const allMapsRes = await api.get('/management');
      const allMaps = allMapsRes.data.merchantMaps || [];
      
      const finalMap = [...allMaps, ...mappingsToSave];
      const mappingDict = Object.fromEntries(finalMap.map(m => [m.originalName, { newName: m.newName, category: m.category?.name }]));

      const transactions = dataToProcess.map(row => {
        const originalName = row['שם בית העסק'];
        const amount = row['סכום'] || row['סכום עסקה מקורי'];
        const date = row['תאריך עסקה'];
        const mapping = mappingDict[originalName] || {};
        
        return {
            date: date,
            description: mapping.newName || originalName,
            amount: Math.abs(Number(amount)) || 0,
            type: 'הוצאה',
            category: mapping.category || 'ללא קטגוריה',
            account: 'checking',
        };
      });
      
      const { data: response } = await api.post('/import/process-transactions', { transactions, newMappings: mappingsToSave });
      setMessage(response.message);
      setStage('result');
    } catch (error) {
      setMessage(error.response?.data?.message || 'שגיאה בעיבוד הקובץ.');
      setStage('result');
    }
  };

  const handleProcessClick = async (forceProcessAll = false) => {
    let finalMappings = [];

    for (const originalName of unseenMerchants) {
      const mapping = mappings[originalName];
      let categoryId = mapping.category;

      if (categoryId === CREATE_NEW_CATEGORY_VALUE) {
        // This case is handled by the Dialog now, so this part of logic might not be directly triggered
        // but is kept for safety.
        alert('יש ליצור קטגוריה חדשה דרך החלון שנפתח.');
        return;
      }
      
      if (categoryId) {
        finalMappings.push({ originalName, newName: mapping.newName.trim() || originalName, category: categoryId });
      } else if (!forceProcessAll) {
        alert(`נא לבחור קטגוריה עבור "${originalName}"`);
        return;
      } else {
        // Add a mapping without a category if forcing all
        finalMappings.push({ originalName, newName: mapping.newName.trim() || originalName, category: null });
      }
    }
    
    processData(finalMappings, parsedData);
  };
  
  const resetProcess = () => {
    setStage('select');
    setMessage('');
    setParsedData([]);
    setUnseenMerchants([]);
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">אשף ייבוא עסקאות</CardTitle>
          <CardDescription className="text-lg text-slate-600 mt-2">ייבא דפי חשבון בקלות ובמהירות</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[400px] flex items-center justify-center">
          {stage === 'select' && (
            <div className="text-center p-8 space-y-6">
              <UploadCloud className="mx-auto h-16 w-16 text-slate-300" />
              <h3 className="text-xl font-semibold">התחל ייבוא חדש</h3>
              <p className="text-slate-500">בחר את סוג הדוח שברצונך לייבא כדי להתחיל.</p>
              <div className="flex justify-center gap-4 pt-4">
                <Button size="lg" onClick={() => handleImportButtonClick('max')}>ייבוא מדוח "מקס"</Button>
                <Button size="lg" onClick={() => handleImportButtonClick('cal')}>ייבוא מדוח "כאל"</Button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".xlsx, .xls" className="hidden" />
            </div>
          )}

          {stage === 'map' && (
            <div className="w-full">
              <div className="text-center mb-6">
                <Settings className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="text-xl font-semibold mt-4">מיפוי ספקים חדשים</h3>
                <p className="text-slate-500">נמצאו {unseenMerchants.length} ספקים חדשים. הגדר עבורם שם נקי וקטגוריה.</p>
              </div>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 border-t border-b py-4">
                {unseenMerchants.map(name => (
                  <div key={name} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-2 rounded-md hover:bg-slate-50">
                    <span className="truncate font-medium" title={name}>{name}</span>
                    <Input placeholder="שם נקי (אופציונלי)" value={mappings[name]?.newName || ''} onChange={(e) => handleMappingChange(name, 'newName', e.target.value)} />
                    <div className="flex gap-2">
                      <Select value={mappings[name]?.category || ''} onValueChange={(v) => handleMappingChange(name, 'category', v)}>
                        <SelectTrigger><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>)}
                          <SelectItem value={CREATE_NEW_CATEGORY_VALUE}>--- צור קטגוריה חדשה ---</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-4 pt-6">
                 <Button type="button" variant="ghost" onClick={() => handleProcessClick(true)}>ייבא הכל (ושייך מאוחר יותר)</Button>
                 <Button type="button" onClick={() => handleProcessClick(false)}>סיים וייבא</Button>
              </div>
            </div>
          )}

          {(stage === 'processing' || stage === 'result') && (
            <div className="text-center p-8 space-y-4">
               {stage === 'processing' ? <FileText className="mx-auto h-16 w-16 text-slate-300 animate-pulse" /> : message.includes('שגיאה') ? <AlertTriangle className="mx-auto h-16 w-16 text-red-400" /> : <CheckCircle className="mx-auto h-16 w-16 text-green-400" />}
               <h2 className="text-2xl font-bold">{stage === 'processing' ? 'בתהליך...' : 'תהליך הייבוא הסתיים'}</h2>
               <p className={message.includes('שגיאה') ? 'text-red-600' : 'text-green-600'}>{message}</p>
               {stage === 'result' && <Button onClick={resetProcess} className="mt-6">התחל ייבוא חדש</Button>}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>הוספת קטגוריה חדשה</DialogTitle></DialogHeader>
          <div className="py-4"><Input placeholder="שם הקטגוריה..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsCategoryDialogOpen(false)}>ביטול</Button>
            <Button type="button" onClick={handleSaveNewCategory}>שמור קטגוריה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}