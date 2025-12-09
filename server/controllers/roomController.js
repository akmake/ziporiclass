import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import Booking from '../models/Booking.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';

// --- 1. שליפת חדרים לחדרנית (הפונקציה שהייתה חסרה) ---
export const getMyTasks = catchAsync(async (req, res) => {
    // שליפת חדרים ששויכו למשתמש המחובר
    const rooms = await Room.find({ assignedTo: req.user._id })
        .populate('hotel', 'name')
        .sort({ status: 1, roomNumber: 1 }); // מיון: קודם סטטוס, אח"כ מספר חדר

    res.json(rooms);
});

// --- 2. שליפת כל החדרים (למנהל) ---
export const getAllRooms = catchAsync(async (req, res) => {
    const rooms = await Room.find({})
        .populate('roomType', 'name')
        .populate('hotel', 'name')
        .populate('lastCleanedBy', 'name')
        .populate('assignedTo', 'name')
        .sort({ hotel: 1, roomNumber: 1 });

    res.json(rooms);
});

// --- 3. שליפת חדרים לפי מלון ---
export const getRoomsByHotel = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    
    // בדיקה בסיסית אם ה-ID תקין למניעת קריסות CastError
    if (!hotelId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'מזהה מלון לא תקין' });
    }

    const rooms = await Room.find({ hotel: hotelId })
        .populate('roomType', 'name')
        .populate('lastCleanedBy', 'name')
        .populate('assignedTo', 'name')
        .sort({ roomNumber: 1 });

    res.json(rooms);
});

// --- 4. יצירת חדרים (Bulk) ---
export const createBulkRooms = catchAsync(async (req, res, next) => {
    const { hotel, roomType, startNumber, endNumber } = req.body;

    if (!hotel || !startNumber || !endNumber) {
        return next(new AppError('חסרים נתונים ליצירת חדרים.', 400));
    }

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
                roomType, // אופציונלי
                status: 'dirty',
                tasks: [] // מתחיל ריק
            });
        }
    }

    if (createdRooms.length > 0) {
        await Room.insertMany(createdRooms);
    }

    res.status(201).json({ message: `נוצרו ${createdRooms.length} חדרים חדשים.` });
});

// --- 5. עדכון סטטוס חדר ---
export const updateRoomStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    // לוגיקה: אם מסמנים כנקי, מעדכנים מי ניקה ומתי
    if (status === 'clean') {
        room.lastCleanedAt = new Date();
        room.lastCleanedBy = req.user._id;
        
        // סימון כל המשימות כהושלמו (אופציונלי, לנוחות)
        if (room.tasks && room.tasks.length > 0) {
            room.tasks.forEach(t => t.isCompleted = true);
        }
    }

    room.status = status;
    await room.save();
    res.json(room);
});

// --- 6. הוספת משימה ידנית ---
export const addTask = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { description, isTemporary } = req.body;

    if (!description) return next(new AppError('חובה להזין תיאור', 400));

    const room = await Room.findById(id);
    if (!room) return next(new AppError('חדר לא נמצא', 404));

    const type = isTemporary ? 'daily' : 'maintenance';
    
    room.tasks.push({
        description,
        addedBy: req.user._id,
        type: type,
        isSystemTask: false,
        isCompleted: false,
        isBlocking: false
    });

    // אם הוסיפו משימה, החדר כנראה כבר לא "נקי" לגמרי
    if (room.status === 'clean') {
        room.status = 'dirty';
    }

    await room.save();
    res.json(room);
});

// --- 7. סימון משימה (V/X) ---
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

// --- 8. מחיקת חדר ---
export const deleteRoom = catchAsync(async (req, res) => {
    await Room.findByIdAndDelete(req.params.id);
    res.status(204).send();
});

// --- 9. הפצת סידור עבודה (ידני) ---
export const applyDailyPlan = catchAsync(async (req, res, next) => {
    const { plan } = req.body; 
    // plan צפוי להיות מערך: [{ roomId, action, note }]

    if (!plan || !Array.isArray(plan)) {
        return next(new AppError('מבנה נתונים לא תקין', 400));
    }

    let updatedCount = 0;

    for (const item of plan) {
        const { roomId, note } = item;
        
        // כאן אפשר להוסיף לוגיקה שמוסיפה משימות לפי ה-action (למשל 'checkout')
        // כרגע נוסיף רק הערה אם קיימת
        if (note) {
            await Room.findByIdAndUpdate(roomId, {
                $push: {
                    tasks: {
                        description: `הערת מנהל: ${note}`,
                        type: 'daily',
                        isSystemTask: false,
                        isCompleted: false
                    }
                },
                $set: { status: 'dirty' }
            });
            updatedCount++;
        }
    }

    res.json({ message: `עודכנו ${updatedCount} חדרים` });
});