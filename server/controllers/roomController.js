import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import Booking from '../models/Booking.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';

// --- פעולה 1: ניהול סטטוס (משפיע רק על משימות ניקיון - standard) ---
export const updateRoomStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const room = await Room.findById(id);
    if (!room) throw new AppError('חדר לא נמצא', 404);

    // 1. הופכים לנקי -> סוגרים הכל (חוץ מתקלות פתוחות)
    if (status === 'clean') {
        room.status = 'clean';
        room.lastCleanedAt = new Date();
        room.lastCleanedBy = req.user._id;
        
        // שמירת היסטוריה
        room.history.push({
            cycleDate: new Date(),
            cleanedBy: req.user.name,
            tasksSnapshot: room.tasks
        });
        
        // משאירים רק תקלות פתוחות. כל השאר (ניקיון + מיטות) נחשב "בוצע" ונמחק מהתצוגה הפעילה
        room.tasks = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
    }
    
    // 2. הופכים למלוכלך -> טוענים צ'ק ליסט קבוע (standard) בלבד
    else if (status === 'dirty' && room.status !== 'dirty') {
        const hotelDoc = await Hotel.findById(room.hotel);
        const checklist = hotelDoc?.masterChecklist || [{ text: 'ניקיון כללי', order: 1 }];
        
        // יצירת משימות הניקיון החדשות
        const newStandardTasks = checklist.map(item => ({
            description: item.text,
            type: 'standard', // זה הסוג היחיד שאנחנו נוגעים בו כאן
            isCompleted: false,
            isSystemTask: true,
            addedBy: req.user._id
        }));

        // אנחנו שומרים את כל המשימות האחרות שהיו בחדר (תקלות + מיטות/עריסות אם היו)
        // ורק מחליפים את ה-standard הישנים (אם היו) בחדשים
        const otherTasks = room.tasks.filter(t => t.type !== 'standard');
        
        room.tasks = [...otherTasks, ...newStandardTasks];
        room.status = 'dirty';
    }
    
    // 3. אחר (תחזוקה וכו')
    else {
        room.status = status;
    }

    await room.save();
    res.json(room);
});


// --- פעולה 2: סנכרון הזמנות (משפיע רק על משימות יומיות - daily) ---
// מופעל מכפתור "הפץ" או אוטומטית מקליטת אקסל.
export const applyDailyPlan = catchAsync(async (req, res) => {
    const { plan } = req.body; 
    // plan הוא מערך של אובייקטים { roomId, ... } או שזה רץ על כל החדרים במלון לפי לוגיקה
    // כאן נניח שמקבלים רשימת חדרים לעדכון

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    let updatedCount = 0;

    for (const item of plan) {
        const room = await Room.findById(item.roomId);
        if (!room) continue;

        // 1. הסרת משימות "daily" ישנות בלבד. (לא נוגעים ב-standard או maintenance)
        const preservedTasks = room.tasks.filter(t => t.type !== 'daily');

        // 2. חיפוש נתוני הזמנה להיום
        let booking = await Booking.findOne({
            room: room._id,
            status: 'active',
            arrivalDate: { $gte: todayStart, $lte: todayEnd }
        });

        // Fallback: חיפוש לפי מספר חדר
        if (!booking) {
            booking = await Booking.findOne({
                roomNumber: room.roomNumber,
                hotel: room.hotel,
                status: 'active',
                arrivalDate: { $gte: todayStart, $lte: todayEnd }
            });
        }

        const newDailyTasks = [];

        // 3. הוספת משימות מיטות/עריסות אם יש הזמנה
        if (booking) {
            if (booking.pax > 0) {
                newDailyTasks.push({
                    description: `🛏️ להכין ${booking.pax} מיטות`,
                    type: 'daily',
                    isSystemTask: true,
                    isHighlight: true,
                    date: new Date(),
                    addedBy: req.user._id
                });
            }
            if (booking.babies > 0) {
                newDailyTasks.push({
                    description: `👶 להכין ${booking.babies} עריסות/לולים`,
                    type: 'daily',
                    isSystemTask: true,
                    isHighlight: true,
                    date: new Date(),
                    addedBy: req.user._id
                });
            }
        }

        // 4. הוספת הערת מנהל (אם נשלחה ב-Plan)
        if (item.note && item.note.trim()) {
            newDailyTasks.push({
                description: `👑 ${item.note}`,
                type: 'daily',
                isSystemTask: false,
                date: new Date(),
                addedBy: req.user._id
            });
        }

        // 5. חיבור מחדש
        room.tasks = [...preservedTasks, ...newDailyTasks];
        
        // אם הוספנו משימות הזמנה, הגיוני שהחדר דורש תשומת לב, גם אם היה נקי
        if (newDailyTasks.length > 0 && room.status === 'clean') {
            room.status = 'dirty';
        }

        await room.save();
        updatedCount++;
    }

    res.json({ message: `סונכרנו ${updatedCount} חדרים עם נתוני מיטות ועריסות.` });
});


