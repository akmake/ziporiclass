import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import Booking from '../models/Booking.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';

// פונקציית עזר: יצירת משימות מחדש (ניקיון + הזמנות)
const regenerateRoomTasks = async (room, userId) => {
    // 1. שמירת משימות תחזוקה פתוחות (לא נוגעים בהן)
    const maintenanceTasks = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);

    // 2. הבאת צ'ק ליסט קבוע (ניקיון)
    const hotelDoc = await Hotel.findById(room.hotel);
    const standardTasks = (hotelDoc?.masterChecklist || [{ text: 'ניקיון בסיסי', order: 1 }])
        .map(item => ({
            description: item.text,
            type: 'standard',
            isSystemTask: true,
            addedBy: userId
        }));

    // 3. בדיקה "חיה" מול ההזמנות להיום (החלק החכם)
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    let bookingTasks = [];
    
    // בודקים אם יש הזמנה פעילה שנכנסת או נמצאת היום בחדר
    const booking = await Booking.findOne({
        room: room._id,
        status: 'active',
        arrivalDate: { $lte: todayEnd },
        departureDate: { $gte: todayStart }
    });

    if (booking) {
        // מזהים אם זו הגעה היום (Check-in)
        const isArrivalToday = 
            new Date(booking.arrivalDate).setHours(0,0,0,0) === todayStart.getTime();

        // אם זו הגעה, או שהחדר "התאפס", מוסיפים את דרישות המיטה
        if (booking.pax > 0) {
            bookingTasks.push({
                description: `🛏️ להכין ${booking.pax} מיטות ${isArrivalToday ? '(הגעה היום)' : ''}`,
                type: 'daily',
                isSystemTask: true,
                isHighlight: true, // צבע בולט
                addedBy: userId
            });
        }
        if (booking.babies > 0) {
            bookingTasks.push({
                description: `👶 להכין ${booking.babies} עריסות/לולים`,
                type: 'daily',
                isSystemTask: true,
                isHighlight: true,
                addedBy: userId
            });
        }
    }

    // 4. הרכבת הרשימה הסופית
    return [...maintenanceTasks, ...bookingTasks, ...standardTasks];
};


// ================= CONTROLLERS =================

export const updateRoomStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    // מצב 1: הופכים ל"נקי" (סוגרים הכל)
    if (status === 'clean') {
        room.status = 'clean';
        room.lastCleanedAt = new Date();
        room.lastCleanedBy = req.user._id;
        
        // שומרים היסטוריה
        room.history.push({
            cycleDate: new Date(),
            cleanedBy: req.user.name,
            tasksSnapshot: room.tasks
        });

        // מנקים הכל חוץ מתקלות
        room.tasks = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
    }
    
    // מצב 2: הופכים ל"מלוכלך" (או כל סטטוס עבודה אחר) -> מפעילים את המנוע החכם
    else if (status === 'dirty' || (status === 'dirty' && room.status !== 'dirty')) {
        // כאן הקסם: אנחנו בונים את המשימות מחדש כולל המיטות מההזמנה
        room.tasks = await regenerateRoomTasks(room, req.user._id);
        room.status = 'dirty';
    }
    
    // מצב 3: סטטוס אחר (תחזוקה וכו')
    else {
        room.status = status;
    }

    await room.save();
    res.json(room);
});

// השארתי את זה למקרה שתרצה עדיין לעשות Refresh ידני, אבל זה כבר לא חובה לשוטף
export const applyDailyPlan = catchAsync(async (req, res) => {
    const { plan } = req.body; 
    let count = 0;
    for (const item of plan) {
        const room = await Room.findById(item.roomId);
        if (room) {
            // אותו מנוע חכם בדיוק
            room.tasks = await regenerateRoomTasks(room, req.user._id);
            
            // הוספת הערה ידנית אם יש
            if (item.note) {
                room.tasks.unshift({
                    description: `👑 ${item.note}`,
                    type: 'daily',
                    isSystemTask: false,
                    addedBy: req.user._id
                });
            }
            // מוודאים סטטוס מלוכלך כדי שיראו את המשימות
            if (room.status === 'clean') room.status = 'dirty';
            
            await room.save();
            count++;
        }
    }
    res.json({ message: `סונכרנו ${count} חדרים.` });
});

// --- פונקציות תומכות (ללא שינוי) ---
export const getRoomsByHotel = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const user = req.user;
    const query = { hotel: hotelId };

    if (user.role === 'housekeeper') query.assignedTo = user._id;
    else if (user.role === 'maintenance') {
        query.$or = [{ status: 'maintenance' }, { tasks: { $elemMatch: { type: 'maintenance', isCompleted: false } } }];
    }

    const rooms = await Room.find(query)
        .populate('roomType', 'name')
        .populate('assignedTo', 'name')
        .collation({ locale: "en_US", numericOrdering: true })
        .sort({ roomNumber: 1 });
    res.json(rooms);
});

export const addTask = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { description, isTemporary } = req.body;
    const room = await Room.findById(id);
    if (!room) return next(new AppError('לא נמצא', 404));

    room.tasks.push({
        description,
        type: isTemporary ? 'daily' : 'maintenance',
        addedBy: req.user._id
    });
    
    if (room.status === 'clean') room.status = 'dirty';
    await room.save();
    res.json(room);
});

export const toggleTask = catchAsync(async (req, res, next) => {
    const { id, taskId } = req.params;
    const { isCompleted } = req.body;
    const room = await Room.findById(id);
    if (!room) return next(new AppError('לא נמצא', 404));
    
    const task = room.tasks.id(taskId);
    if (task) {
        task.isCompleted = isCompleted;
        task.completedBy = isCompleted ? req.user._id : null;
        await room.save();
    }
    res.json(room);
});

export const createBulkRooms = catchAsync(async (req, res) => {
    const { hotel, roomType, startNumber, endNumber } = req.body;
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
    res.status(201).json({ message: 'נוצרו' });
});

export const getAllRooms = catchAsync(async (req, res) => {
    const rooms = await Room.find({}).sort({roomNumber: 1});
    res.json(rooms);
});

export const deleteRoom = catchAsync(async (req, res) => {
    await Room.findByIdAndDelete(req.params.id);
    res.status(204).send();
});