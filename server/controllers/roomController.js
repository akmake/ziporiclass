import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import Booking from '../models/Booking.js'; // ✨ חובה לייבא כדי לחשב מיטות
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';

// פונקציית עזר לניקוי שעה מתאריך
const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

// --- 1. שליפת כל החדרים (למנהלים) ---
export const getAllRooms = catchAsync(async (req, res) => {
  const rooms = await Room.find({})
    .populate('roomType', 'name')
    .populate('hotel', 'name')
    .populate('lastCleanedBy', 'name')
    .populate('assignedTo', 'name')
    .sort({ hotel: 1, roomNumber: 1 });

  res.json(rooms);
});

// --- 2. שליפת חדרים לעובדים (מותאם תפקיד) ---
export const getRoomsByHotel = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  const user = req.user;

  const query = { hotel: hotelId };

  if (user.role === 'housekeeper') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.assignedTo = user._id;
      // מציג רק הקצאות מהיום או עתידיות
      query.assignmentDate = { $gte: today };
  }
  else if (user.role === 'maintenance') {
      query.$or = [
          { status: 'maintenance' },
          { tasks: { $elemMatch: { type: 'maintenance', isCompleted: false } } }
      ];
  }

  let rooms = await Room.find(query)
    .populate('roomType', 'name')
    .populate('lastCleanedBy', 'name')
    .populate('assignedTo', 'name')
    .sort({ roomNumber: 1 });

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  rooms = rooms.map(room => {
      const activeTasks = room.tasks.filter(t => {
          if (t.type === 'daily' && t.date && new Date(t.date) < todayStart) {
              return false;
          }
          return true;
      });
      const roomObj = room.toObject();
      roomObj.tasks = activeTasks;
      return roomObj;
  });

  res.json(rooms);
});

// --- 3. יצירת חדרים (Bulk) ---
export const createBulkRooms = catchAsync(async (req, res, next) => {
  const { hotel, roomType, startNumber, endNumber } = req.body;

  if (!hotel || !roomType || !startNumber || !endNumber) {
    return next(new AppError('חסרים נתונים ליצירת חדרים.', 400));
  }

  // ברירת מחדל: לוקחים את רשימת "עזיבה" (Departure) כברירת מחדל ליצירה
  const hotelDoc = await Hotel.findById(hotel);
  const checklist = hotelDoc?.checklists?.departure?.length > 0 
      ? hotelDoc.checklists.departure 
      : (hotelDoc?.masterChecklist || [{ text: 'ניקיון כללי', order: 1 }]);

  const start = parseInt(startNumber);
  const end = parseInt(endNumber);
  const createdRooms = [];

  for (let i = start; i <= end; i++) {
    const roomNumStr = i.toString();
    const exists = await Room.findOne({ hotel, roomNumber: roomNumStr });

    if (!exists) {
        createdRooms.push({
            hotel,
            roomNumber: roomNumStr,
            roomType,
            status: 'dirty',
            tasks: checklist.map(item => ({
                description: item.text,
                type: 'standard',
                isSystemTask: true
            }))
        });
    }
  }

  if (createdRooms.length > 0) {
    await Room.insertMany(createdRooms);
  }

  res.status(201).json({ message: `נוצרו ${createdRooms.length} חדרים חדשים.` });
});

// --- 4. הוספת משימה (ידנית / יומית) ---
export const addTask = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { description, isTemporary } = req.body;

    if (!description) return next(new AppError('חובה להזין תיאור משימה', 400));

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    const type = isTemporary ? 'daily' : 'maintenance';
    const date = isTemporary ? new Date() : null;

     room.tasks.push({
        description,
        addedBy: req.user._id,
        type: type,
        date: date,
        isSystemTask: false,
        isCompleted: false
    });

    if (room.status === 'clean') {
        room.status = 'dirty';
    }

    await room.save();
    res.json(room);
});

// --- 5. סימון משימה כבוצעה ---
export const toggleTask = catchAsync(async (req, res, next) => {
    const { id, taskId } = req.params;
    const { isCompleted } = req.body;

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    const task = room.tasks.id(taskId);
    if (!task) return next(new AppError('משימה לא נמצאה', 404));

    task.isCompleted = isCompleted;
    task.completedBy = isCompleted ? req.user._id : null;
    task.completedAt = isCompleted ? new Date() : null;

    await room.save();
    res.json(room);
});