// --- פעולות תומכות (CRUD רגיל) ---

export const getRoomsByHotel = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const user = req.user;
    const query = { hotel: hotelId };

    // סינון לפי תפקיד
    if (user.role === 'housekeeper') {
        query.assignedTo = user._id;
    } else if (user.role === 'maintenance') {
        query.$or = [
            { status: 'maintenance' },
            { tasks: { $elemMatch: { type: 'maintenance', isCompleted: false } } }
        ];
    }

    const rooms = await Room.find(query)
        .populate('roomType', 'name')
        .populate('assignedTo', 'name')
        .collation({ locale: "en_US", numericOrdering: true })
        .sort({ roomNumber: 1 });

    res.json(rooms);
});

export const addTask = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { description, isTemporary } = req.body;
    const room = await Room.findById(id);
    if (!room) throw new AppError('לא נמצא', 404);

    room.tasks.push({
        description,
        type: isTemporary ? 'daily' : 'maintenance',
        addedBy: req.user._id,
        isSystemTask: false
    });
    
    if (room.status === 'clean') room.status = 'dirty';
    await room.save();
    res.json(room);
});

export const toggleTask = catchAsync(async (req, res) => {
    const { id, taskId } = req.params;
    const { isCompleted } = req.body;
    
    const room = await Room.findById(id);
    if (!room) throw new AppError('לא נמצא', 404);
    
    const task = room.tasks.id(taskId);
    if (task) {
        task.isCompleted = isCompleted;
        task.completedBy = isCompleted ? req.user._id : null;
        task.completedAt = isCompleted ? new Date() : null;
        await room.save();
    }
    res.json(room);
});

export const getAllRooms = catchAsync(async (req, res) => {
    const rooms = await Room.find({})
        .populate('roomType', 'name')
        .populate('hotel', 'name')
        .sort({ hotel: 1, roomNumber: 1 });
    res.json(rooms);
});

export const createBulkRooms = catchAsync(async (req, res) => {
    // קוד יצירת חדרים (ללא שינוי מהקוד הקיים שלך)
    const { hotel, roomType, startNumber, endNumber } = req.body;
    if (!hotel || !roomType) throw new AppError('חסר מידע', 400);
    const start = Number(startNumber);
    const end = Number(endNumber);
    const created = [];
    const hotelDoc = await Hotel.findById(hotel);
    const tasks = (hotelDoc?.masterChecklist || []).map(t => ({ description: t.text, type: 'standard', isSystemTask: true }));
    
    for(let i=start; i<=end; i++) {
        const num = i.toString();
        const exists = await Room.exists({ hotel, roomNumber: num });
        if(!exists) created.push({ hotel, roomNumber: num, roomType, status: 'dirty', tasks });
    }
    if(created.length) await Room.insertMany(created);
    res.status(201).json({ message: 'נוצרו חדרים' });
});

export const deleteRoom = catchAsync(async (req, res) => {
    await Room.findByIdAndDelete(req.params.id);
    res.status(204).send();
});