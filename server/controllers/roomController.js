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

// --- 2. שליפת חדרים לעובדים (מותאם תפקיד - תוקן הבאג שהעלים חדרים) ---
export const getRoomsByHotel = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  const user = req.user;

  const query = { hotel: hotelId };

  // סינון לפי תפקיד
  if (user.role === 'housekeeper') {
      // ✨ תיקון קריטי: הסרנו את סינון התאריך (assignmentDate).
      // החדרנית רואה כל חדר שמשויך אליה, או חדרים שאינם משויכים לאף אחד אבל הם בסטטוס עבודה (אופציונלי).
      // כרגע: רק מה שמשויך אליה.
      query.assignedTo = user._id;
  }
  else if (user.role === 'maintenance') {
      // איש תחזוקה רואה רק תקלות
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

  // סינון ויזואלי של משימות ישנות (רק ברמת התצוגה, לא מוחק מה-DB)
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  rooms = rooms.map(room => {
      const activeTasks = room.tasks.filter(t => {
          // מציגים משימות רגילות, תקלות, או משימות יומיות שהן מהיום (או עתידיות)
          if (t.type === 'daily' && t.date && new Date(t.date) < todayStart) {
              return false; // מסתיר משימות יומיות של אתמול
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
  // ברירת מחדל: צ'ק ליסט כללי
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

    // אם הוסיפו משימה, החדר כנראה דורש התייחסות
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

// --- 6. עדכון סטטוס ידני (עם הזרקת צ'ק ליסט מתאים) ---
export const updateRoomStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    if (status === 'clean') {
        if (room.status !== 'clean') {
            // שמירת היסטוריה בעת סגירת חדר
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
        // ✨ התיקון: טעינת הצ'ק ליסט הנכון לפי ההקשר
        // במצב ידני, אנחנו לא יודעים אם זה עזיבה או הגעה, אז נטען ברירת מחדל (departure/general)
        const openMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
        const hotelDoc = await Hotel.findById(room.hotel);

        let checklist = [];
        // עדיפות ראשונה: צ'ק ליסט עזיבה (הכי מקיף)
        if (hotelDoc?.checklists?.departure?.length > 0) {
            checklist = hotelDoc.checklists.departure;
        } 
        // עדיפות שנייה: תמיכה לאחור
        else if (hotelDoc?.masterChecklist?.length > 0) {
            checklist = hotelDoc.masterChecklist;
        } 
        else {
            checklist = [{ text: 'ניקיון כללי (לא הוגדר צ\'ק ליסט)', order: 1 }];
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

// --- 7. 🔥 המנוע החדש: הפצת סידור עבודה חכם (3 השכבות) 🔥 ---
export const applyDailyPlan = catchAsync(async (req, res, next) => {
    const { plan } = req.body; // [{ roomId, action, note }]

    if (!plan || !Array.isArray(plan)) {
        return next(new AppError('מבנה נתונים לא תקין', 400));
    }

    // הגדרת טווחי זמנים לבדיקת הזמנות (היום)
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    let updatedCount = 0;

    for (const item of plan) {
        const { roomId, action, note } = item;

        // אם לא נבחרה שום פעולה ואין הערה - מדלגים
        if ((!action || action === 'none') && (!note || !note.trim())) continue;

        const room = await Room.findById(roomId);
        if (!room) continue;

        const hotelDoc = await Hotel.findById(room.hotel);

        // 1. שמירת היסטוריה (רק אם דורסים מצב קיים שהוא לא נקי)
        if (room.tasks.length > 0 && room.status !== 'clean') {
             room.history.push({ cycleDate: new Date(), cleanedBy: "System Reset (Plan)", tasksSnapshot: room.tasks });
        }

        // 2. שמירת תקלות קיימות (Maintenance) - לא מוחקים לעולם עד שיתוקן!
        const existingMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);

        // --- שכבה א': הצ'ק ליסט הבסיסי (Checklist Layer) ---
        let selectedChecklist = [];

        if (action === 'stayover') {
            selectedChecklist = hotelDoc?.checklists?.stayover || [];
        }
        else if (action === 'checkout' || action === 'arrival') {
            // עזיבה או הגעה לחדר דורשים ניקיון יסודי
            selectedChecklist = hotelDoc?.checklists?.departure || [];
        }
        
        // Fallback: אם הרשימה הספציפית ריקה, לוקחים את הרשימה הראשית (תמיכה לאחור)
        if (selectedChecklist.length === 0) {
            selectedChecklist = hotelDoc?.masterChecklist || [{ text: 'ניקיון כללי', order: 1 }];
        }

        // יצירת משימות הסטנדרט
        const standardTasks = selectedChecklist.map(item => ({
            description: item.text,
            type: 'standard',
            isCompleted: false,
            isSystemTask: true
        }));

        // --- שכבה ב': נתונים מההזמנה (Automation Layer) ---
        const autoTasks = [];
        
        // בודקים אם יש כניסה היום (רלוונטי ל-Arrival או Checkout שהוא בעצם Back-to-Back)
        if (action === 'checkout' || action === 'arrival') {
            const nextBooking = await Booking.findOne({
                room: room._id,
                status: 'active',
                arrivalDate: { $gte: todayStart, $lte: todayEnd }
            });

            if (nextBooking) {
                const totalBeds = nextBooking.pax || 0; // פונקציית הקליטה חישבה ב-pax את סך המיטות
                const totalBabies = nextBooking.babies || 0;
                
                let taskDesc = `🛏️ להכין ${totalBeds} מיטות`;
                if (totalBabies > 0) {
                    taskDesc += ` + ${totalBabies} עריסות/לולים 👶`;
                }

                autoTasks.push({
                    description: taskDesc,
                    type: 'daily', // מוגדר כיומי כדי שיופיע כדגש
                    date: todayStart,
                    isCompleted: false,
                    isSystemTask: true,
                    isHighlight: true // סימון לצד לקוח
                });
            }
        }

        // --- שכבה ג': הערות מנהל (Manager Layer) ---
        const managerTasks = [];
        if (note && note.trim()) {
            managerTasks.push({
                description: `👑 ${note.trim()}`, // אייקון להדגשה
                type: 'daily',
                date: todayStart,
                isCompleted: false,
                isSystemTask: false,
                addedBy: req.user._id
            });
        }

        // 3. איחוד כל השכבות לרשימה אחת סופית
        // סדר: תקלות > מנהל > אוטומציה > סטנדרט
        room.tasks = [
            ...existingMaintenance, 
            ...managerTasks, 
            ...autoTasks, 
            ...standardTasks
        ];

        // 4. נעילת סטטוס
        room.status = 'dirty'; 

        await room.save();
        updatedCount++;
    }

    res.json({ message: `סידור העבודה עודכן בהצלחה ב-${updatedCount} חדרים.` });
});