// server/controllers/roomController.js

import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import Booking from '../models/Booking.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';

// ============================================================================
// 🧠 מנוע סנכרון חכם: יומן -> סטטוס חדר -> משימות
// ============================================================================
const syncRoomWithCalendar = async (room, hotelDoc, activeBookings) => {
    // 1. חדר בתקלה? לא נוגעים בו
    if (room.status === 'maintenance') return room;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 2. האם החדר סומן כ"נקי" היום? (אחרי תחילת היום)
    // אם כן, אנחנו לא דורסים את זה - העבודה בוצעה.
    const isCleanedToday = room.lastCleanedAt && new Date(room.lastCleanedAt) >= todayStart;

    if (isCleanedToday) {
        if (room.status !== 'clean') {
            room.status = 'clean';
            await room.save();
        }
        return room;
    }

    // 3. מציאת הזמנה רלוונטית להיום ביומן
    // (הזמנה שמתחילה, נגמרת, או מתמשכת על פני היום הזה)
    const booking = activeBookings.find(b => 
        b.room.toString() === room._id.toString() &&
        new Date(b.arrivalDate) <= todayEnd &&
        new Date(b.departureDate) >= todayStart
    );

    // אם אין שום פעילות יומן והחדר לא סומן ידנית כמלוכלך - הוא נקי
    if (!booking) {
        return room; 
    }

    // 4. חישוב הסטטוס היומי (Arrival / Departure / Stayover / Back-to-Back)
    const arrivalTime = new Date(booking.arrivalDate).setHours(0,0,0,0);
    const departureTime = new Date(booking.departureDate).setHours(0,0,0,0);
    const todayTime = todayStart.getTime();

    let calculatedStatus = ''; 
    let checklistType = ''; // קובע איזו רשימה למשוך מהמלון

    const isArrival = arrivalTime === todayTime;
    const isDeparture = departureTime === todayTime;

    if (isArrival && isDeparture) {
        // גם יוצאים וגם נכנסים באותו יום
        calculatedStatus = 'back_to_back'; 
        checklistType = 'departure'; // נדרש ניקיון יסודי של עזיבה
    } else if (isDeparture) {
        calculatedStatus = 'departure';
        checklistType = 'departure';
    } else if (isArrival) {
        calculatedStatus = 'arrival';
        checklistType = 'arrival'; // או 'refresh', תלוי בהגדרות המלון
    } else {
        calculatedStatus = 'stayover';
        checklistType = 'stayover';
    }

    // 5. בדיקה האם צריך לעדכן את החדר (להפוך למלוכלך + להזריק משימות)
    // התנאי: החדר אינו מלוכלך, או שרשימת המשימות שלו ריקה (אולי נוצרה ידנית ללא תוכן)
    const hasTasks = room.tasks && room.tasks.filter(t => !t.isCompleted).length > 0;
    
    // אם יש פעילות ביומן (booking קיים) והחדר עוד לא נוקה היום - הוא בהכרח מלוכלך
    if (room.status !== 'dirty' || !hasTasks) {
        room.status = 'dirty'; 
        
        // --- בניית רשימת המשימות החדשה ---
        let newTasks = [];

        // א. משימות קבועות מהמלון (לפי סוג הסטטוס)
        // אם אין רשימה ספציפית, לוקחים את ה-masterChecklist (ברירת מחדל)
        const hotelChecklist = hotelDoc.checklists?.[checklistType] || hotelDoc.masterChecklist || [];
        
        newTasks = hotelChecklist.map(item => ({
            description: item.text,
            type: 'standard',
            isSystemTask: true,
            isCompleted: false,
            addedBy: null // מערכת
        }));

        // ב. הזרקת משימות מיוחדות מההזמנה (רק בהגעה או תחלופה)
        if (isArrival || calculatedStatus === 'back_to_back') {
            // כמות מיטות
            if (booking.pax > 0) {
                newTasks.unshift({
                    description: `🛏️ להכין ${booking.pax} מיטות`,
                    type: 'daily',
                    isSystemTask: true,
                    isHighlight: true
                });
            }
            // כמות עריסות / לולים
            if (booking.babies > 0) {
                newTasks.unshift({
                    description: `👶 להכין ${booking.babies} עריסות/לולים`,
                    type: 'daily',
                    isSystemTask: true,
                    isHighlight: true
                });
            }
            // הערות מיוחדות מההזמנה
            if (booking.notes) {
                 newTasks.unshift({
                    description: `📝 דגש מהזמנה: ${booking.notes}`,
                    type: 'daily',
                    isSystemTask: true,
                    isHighlight: true
                });
            }
        }

        // שמירה: שומרים משימות תחזוקה ישנות (שלא ימחקו) ומוסיפים את החדשות
        const existingMaintenance = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
        room.tasks = [...existingMaintenance, ...newTasks];
        
        // שומרים ב-DB (זה קורה "מאחורי הקלעים" בעת השליפה)
        await room.save();
    }

    // מחזירים את החדר המעודכן (כולל הסטטוס והמשימות החדשות)
    return room;
};


