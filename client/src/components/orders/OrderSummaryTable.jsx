// client/src/components/orders/OrderSummaryTable.jsx

import React from 'react';
import { calculateRoomTotalPrice } from '@/lib/priceCalculator';
import { Button } from '@/components/ui/Button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/Dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Input } from '@/components/ui/Input.jsx';
import { SlidersHorizontal, Moon, Trash2 } from 'lucide-react'; // ✨ הוספתי אייקון Trash2

export function OrderSummaryTable({ rooms, priceLists, roomTypes, numberOfNights, onRemoveRoom, onUpdateRoom }) {

  const totalPrice = rooms.reduce((sum, room) => sum + room.price, 0);

  // עדכון שדות (מספריים וטקסטואליים)
  const handleCellChange = (index, field, value) => {
    // בדיקה: אם השדה הוא 'notes', לא להמיר למספר. אם זה מספר והוא ריק, נשמור 0.
    const finalValue = field === 'notes' ? value : (value === '' ? 0 : parseInt(value, 10));
    
    const updatedRoom = { ...rooms[index], [field]: finalValue || (field === 'notes' ? '' : 0) };
    recalculateAndSave(index, updatedRoom);
  };

  // עדכון מחירונים
  const handlePriceListChange = (roomIndex, priceListName) => {
    const roomToUpdate = { ...rooms[roomIndex] };
    const currentSelection = roomToUpdate.price_list_names || [];

    const newSelection = currentSelection.includes(priceListName)
      ? currentSelection.filter(name => name !== priceListName)
      : [...currentSelection, priceListName];

    roomToUpdate.price_list_names = newSelection;
    recalculateAndSave(roomIndex, roomToUpdate);
  };

  // עדכון סוג חדר
  const handleRoomTypeChange = (index, newTypeId) => {
      const roomToUpdate = { ...rooms[index] };
      const selectedType = roomTypes.find(rt => rt._id === newTypeId);

      if (selectedType) {
          roomToUpdate.roomTypeId = selectedType._id;
          roomToUpdate.roomType = selectedType.name;
          roomToUpdate.roomSupplement = selectedType.supplementPerNight;
      }
      recalculateAndSave(index, roomToUpdate);
  };

  const recalculateAndSave = (index, updatedRoom) => {
      let supplement = updatedRoom.roomSupplement;
      if (supplement === undefined) {
           const typeObj = roomTypes.find(rt => rt._id === updatedRoom.roomTypeId || rt.name === updatedRoom.roomType);
           supplement = typeObj ? typeObj.supplementPerNight : 0;
      }

      const newPrice = calculateRoomTotalPrice(
          updatedRoom,
          priceLists,
          updatedRoom.price_list_names,
          numberOfNights,
          supplement
      );
      onUpdateRoom(index, { ...updatedRoom, price: newPrice, roomSupplement: supplement });
  };

  if (rooms.length === 0) {
    return <p className="text-center text-gray-500 py-10">עדיין לא נוספו חדרים להזמנה.</p>;
  }

  // ✨ עיצוב אחיד לשדות הקטנים
  const numberInputClass = "w-10 h-8 border border-gray-200 rounded text-center text-sm focus:outline-none focus:border-blue-400 transition-colors bg-white";

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 flex justify-between items-center">
          <span>סיכום הזמנה</span>
          <span className="text-sm font-normal bg-blue-50 text-blue-700 px-2 py-1 rounded-md flex items-center gap-1">
              <Moon size={14}/> לפי {numberOfNights} לילות
          </span>
      </h2>
      <div className="overflow-x-auto pb-24 md:pb-0">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-right text-xs font-medium uppercase w-[140px]">סוג חדר</th>
              <th className="px-1 py-2 text-center text-xs font-medium uppercase text-gray-500">מב'</th>
              <th className="px-1 py-2 text-center text-xs font-medium uppercase text-gray-500">נע'</th>
              <th className="px-1 py-2 text-center text-xs font-medium uppercase text-gray-500">יל'</th>
              <th className="px-1 py-2 text-center text-xs font-medium uppercase text-gray-500">תי'</th>
              <th className="px-2 py-2 text-right text-xs font-medium uppercase w-[100px]">מחירונים</th>
              <th className="px-2 py-2 text-right text-xs font-medium uppercase min-w-[150px]">הערות</th> {/* ✨ עמודה נשמרה */}
              <th className="px-2 py-2 text-right text-xs font-medium uppercase">סה"כ</th>
              <th className="px-1 py-2"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rooms.map((room, index) => (
              <tr key={index}>
                {/* עמודת סוג חדר */}
                <td className="px-2 py-2">
                     <Select
                        value={room.roomTypeId || ''}
                        onValueChange={(val) => handleRoomTypeChange(index, val)}
                    >
                        <SelectTrigger className="h-8 text-xs w-full bg-white border-gray-200">
                            <SelectValue placeholder={room.roomType || 'רגיל'} />
                        </SelectTrigger>
                        <SelectContent>
                             {roomTypes.map(rt => (
                                <SelectItem key={rt._id} value={rt._id} className="text-xs">
                                    {rt.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </td>

                {/* ✨ תיקון ויזואלי: שדות ריקים במקום 0, וקטנים יותר */}
                <td className="px-1 py-2 text-center">
                    <input type="number" min="0" className={numberInputClass}
                        value={room.adults > 0 ? room.adults : ''} 
                        onChange={(e) => handleCellChange(index, 'adults', e.target.value)} />
                </td>
                <td className="px-1 py-2 text-center">
                    <input type="number" min="0" className={numberInputClass}
                        value={room.teens > 0 ? room.teens : ''} 
                        onChange={(e) => handleCellChange(index, 'teens', e.target.value)} />
                </td>
                <td className="px-1 py-2 text-center">
                    <input type="number" min="0" className={numberInputClass}
                        value={room.children > 0 ? room.children : ''} 
                        onChange={(e) => handleCellChange(index, 'children', e.target.value)} />
                </td>
                <td className="px-1 py-2 text-center">
                    <input type="number" min="0" className={numberInputClass}
                        value={room.babies > 0 ? room.babies : ''} 
                        onChange={(e) => handleCellChange(index, 'babies', e.target.value)} />
                </td>

                <td className="px-2 py-2 text-xs">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between h-8 text-xs px-2 bg-white border-gray-200 hover:bg-gray-50">
                         <span className="truncate max-w-[80px]">{room.price_list_names.length > 0 ? room.price_list_names.join(', ') : 'בחר'}</span>
                        <SlidersHorizontal className="mr-1 h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>בחר מחירונים</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {Object.keys(priceLists).map(name => (
                        <DropdownMenuCheckboxItem
                          key={name}
                          checked={room.price_list_names.includes(name)}
                          onCheckedChange={() => handlePriceListChange(index, name)}
                        >
                          {name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>

                {/* ✨ תא הערות (נשמר) */}
                <td className="px-2 py-2">
                    <Input 
                        type="text" 
                        value={room.notes || ''} 
                        onChange={(e) => handleCellChange(index, 'notes', e.target.value)} 
                        className="h-8 text-xs min-w-[120px]"
                        placeholder="הערה..."
                    />
                </td>

                <td className="px-2 py-2 font-semibold text-sm min-w-[80px] text-gray-700">{room.price.toLocaleString()} ₪</td>
                <td className="px-1 py-2 text-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={() => onRemoveRoom(index)}>
                        <Trash2 size={14}/>
                    </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-2xl font-bold text-right mt-6 border-t pt-4">
        סה"כ לתשלום: <span className="text-blue-600">{totalPrice.toLocaleString()} ₪</span>
      </div>
    </div>
  );
}