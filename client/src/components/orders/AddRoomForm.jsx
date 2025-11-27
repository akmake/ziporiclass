// client/src/components/orders/AddRoomForm.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { calculateRoomTotalPrice } from '@/lib/priceCalculator';
import { Button } from '@/components/ui/Button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from '@/components/ui/Label.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Moon, Lock, StickyNote } from 'lucide-react';

export function AddRoomForm({ priceLists, roomTypes, numberOfNights, onNightsChange, onAddRoom, disabled, isLoading }) {
  const [room, setRoom] = useState({ adults: 2, teens: 0, children: 0, babies: 0 });
  const [roomNotes, setRoomNotes] = useState(''); // ✨ נשמר: סטייט להערות חדר
  const [selectedPL, setSelectedPL] = useState([]);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(null);

  useEffect(() => {
      if (roomTypes && roomTypes.length > 0) {
          const defaultType = roomTypes.find(rt => rt.isDefault) || roomTypes[0];
          setSelectedRoomTypeId(defaultType?._id);
      } else {
          setSelectedRoomTypeId(null);
      }
  }, [roomTypes]);

  // חישוב מגבלת הלילות
  const nightConstraints = useMemo(() => {
    let maxAllowed = 0;
    let isFixed = false;

    if (selectedPL.length === 0) return { max: 0, isFixed: false };

    selectedPL.forEach(name => {
        const pl = priceLists[name];
        if (pl && pl.maxNights > 0) {
            if (maxAllowed === 0 || pl.maxNights < maxAllowed) {
                maxAllowed = pl.maxNights;
            }
        }
    });

    if (maxAllowed === 1) isFixed = true;
    return { max: maxAllowed, isFixed };
  }, [selectedPL, priceLists]);

  // עדכון אוטומטי של לילות
  useEffect(() => {
    if (nightConstraints.max > 0) {
        if (numberOfNights > nightConstraints.max) {
             onNightsChange({ target: { value: nightConstraints.max } });
        }
        if (nightConstraints.isFixed && numberOfNights !== 1) {
             onNightsChange({ target: { value: 1 } });
        }
    }
  }, [nightConstraints, numberOfNights, onNightsChange]);

  const currentPrice = useMemo(() => {
    if (selectedPL.length === 0 || disabled) return 0;
    const selectedType = roomTypes.find(rt => rt._id === selectedRoomTypeId);
    const supplement = selectedType ? selectedType.supplementPerNight : 0;
    return calculateRoomTotalPrice(room, priceLists, selectedPL, numberOfNights, supplement);
  }, [room, priceLists, selectedPL, disabled, numberOfNights, selectedRoomTypeId, roomTypes]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // ✨ תיקון ויזואלי: אם הערך ריק, נשמור 0
    setRoom(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
  };

  const handlePriceListToggle = (name) => {
    setSelectedPL(prev =>
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (selectedPL.length === 0) {
      alert("חובה לבחור לפחות מחירון אחד.");
      return;
    }

    const selectedTypeObj = roomTypes.find(rt => rt._id === selectedRoomTypeId);
    const typeName = selectedTypeObj ? selectedTypeObj.name : 'רגיל';
    const supplement = selectedTypeObj ? selectedTypeObj.supplementPerNight : 0;

    onAddRoom({
        ...room,
        price_list_names: selectedPL,
        price: currentPrice,
        roomTypeId: selectedRoomTypeId,
        roomType: typeName,
        roomSupplement: supplement,
        notes: roomNotes // ✨ שימור שליחת ההערות
    });

    setRoom({ adults: 2, teens: 0, children: 0, babies: 0 });
    setRoomNotes(''); 
    setSelectedPL([]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {disabled && isLoading && (
          <div className="text-center p-4 bg-amber-50 text-amber-800 rounded-md">
              טוען נתונים...
           </div>
      )}

      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            {/* סוג חדר */}
            <div>
                <Label className="mb-1.5 block">סוג חדר</Label>
                <Select value={selectedRoomTypeId || ''} onValueChange={setSelectedRoomTypeId}>
                    <SelectTrigger>
                        <SelectValue placeholder="בחר סוג" />
                    </SelectTrigger>
                    <SelectContent>
                        {roomTypes.length > 0 ? (
                            roomTypes.map(rt => (
                                <SelectItem key={rt._id} value={rt._id}>
                                    {rt.name} {rt.supplementPerNight > 0 ? `(+${rt.supplementPerNight}₪)` : ''}
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="default" disabled>אין סוגים</SelectItem>
                        )}
                     </SelectContent>
                </Select>
            </div>

            {/* לילות */}
            <div>
                 <Label className="mb-1.5 block">
                     לילות
                     {nightConstraints.max > 0 && (
                         <span className="text-xs text-red-500 mr-2">
                             (מוגבל עד {nightConstraints.max})
                         </span>
                     )}
                 </Label>
                 <div className="relative">
                     {nightConstraints.isFixed ? (
                         <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                     ) : (
                         <Moon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                     )}
                     <Input
                        type="number"
                        min="1"
                        max={nightConstraints.max > 0 ? nightConstraints.max : undefined}
                        value={numberOfNights}
                        onChange={onNightsChange}
                        disabled={disabled || nightConstraints.isFixed}
                        className={`pl-9 font-bold ${nightConstraints.isFixed ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                     />
                 </div>
            </div>
        </div>

        {/* ✨ התיקון הויזואלי: הצגת שדה ריק במקום 0 */}
        <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600">מבוגרים</label>
              <input 
                type="number" 
                name="adults" 
                value={room.adults || ''} 
                placeholder="0"
                onChange={handleInputChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md" 
                min="0" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">נערים</label>
              <input 
                type="number" 
                name="teens" 
                value={room.teens || ''} 
                placeholder="0"
                onChange={handleInputChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md" 
                min="0" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">ילדים</label>
              <input 
                type="number" 
                name="children" 
                value={room.children || ''} 
                placeholder="0"
                onChange={handleInputChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md" 
                min="0" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">תינוקות</label>
              <input 
                type="number" 
                name="babies" 
                value={room.babies || ''} 
                placeholder="0"
                onChange={handleInputChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md" 
                min="0" 
              />
            </div>
        </div>

        {/* ✨ שדה הערות לחדר (נשמר מהקובץ המעודכן שלך) */}
        <div>
            <Label className="mb-1.5 block">הערות לחדר (אופציונלי)</Label>
            <div className="relative">
                <StickyNote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                    type="text" 
                    value={roomNotes} 
                    onChange={(e) => setRoomNotes(e.target.value)} 
                    placeholder="לדוגמה: מיטה זוגית מופרדת, עריסה..." 
                    className="pl-10"
                />
            </div>
        </div>

        <div>
          <label className="font-medium block mb-2">בחר מחירונים:</label>
          <div className="space-y-2 bg-slate-50 p-3 rounded-md max-h-40 overflow-y-auto">
              {Object.keys(priceLists).length > 0 ? (
              Object.keys(priceLists).map(name => {
                const pl = priceLists[name];
                return (
                  <div key={name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`pl-${name}`} checked={selectedPL.includes(name)} onChange={() => handlePriceListToggle(name)} className="h-4 w-4 rounded border-gray-300" />
                        <label htmlFor={`pl-${name}`} className="text-sm cursor-pointer select-none">{name}</label>
                      </div>
                      {pl.maxNights > 0 && (
                          <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                              {pl.maxNights === 1 ? 'לילה 1' : `עד ${pl.maxNights} לילות`}
                          </span>
                      )}
                  </div>
                )
              })
              ) : (
                 <p className="text-sm text-gray-500">{!disabled ? 'לא נמצאו מחירונים עבור מלון זה.' : ''}</p>
            )}
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-md border border-blue-100 mt-2">
            <div className="flex justify-between items-center">
                <span className="text-sm text-blue-800">מחיר ל-{numberOfNights} לילות:</span>
                <span className="text-xl font-bold text-blue-700">{currentPrice.toLocaleString()} ₪</span>
             </div>
        </div>

        <Button type="submit" className="w-full" disabled={disabled}>הוסף חדר להזמנה</Button>
      </fieldset>
    </form>
  );
}