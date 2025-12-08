import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';

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

  // שאילתה בסיסית: חדרים במלון הזה
  const query = { hotel: hotelId };

  // --- סינון לפי תפקיד --- //

  // א. חדרנית: רואה רק את מה ששובץ לה להיום
  if (user.role === 'housekeeper') {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // איפוס לשעה 00:00

      query.assignedTo = user._id;
      // נציג רק אם תאריך ההקצאה הוא היום (או עתידי, למרות שלא אמור לקרות)
      query.assignmentDate = { $gte: today }; 
  }
  
  // ב. איש תחזוקה: רואה רק חדרים עם בעיות
  else if (user.role === 'maintenance') {
      query.$or = [
          { status: 'maintenance' }, // סטטוס החדר עצמו הוא "תקול"
          { tasks: { $elemMatch: { type: 'maintenance', isCompleted: false } } } // או שיש משימת תחזוקה פתוחה
      ];
  }

  // ג. אחראי משמרת / מנהל / מכירות: רואים הכל (השאילתה נשארת ללא פילטר נוסף)

  let rooms = await Room.find(query)
    .populate('roomType', 'name')
    .populate('lastCleanedBy', 'name')
    .populate('assignedTo', 'name') // כדי שאחראי משמרת יראה מי משובץ
    .sort({ roomNumber: 1 });

  // ניקוי ויזואלי של משימות יומיות שתוקפן פג
  // (אנחנו לא מוחקים מהמסד, רק מסתירים מהתצוגה אם זה משימה יומית ישנה)
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  rooms = rooms.map(room => {
      const activeTasks = room.tasks.filter(t => {
          // משימות יומיות ('daily') - מציגים רק אם התאריך הוא היום ומעלה
          if (t.type === 'daily' && t.date && new Date(t.date) < todayStart) {
              return false;
          }
          // standard ו-maintenance תמיד מוצגים (עד שיושלמו)
          return true; 
      });

      // המרה לאובייקט רגיל כדי שנוכל לשנות את המערך tasks לתצוגה
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

  // שליפת התבנית הראשית מהמלון כדי להחיל אותה על החדרים החדשים
  const hotelDoc = await Hotel.findById(hotel);
  const checklist = hotelDoc?.masterChecklist && hotelDoc.masterChecklist.length > 0
      ? hotelDoc.masterChecklist
      : [{ text: 'ניקיון כללי (ברירת מחדל)', order: 1 }];

  const start = parseInt(startNumber);
  const end = parseInt(endNumber);
  const createdRooms = [];

  for (let i = start; i <= end; i++) {
    const roomNumStr = i.toString();
    // בדיקה אם החדר כבר קיים במלון הזה
    const exists = await Room.findOne({ hotel, roomNumber: roomNumStr });

    if (!exists) {
        createdRooms.push({
            hotel,
            roomNumber: roomNumStr,
            roomType,
            status: 'dirty', // ברירת מחדל: מלוכלך
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

    // קביעת סוג המשימה
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

    // אם הוסיפו משימה לחדר נקי -> הוא הופך למלוכלך (לטיפול)
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

    // לוגיקה אופציונלית: אם כל המשימות בוצעו, אפשר להפוך לנקי אוטומטית.
    // כרגע אנחנו משאירים את זה ידני לפי ההוראות (העובד לוחץ "סיום ואישור").

    await room.save();
    res.json(room);
});

// --- 6. עדכון סטטוס / איפוס חדר ---
export const updateRoomStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    // לוגיקה של איפוס חדר ("הפיכה למלוכלך")
    if (status === 'dirty' && room.status !== 'dirty') {
        // 1. שומרים תקלות פתוחות (Maintenance שלא בוצעו)
        const openMaintenanceTasks = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
        
        // 2. טוענים מחדש את הצ'ק ליסט הסטנדרטי של המלון
        const hotelDoc = await Hotel.findById(room.hotel);
        const checklist = hotelDoc?.masterChecklist || [];

        const newStandardTasks = checklist.map(item => ({
            description: item.text,
            type: 'standard',
            isCompleted: false,
            isSystemTask: true
        }));

        // 3. בונים מחדש את רשימת המשימות
        // (הערה: משימות 'daily' נמחקות באיפוס כזה כי הן שייכות ליום הקודם)
        room.tasks = [...newStandardTasks, ...openMaintenanceTasks];
    }
    // לוגיקה של סיום ניקיון
    else if (status === 'clean') {
        room.lastCleanedAt = new Date();
        room.lastCleanedBy = req.user._id;
    }

    room.status = status;
    await room.save();
    res.json(room);
});

// --- 7. מחיקת חדר ---
export const deleteRoom = catchAsync(async (req, res) => {
    await Room.findByIdAndDelete(req.params.id);
    res.status(204).send();
});

// --- 8. החלת סידור עבודה (Legacy / ידני) ---
// פונקציה זו מאפשרת למנהל לשלוח עדכון גורף לחדרים (כמו שינוי סטטוס או הוספת הערה)
export const applyDailyPlan = catchAsync(async (req, res, next) => {
    const { plan } = req.body; // המערך מהלקוח: [{ roomId, action, note }, ...]

    if (!plan || !Array.isArray(plan)) {
        return next(new AppError('מבנה נתונים לא תקין', 400));
    }

    const endOfDay = new Date();
    endOfDay.setHours(23,59,59,999);

    let updatedCount = 0;

    // עזר פנימי: קבלת צ'ק ליסט סטנדרטי
    const getChecklistWithFallback = (hotelDoc) => {
        const checklist = hotelDoc?.masterChecklist;
        if (checklist && checklist.length > 0) {
            return checklist.map(item => ({
                description: item.text,
                type: 'standard',
                isCompleted: false,
                isSystemTask: true
            }));
        }
        return [{
            description: 'ניקיון כללי (ברירת מחדל)',
            type: 'standard',
            isCompleted: false,
            isSystemTask: true
        }];
    };

    // רצים על כל פריט בתוכנית
    for (const item of plan) {
         const { roomId, action, note } = item;

        // אם אין פעולה ("none") ואין הערה, מדלגים
        if ((!action || action === 'none') && (!note || !note.trim())) continue;

        const room = await Room.findById(roomId);
        if (!room) continue;

        // משיכת הנתונים של המלון
        const hotelDoc = await Hotel.findById(room.hotel);
        
        // 1. שמירת תקלות קיימות
        const existingMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);

        // 2. יצירת משימות סטנדרט (לפי סוג הפעולה - checkout/stayover כרגע מקבלים אותו נוהל)
        // בעתיד אפשר להפריד נהלים לפי סוג הפעולה
        const standardTasks = getChecklistWithFallback(hotelDoc);
        const newStandardTasks = standardTasks.map(t => ({
            ...t,
            isCompleted: false,
            createdAt: new Date()
        }));

        // 3. הוספת משימה יומית (אם נשלחה הערה)
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

        // 4. עדכון החדר
        room.tasks = [...existingMaintenance, ...dailyTasks, ...newStandardTasks];
        room.status = 'dirty'; // איפוס סטטוס ל"מלוכלך" כדי להתחיל עבודה
        
        await room.save();
        updatedCount++;
    }

    res.json({ message: `סידור העבודה הופץ בהצלחה ל-${updatedCount} חדרים.` });
});