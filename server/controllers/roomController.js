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

// --- 1. שליפת כל החדרים ---
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
      // חדרנית רואה את החדרים ששויכו לה, ללא תלות בתאריך ההקצאה
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

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  // סינון ויזואלי של משימות ישנות
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

// --- 4. הוספת משימה ---
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

// --- 5. עדכון משימה ---
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

// --- 7. 🔥 יצירת החדר היומית (Safe Mode) 🔥 ---
// זו הפונקציה שנקראת מ"סידור עבודה" (Daily Plan).
// היא בונה את המשימות לחדר באופן נפרד לחלוטין מההקצאה.
export const applyDailyPlan = catchAsync(async (req, res, next) => {
    const { plan } = req.body; 

    if (!plan || !Array.isArray(plan)) {
        return next(new AppError('מבנה נתונים לא תקין', 400));
    }

    // טווח זמנים לכל היום
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    console.log(`🛡️ Safe Daily Plan: Scanning for bookings ${todayStart.toISOString()} - ${todayEnd.toISOString()}`);

    let updatedCount = 0;

    for (const item of plan) {
        const { roomId, action, note } = item;

        // אם לא נבחר כלום, מדלגים
        if ((!action || action === 'none') && (!note || !note.trim())) continue;

        const room = await Room.findById(roomId);
        if (!room) continue;

        // שמירת גיבוי למקרה של תקלה (כדי לא למחוק משימות סתם)
        const previousTasks = [...room.tasks];
        const existingMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);

        // --- שלב א': איתור הזמנה (Booking) - חיפוש כפול וחזק ---
        // 1. חיפוש לפי ID של החדר (אם הקישור תקין)
        let bookingToday = await Booking.findOne({
            room: room._id,
            status: 'active',
            arrivalDate: { $gte: todayStart, $lte: todayEnd }
        });

        // 2. אם לא נמצא, חיפוש לפי מספר חדר (String) - לגיבוי מול אקסל שלא קושר טוב
        if (!bookingToday) {
            bookingToday = await Booking.findOne({
                roomNumber: room.roomNumber, // וודא ששדה זה קיים ב-Booking (הוספנו אותו בקליטה)
                status: 'active',
                arrivalDate: { $gte: todayStart, $lte: todayEnd }
            });
            if (bookingToday) console.log(`✅ מצאתי הזמנה לחדר ${room.roomNumber} לפי מספר חדר (טקסט)!`);
        }

        // --- שלב ב': בניית נתוני מיטות ---
        const autoTasks = [];
        if (bookingToday) {
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
        }

        // --- שלב ג': בחירת הצ'ק ליסט ---
        const hotelDoc = await Hotel.findById(room.hotel);
        let selectedChecklist = [];

        // אם יש הגעה היום (לפי האקסל), זה Departure (ניקיון יסודי) לא משנה מה המנהל בחר
        if (bookingToday || action === 'checkout' || action === 'arrival') {
            selectedChecklist = hotelDoc?.checklists?.departure || [];
        } else if (action === 'stayover') {
            selectedChecklist = hotelDoc?.checklists?.stayover || [];
        }
        
        // Fallback
        if (selectedChecklist.length === 0) {
            selectedChecklist = hotelDoc?.masterChecklist || [{ text: 'ניקיון כללי', order: 1 }];
        }

        // --- מנגנון הגנה: לא מוחקים אם אין תוכן חדש ---
        // אם הצ'ק ליסט ריק, ואין מיטות, ואין הערה -> כנראה משהו שגוי, לא דורסים את המשימות הקיימות.
        if (selectedChecklist.length === 0 && autoTasks.length === 0 && (!note || !note.trim())) {
            console.log(`⚠️ מדלג על חדר ${room.roomNumber} - לא נמצא מידע לביצוע איפוס.`);
            continue; 
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

        // ביצוע העדכון בפועל
        if (room.status !== 'clean') {
             room.history.push({ cycleDate: new Date(), cleanedBy: "System Reset (Plan)", tasksSnapshot: previousTasks });
        }

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

    res.json({ message: `סידור העבודה עודכן בהצלחה ב-${updatedCount} חדרים (עם הגנה ממחיקה).` });
});