// ============================================================================
// 🎮 Controllers
// ============================================================================

/**
 * @desc    שליפת חדרים למלון (כולל סנכרון אוטומטי מול יומן)
 * @route   GET /api/rooms/:hotelId
 */
export const getRoomsByHotel = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const user = req.user;

    // 1. שליפת הגדרות המלון (בשביל הצ'ק ליסטים)
    const hotelDoc = await Hotel.findById(hotelId);
    if (!hotelDoc) return res.status(404).json({ message: 'מלון לא נמצא' });

    // 2. בניית שאילתה בסיסית לחדרים
    let query = { hotel: hotelId };

    // סינון לפי תפקיד (חדרנית רואה רק את שלה, מנהל רואה הכל)
    if (user.role === 'housekeeper') {
        query.assignedTo = user._id;
    } 
    else if (user.role === 'maintenance') {
        // איש תחזוקה רואה חדרים בסטטוס תקלה או שיש בהם משימות תחזוקה
        query.$or = [
            { status: 'maintenance' },
            { tasks: { $elemMatch: { type: 'maintenance', isCompleted: false } } }
        ];
    }

    // שליפת החדרים מה-DB
    const rooms = await Room.find(query)
        .populate('roomType', 'name')
        .populate('assignedTo', 'name')
        .collation({ locale: "en_US", numericOrdering: true }) // מיון מספרי נכון (1, 2, 10 ולא 1, 10, 2)
        .sort({ roomNumber: 1 });

    // 3. ייעול: שליפת כל ההזמנות הרלוונטיות להיום במכה אחת
    // (מונע ביצוע שאילתה נפרדת לכל חדר בתוך הלולאה)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const activeBookings = await Booking.find({
        hotel: hotelId,
        status: 'active',
        $or: [
            { arrivalDate: { $lte: todayEnd, $gte: todayStart } }, // נכנסים היום
            { departureDate: { $lte: todayEnd, $gte: todayStart } }, // יוצאים היום
            { arrivalDate: { $lt: todayStart }, departureDate: { $gt: todayEnd } } // שוהים (התחילו לפני ונגמרים אחרי)
        ]
    });

    // 4. הרצת הסנכרון על כל חדר
    const processedRooms = await Promise.all(rooms.map(async (room) => {
        // אנשי תחזוקה לא צריכים לראות צ'ק ליסט ניקיון שנוצר אוטומטית
        if (user.role === 'maintenance') return room;
        
        // הפונקציה החכמה שבודקת את היומן ומעדכנת את החדר
        return await syncRoomWithCalendar(room, hotelDoc, activeBookings);
    }));

    res.json(processedRooms);
});


/**
 * @desc    עדכון סטטוס חדר (נקי/מלוכלך/תקלה)
 * @route   PATCH /api/rooms/:id/status
 */
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
            tasksSnapshot: room.tasks // שומרים מה בוצע
        });

        // מנקים את המשימות (משאירים רק תקלות פתוחות)
        room.tasks = room.tasks.filter(t => t.type === 'maintenance' && !t.isCompleted);
    }

    // מצב 2: סימון ידני כ"מלוכלך" (למשל אם המנהל החליט)
    // במקרה הזה, הסנכרון האוטומטי בקריאה הבאה (getRoomsByHotel) כבר ימלא את המשימות,
    // אבל כאן אנחנו רק משנים את הסטטוס כדי לאפשר את זה.
    else if (status === 'dirty') {
        room.status = 'dirty';
        // אופציונלי: אפשר לקרוא ל-syncRoomWithCalendar כאן אם רוצים מידית, 
        // אבל הקליינט בדרך כלל מרענן את הנתונים מיד אחרי הפעולה.
    }

    // מצב 3: סטטוס אחר (תחזוקה וכו')
    else {
        room.status = status;
    }

    await room.save();
    res.json(room);
});


