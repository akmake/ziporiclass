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
      // חדרנית רואה את החדרים ששויכו לה
      query.assignedTo = user._id;
  }
  else if (user.role === 'maintenance') {
      // איש תחזוקה רואה חדרים בסטטוס תחזוקה או עם משימות תחזוקה פתוחות
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

  // ניקוי משימות יומיות ישנות מהתצוגה (אופציונלי, ליתר ביטחון)
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  rooms = rooms.map(room => {
      const activeTasks = room.tasks.filter(t => {
          // משימות יומיות של העבר - מסתירים
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
  // ברירת מחדל: צ'ק ליסט בסיסי
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

// --- 4. הוספת משימה ידנית ---
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

// --- 5. עדכון משימה (V/X) ---
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

    // שמירת היסטוריה בעת סימון כ"נקי"
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
    // אם מסמנים כ"מלוכלך", מאפסים את הצ'ק ליסט הבסיסי
    else if (status === 'dirty' && room.status !== 'dirty') {
        const openMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
        const hotelDoc = await Hotel.findById(room.hotel);

        // רובד 1: צ'ק ליסט בסיסי קבוע
        let checklist = hotelDoc?.masterChecklist || [{ text: 'ניקיון יסודי', order: 1 }];
        
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

// --- 7. 🔥 המנוע החכם: הלבשת נתוני ההזמנה על החדר 🔥 ---
// פונקציה זו נקראת כשהמנהל לוחץ "הפץ לחדרניות" או אוטומטית אחרי קליטת אקסל.
export const applyDailyPlan = catchAsync(async (req, res, next) => {
    const { plan } = req.body; 
    // plan = מערך של { roomId, action, note } - נשתמש בזה כדי לדעת על אלו חדרים לרוץ

    if (!plan || !Array.isArray(plan)) {
        return next(new AppError('מבנה נתונים לא תקין', 400));
    }

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    console.log(`🛡️ Layered System: Syncing rooms with bookings...`);

    let updatedCount = 0;

    for (const item of plan) {
        const { roomId, note } = item;
        const room = await Room.findById(roomId);
        if (!room) continue;

        // שמירת משימות תחזוקה קיימות (שכבה 1 - לא נוגעים)
        const existingMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);

        // --- שכבה 2: צ'ק ליסט בסיסי (תמיד מתווסף כשמחדשים סידור) ---
        const hotelDoc = await Hotel.findById(room.hotel);
        const baseChecklist = hotelDoc?.masterChecklist || [{ text: 'ניקיון כללי', order: 1 }];
        
        const standardTasks = baseChecklist.map(item => ({
            description: item.text,
            type: 'standard',
            isCompleted: false,
            isSystemTask: true
        }));

        // --- שכבה 3: הלבשת נתוני הזמנה (Beds & Cribs) ---
        // חיפוש הזמנה פעילה להיום
        let bookingToday = await Booking.findOne({
            room: room._id,
            status: 'active',
            arrivalDate: { $gte: todayStart, $lte: todayEnd } // מחפשים כניסות היום
        });

        // חיפוש גיבוי לפי מספר חדר (טקסט)
        if (!bookingToday) {
            bookingToday = await Booking.findOne({
                roomNumber: room.roomNumber,
                status: 'active',
                arrivalDate: { $gte: todayStart, $lte: todayEnd }
            });
        }

        const bookingTasks = [];
        if (bookingToday) {
            // הוספת משימת מיטות (בנפרד)
            if (bookingToday.pax > 0) {
                bookingTasks.push({
                    description: `🛏️ להכין ${bookingToday.pax} מיטות`,
                    type: 'daily', // משימה יומית ספציפית
                    date: todayStart,
                    isCompleted: false,
                    isSystemTask: true,
                    isHighlight: true // להדגשה ב-UI
                });
            }

            // הוספת משימת עריסות (בנפרד)
            if (bookingToday.babies > 0) {
                bookingTasks.push({
                    description: `👶 להכין ${bookingToday.babies} עריסות/לולים`,
                    type: 'daily',
                    date: todayStart,
                    isCompleted: false,
                    isSystemTask: true,
                    isHighlight: true
                });
            }
        }

        // --- שכבה 4: הערות מנהל ידניות ---
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

        // הרכבת כל השכבות מחדש
        room.tasks = [
            ...existingMaintenance, // תמיד בראש
            ...managerTasks,        // דגשים
            ...bookingTasks,        // מיטות ועריסות
            ...standardTasks        // צ'ק ליסט רגיל
        ];

        room.status = 'dirty'; // איפוס סטטוס כדי שהחדרנית תראה את העבודה
        await room.save();
        updatedCount++;
    }

    res.json({ message: `סידור העבודה עודכן: ${updatedCount} חדרים סונכרנו עם נתוני מיטות ועריסות.` });
});