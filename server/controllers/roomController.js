import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import Booking from '../models/Booking.js';
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

// --- 2. שליפת חדרים לעובדים ---
export const getRoomsByHotel = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  const user = req.user;

  const query = { hotel: hotelId };

  if (user.role === 'housekeeper') {
      query.assignedTo = user._id;
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

  // סינון ויזואלי של משימות ישנות
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

  const hotelDoc = await Hotel.findById(hotel);
  const checklist = hotelDoc?.masterChecklist && hotelDoc.masterChecklist.length > 0
      ? hotelDoc.masterChecklist
      : [{ text: 'ניקיון כללי', order: 1 }];

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

// --- 6. עדכון סטטוס ידני ---
export const updateRoomStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    if (status === 'clean') {
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
    else if (status === 'dirty' && room.status !== 'dirty') {
        const openMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
        const hotelDoc = await Hotel.findById(room.hotel);

        let checklist = [];
        if (hotelDoc?.checklists?.departure?.length > 0) {
            checklist = hotelDoc.checklists.departure;
        } else if (hotelDoc?.masterChecklist?.length > 0) {
            checklist = hotelDoc.masterChecklist;
        } else {
            checklist = [{ text: 'ניקיון כללי', order: 1 }];
        }

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

// --- 7. 🔥 רובד "יצירת החדר" - מתוקן למשיכת נתוני אקסל 🔥 ---
export const applyDailyPlan = catchAsync(async (req, res, next) => {
    const { plan } = req.body; 

    if (!plan || !Array.isArray(plan)) {
        return next(new AppError('מבנה נתונים לא תקין', 400));
    }

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    console.log(`🔎 Start Daily Plan: Looking for bookings between ${todayStart.toISOString()} and ${todayEnd.toISOString()}`);

    let updatedCount = 0;

    for (const item of plan) {
        const { roomId, action, note } = item;

        // אם אין פעולה ואין הערה - מדלגים
        if ((!action || action === 'none') && (!note || !note.trim())) continue;

        const room = await Room.findById(roomId);
        if (!room) continue;

        const hotelDoc = await Hotel.findById(room.hotel);

        // שימור היסטוריה ותקלות
        if (room.tasks.length > 0 && room.status !== 'clean') {
             room.history.push({ cycleDate: new Date(), cleanedBy: "System Reset (Plan)", tasksSnapshot: room.tasks });
        }
        const existingMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);

        // --- שלב א': שליפת נתוני אקסל (הזמנות) ---
        // התיקון: בודקים תמיד אם יש הגעה היום, ללא קשר למה שהמנהל בחר כ-Action
        const bookingToday = await Booking.findOne({
            room: room._id,
            status: 'active',
            arrivalDate: { $gte: todayStart, $lte: todayEnd }
        });

        // --- שלב ב': בניית רשימת משימות אוטומטית (מיטות) ---
        const autoTasks = [];
        
        if (bookingToday) {
            console.log(`✅ Room ${room.roomNumber}: Found Arrival! Pax: ${bookingToday.pax}, Babies: ${bookingToday.babies}`);
            
            const totalBeds = bookingToday.pax || 0;
            const totalBabies = bookingToday.babies || 0;
            
            let taskDesc = `🛏️ להכין ${totalBeds} מיטות`;
            if (totalBabies > 0) {
                taskDesc += ` + ${totalBabies} עריסות/לולים 👶`;
            }

            autoTasks.push({
                description: taskDesc,
                type: 'daily',
                date: todayStart,
                isCompleted: false,
                isSystemTask: true,
                isHighlight: true
            });
        } else {
             // אם אין הגעה, אולי יש עזיבה? נבדוק בשביל הלוג
             console.log(`ℹ️ Room ${room.roomNumber}: No arrival found today.`);
        }

        // --- שלב ג': בחירת הצ'ק ליסט הבסיסי ---
        let selectedChecklist = [];

        // אם המערכת זיהתה הגעה באקסל - זה אוטומטית דורש ניקיון יסודי (Departure), גם אם המנהל טעה
        if (bookingToday || action === 'checkout' || action === 'arrival') {
            selectedChecklist = hotelDoc?.checklists?.departure || [];
        } else if (action === 'stayover') {
            selectedChecklist = hotelDoc?.checklists?.stayover || [];
        }
        
        // Fallback
        if (selectedChecklist.length === 0) {
            selectedChecklist = hotelDoc?.masterChecklist || [{ text: 'ניקיון כללי', order: 1 }];
        }

        const standardTasks = selectedChecklist.map(item => ({
            description: item.text,
            type: 'standard',
            isCompleted: false,
            isSystemTask: true
        }));

        // --- שלב ד': הערות מנהל ---
        const managerTasks = [];
        if (note && note.trim()) {
            managerTasks.push({
                description: `👑 ${note.trim()}`,
                type: 'daily',
                date: todayStart,
                isCompleted: false,
                isSystemTask: false,
                addedBy: req.user._id
            });
        }

        // בניית הרשימה הסופית: תקלות > מנהל > מיטות > צ'ק ליסט
        room.tasks = [
            ...existingMaintenance, 
            ...managerTasks, 
            ...autoTasks, 
            ...standardTasks
        ];

        room.status = 'dirty'; 

        await room.save();
        updatedCount++;
    }

    res.json({ message: `סידור העבודה עודכן ב-${updatedCount} חדרים (כולל נתוני מיטות מהאקסל).` });
});