/**
 * @desc    הוספת משימה ידנית (ע"י מנהל או חדרנית)
 * @route   POST /api/rooms/:id/tasks
 */
export const addTask = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { description, isTemporary } = req.body;
    const room = await Room.findById(id);
    if (!room) return next(new AppError('לא נמצא', 404));

    room.tasks.push({
        description,
        type: isTemporary ? 'daily' : 'maintenance', // daily = בקשה, maintenance = תקלה
        addedBy: req.user._id,
        isSystemTask: false
    });

    // אם הוסיפו משימה לחדר נקי -> הוא הופך למלוכלך/בטיפול
    if (room.status === 'clean') {
        room.status = isTemporary ? 'dirty' : 'maintenance';
    }
    
    await room.save();
    res.json(room);
});


/**
 * @desc    סימון משימה כבוצעה/לא בוצעה
 * @route   PATCH /api/rooms/:id/tasks/:taskId
 */
export const toggleTask = catchAsync(async (req, res, next) => {
    const { id, taskId } = req.params;
    const { isCompleted } = req.body;

    const room = await Room.findById(id);
    if (!room) return next(new AppError('לא נמצא', 404));

    const task = room.tasks.id(taskId);
    if (task) {
        task.isCompleted = isCompleted;
        task.completedBy = isCompleted ? req.user._id : null;
        task.completedAt = isCompleted ? new Date() : null;
        await room.save();
    }
    res.json(room);
});


/**
 * @desc    יצירת חדרים (Bulk)
 * @route   POST /api/rooms/bulk
 */
export const createBulkRooms = catchAsync(async (req, res) => {
    const { hotel, roomType, startNumber, endNumber } = req.body;
    const start = Number(startNumber);
    const end = Number(endNumber);
    const created = [];

    // במקרה של יצירה חדשה, החדר נוצר "ריק" ומלוכלך
    for(let i=start; i<=end; i++) {
        const num = i.toString();
        const exists = await Room.exists({ hotel, roomNumber: num });
        if(!exists) {
            created.push({ 
                hotel, 
                roomNumber: num, 
                roomType, 
                status: 'dirty', 
                tasks: [] // יתמלא אוטומטית בכניסה הראשונה
            });
        }
    }
    if(created.length) await Room.insertMany(created);
    res.status(201).json({ message: 'חדרים נוצרו בהצלחה' });
});


/**
 * @desc    שליפת כל החדרים (מנהל)
 * @route   GET /api/rooms/all
 */
export const getAllRooms = catchAsync(async (req, res) => {
    const rooms = await Room.find({})
        .populate('hotel', 'name')
        .sort({roomNumber: 1});
    res.json(rooms);
});


/**
 * @desc    מחיקת חדר
 * @route   DELETE /api/rooms/:id
 */
export const deleteRoom = catchAsync(async (req, res) => {
    await Room.findByIdAndDelete(req.params.id);
    res.status(204).send();
});


/**
 * @desc    הפצת תוכנית יומית (אופציונלי - נשאר לתמיכה ידנית)
 * @route   POST /api/rooms/daily-plan
 */
export const applyDailyPlan = catchAsync(async (req, res) => {
    const { plan } = req.body; // [{ roomId, note }]
    let count = 0;
    
    for (const item of plan) {
        const room = await Room.findById(item.roomId);
        if (room) {
            // הוספת הערה ידנית מהמנהל לראש הרשימה
            if (item.note) {
                room.tasks.unshift({
                    description: `👑 ${item.note}`,
                    type: 'daily',
                    isSystemTask: false,
                    addedBy: req.user._id
                });
                
                // אם יש הערה, החדר דורש יחס
                if (room.status === 'clean') room.status = 'dirty';
                await room.save();
                count++;
            }
        }
    }
    res.json({ message: `הערות הופצו ל-${count} חדרים.` });
});