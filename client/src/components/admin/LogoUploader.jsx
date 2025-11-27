import React, { useState } from 'react';
import api from '@/utils/api.js';
import { Button } from '@/components/ui/Button.jsx';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LogoUploader() {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    setUploading(true);
    try {
      await api.post('/upload/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('הלוגו עודכן בהצלחה! (רענן את הדף כדי לראות)');
    } catch (error) {
      console.error(error);
      toast.error('שגיאה בהעלאת הלוגו');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="font-bold mb-2">עדכון לוגו חברה</h3>
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild disabled={uploading}>
          <label className="cursor-pointer flex items-center gap-2">
            <Upload size={16} />
            {uploading ? 'מעלה...' : 'בחר קובץ לוגו'}
            <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange} />
          </label>
        </Button>
      </div>
    </div>
  );
}