// --- 6. עדכון סטטוס / איפוס חדר (ידני) ---
export const updateRoomStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body; // 'clean', 'dirty', 'maintenance'

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    // אם סיימנו ניקיון
    if (status === 'clean') {
        // ארכוב ההיסטוריה
        if (room.status !== 'clean') {
            room.history.push({
                cycleDate: new Date(),
                cleanedBy: req.user.name,
                tasksSnapshot: room.tasks
            });
        }
        room.lastCleanedAt = new Date();
        room.lastCleanedBy = req.user._id;
    } 
    // אם מחזירים למלוכלך (איפוס ידני ללא תוכנית ספציפית - ברירת מחדל Departure)
    else if (status === 'dirty' && room.status !== 'dirty') {
        const openMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
        const hotelDoc = await Hotel.findById(room.hotel);
        
        // ברירת מחדל: רשימת Departure
        const checklist = hotelDoc?.checklists?.departure?.length > 0 
            ? hotelDoc.checklists.departure 
            : (hotelDoc?.masterChecklist || []);

        const newStandardTasks = checklist.map(item => ({
            description: item.text,
            type: 'standard',
            isCompleted: false,
            isSystemTask: true
        }));

        room.tasks = [...newStandardTasks, ...openMaintenance];
    }

    room.status = status;
    await room.save();
    res.json(room);
});

export const deleteRoom = catchAsync(async (req, res) => {
    await Room.findByIdAndDelete(req.params.id);
    res.status(204).send();
});

// --- 8. החלת סידור עבודה חכם (עם כמות מיטות) ---
export const applyDailyPlan = catchAsync(async (req, res, next) => {
    const { plan } = req.body; // [{ roomId, action, note }]

    if (!plan || !Array.isArray(plan)) {
        return next(new AppError('מבנה נתונים לא תקין', 400));
    }

    const endOfDay = new Date();
    endOfDay.setHours(23,59,59,999);
    const today = normalizeDate(new Date());

    let updatedCount = 0;

    for (const item of plan) {
        const { roomId, action, note } = item;

        if ((!action || action === 'none') && (!note || !note.trim())) continue;

        const room = await Room.findById(roomId);
        if (!room) continue;

        const hotelDoc = await Hotel.findById(room.hotel);
        
        // 1. שמירת היסטוריה אם החדר היה במצב עבודה
        if (room.tasks.length > 0 && room.status !== 'clean') {
             room.history.push({
                cycleDate: new Date(),
                cleanedBy: "System Reset",
                tasksSnapshot: room.tasks
            });
        }

        // 2. שמירת תקלות קיימות
        const existingMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);

        // 3. בחירת הצ'ק ליסט הנכון
        let selectedChecklist = [];
        let bedCountTask = null;

        if (action === 'stayover') {
            selectedChecklist = hotelDoc?.checklists?.stayover || [];
        } 
        else if (action === 'checkout' || action === 'arrival') { 
            // Checkout = הכנה לאורח הבא (Departure List)
            selectedChecklist = hotelDoc?.checklists?.departure || [];
            
            // --- ✨ לוגיקה חכמה: שליפת כמות מיטות להזמנה הבאה ✨ ---
            // מחפשים הזמנה שנכנסת היום או בעתיד הקרוב
            const nextBooking = await Booking.findOne({
                room: room._id,
                status: 'active',
                arrivalDate: { $gte: today } // הגעה היום או בעתיד
            }).sort({ arrivalDate: 1 }); // הקרובה ביותר

            if (nextBooking) {
                const totalBeds = nextBooking.pax || 0;
                const totalBabies = nextBooking.babies || 0;
                let taskDesc = `הכנת ${totalBeds} מיטות`;
                if (totalBabies > 0) taskDesc += ` + ${totalBabies} עריסות/לולים`;
                
                bedCountTask = {
                    description: taskDesc,
                    type: 'standard',
                    isCompleted: false,
                    isSystemTask: true,
                    // מסמנים שזו משימה קריטית (אפשר להוסיף שדה priority בעתיד)
                };
            }
        } 
        else {
            // Fallback למה שהיה קודם
            selectedChecklist = hotelDoc?.masterChecklist || [];
        }

        // המרה לפורמט משימות
        const newStandardTasks = selectedChecklist.map(item => ({
            description: item.text,
            type: 'standard',
            isCompleted: false,
            isSystemTask: true
        }));

        // הוספת משימת המיטות בראש הרשימה אם יש
        if (bedCountTask) {
            newStandardTasks.unshift(bedCountTask);
        }

        // 4. הוספת משימה יומית (הערה מהמנהל)
        const dailyTasks = [];
        if (note && note.trim()) {
            dailyTasks.push({
                description: note.trim(),
                type: 'daily',
                date: endOfDay,
                isCompleted: false,
                isSystemTask: false,
                addedBy: req.user._id
            });
        }

        // 5. עדכון החדר
        room.tasks = [...existingMaintenance, ...dailyTasks, ...newStandardTasks];
        room.status = 'dirty'; 

        await room.save();
        updatedCount++;
    }

    res.json({ message: `סידור העבודה הופץ בהצלחה ל-${updatedCount} חדרים (עם סנכרון מיטות).` });
});