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
    .sort({ hotel: 1, roomNumber: 1 });
  
  res.json(rooms);
});

// --- 2. שליפת חדרים לעובדים (עם סינון יומי) ---
export const getRoomsByHotel = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  
  let rooms = await Room.find({ hotel: hotelId })
    .populate('roomType', 'name')
    .populate('lastCleanedBy', 'name')
    .sort({ roomNumber: 1 });

  // ניקוי ויזואלי של משימות יומיות שתוקפן פג (אם נשארו כאלו בטעות)
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  rooms = rooms.map(room => {
      const activeTasks = room.tasks.filter(t => {
          // משימות יומיות ('daily') - מציגים רק אם התאריך הוא היום ומעלה
          if (t.type === 'daily' && t.date && new Date(t.date) < todayStart) {
              return false; 
          }
          return true; // standard ו-maintenance תמיד מוצגים
      });
      
      const roomObj = room.toObject();
      roomObj.tasks = activeTasks;
      return roomObj;
  });
    
  res.json(rooms);
});

// --- 3. יצירת חדרים (Bulk) - טעינה ראשונית מהתבנית ---
export const createBulkRooms = catchAsync(async (req, res, next) => {
  const { hotel, roomType, startNumber, endNumber } = req.body;

  if (!hotel || !roomType || !startNumber || !endNumber) {
    return next(new AppError('חסרים נתונים.', 400));
  }

  // שליפת התבנית הראשית מהמלון
  const hotelDoc = await Hotel.findById(hotel);
  const checklist = hotelDoc?.masterChecklist && hotelDoc.masterChecklist.length > 0 
      ? hotelDoc.masterChecklist 
      : [{ text: 'ניקיון כללי (ברירת מחדל)', order: 1 }];

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
            // יצירת משימות מסוג 'standard'
            tasks: checklist.map(item => ({ 
                description: item.text, 
                type: 'standard',
                isSystemTask: true // Legacy flag
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
    const { description, isTemporary } = req.body; // isTemporary מגיע מהקליינט

    if (!description) return next(new AppError('חובה להזין תיאור', 400));

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    // קביעת סוג המשימה
    // אם זמני -> daily, אחרת -> maintenance (תקלה/חוסר)
    const type = isTemporary ? 'daily' : 'maintenance';
    const date = isTemporary ? new Date() : null;

    room.tasks.push({
        description,
        addedBy: req.user._id,
        type: type, 
        date: date,
        isSystemTask: false
    });

    if (room.status === 'clean') room.status = 'dirty';

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

    // ✨ לוגיקה מיוחדת לתקלות (Maintenance):
    // אם זו תקלה והיא סומנה כבוצעה - האם למחוק אותה מיד?
    // לפי האפיון: "ברגע שהעובד מסמן V – התקלה נעלמת".
    if (task.type === 'maintenance' && isCompleted) {
        // אופציה א': מחיקה פיזית (Uncomment כדי למחוק)
        // room.tasks.pull(taskId);
        
        // אופציה ב': השארה כ"בוצע" עד הרענון הבא (כדי שהמנהל יראה שתוקן)
        // כרגע נשאיר אותה מסומנת. בדף הסטטוס היומי ננקה אותה.
    }

    await room.save();
    res.json(room);
});

// --- 6. עדכון סטטוס / איפוס חדר (הלוגיקה החכמה) ---
export const updateRoomStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    // אם הופכים למלוכלך ('dirty') -> זהו "איפוס חדר" ליום חדש/אורח חדש
    if (status === 'dirty' && room.status !== 'dirty') {
        
        // 1. שמירת התקלות הפתוחות בלבד (Maintenance שלא בוצעו)
        // (וגם תקלות שבוצעו אפשר לנקות עכשיו אם רוצים היסטוריה נקייה)
        const openMaintenanceTasks = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
        
        // 2. טעינת התבנית העדכנית מהמלון
        const hotelDoc = await Hotel.findById(room.hotel);
        const checklist = hotelDoc?.masterChecklist || [];
        
        const newStandardTasks = checklist.map(item => ({
            description: item.text,
            type: 'standard',
            isCompleted: false,
            isSystemTask: true
        }));

        // 3. בנייה מחדש של מערך המשימות
        // (הערה: משימות 'daily' נמחקות כי הן היו רלוונטיות ליום הקודם)
        room.tasks = [...newStandardTasks, ...openMaintenanceTasks];
    } 
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
export const applyDailyPlan = catchAsync(async (req, res, next) => {
    const { plan } = req.body; // מערך של: { roomId, action, note }
    
    if (!plan || !Array.isArray(plan)) {
        return next(new AppError('מבנה נתונים לא תקין', 400));
    }

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const endOfDay = new Date();
    endOfDay.setHours(23,59,59,999);

    let updatedCount = 0;

    // לולאה על כל שורה בטבלה שהמנהל שלח
    for (const item of plan) {
        const { roomId, action, note } = item;

        // אם לא נבחרה פעולה ("ללא שינוי"), מדלגים
        if (!action || action === 'none') continue;

        const room = await Room.findById(roomId);
        if (!room) continue;

        // שליפת הצ'ק ליסט הקבוע של המלון
        const hotelDoc = await Hotel.findById(room.hotel);
        // שימוש בפונקציית הגיבוי שיצרנו קודם כדי לוודא שתמיד יש משימות
        const standardChecklist = getChecklistWithFallback(hotelDoc); 

        // 1. שמירת תקלות (Maintenance) - לא נוגעים בהן!
        const existingMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);

        // 2. יצירת משימות סטנדרט (לפי סוג הפעולה)
        const newStandardTasks = standardChecklist.map(t => ({
            ...t,
            // אם זה Stayover, אולי נרצה לסמן משהו אחר? כרגע נטען את הסטנדרט
            isCompleted: false,
            createdAt: new Date()
        }));

        // 3. יצירת משימה מההערה היומית (אם יש) - שכבה ב'
        const dailyTasks = [];
        if (note && note.trim()) {
            dailyTasks.push({
                description: note.trim(),
                type: 'daily',
                date: endOfDay, // תוקף להיום בלבד
                isCompleted: false,
                isSystemTask: false,
                addedBy: req.user._id
            });
        }

        // 4. עדכון החדר
        // שים לב: אנחנו דורסים את ה-tasks הקודמים (למעט תקלות)
        room.tasks = [...existingMaintenance, ...dailyTasks, ...newStandardTasks];
        
        // סימון כמלוכלך כדי שיופיע בצבע המתאים לעובד
        room.status = 'dirty'; 
        
        await room.save();
        updatedCount++;
    }

    res.json({ message: `סידור העבודה הופץ בהצלחה ל-${updatedCount} חדרים.` });
});