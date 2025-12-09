import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import RoomType from '../models/RoomType.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';
import XLSX from 'xlsx';

// פונקציית עזר לניקוי תאריכים
const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

// פונקציית עזר למציאת ערך בעמודה (עבור העלאת אקסל)
const findColValue = (row, possibleNames) => {
    const rowKeys = Object.keys(row).map(k => k.toLowerCase());
    for (const name of possibleNames) {
        const lowerName = name.toLowerCase();
        if (row[name] !== undefined) return parseInt(row[name]);
        const foundKeyIndex = rowKeys.indexOf(lowerName);
        if (foundKeyIndex !== -1) {
            const realKey = Object.keys(row)[foundKeyIndex];
            return parseInt(row[realKey]);
        }
    }
    return 0;
};

// --- 1. העלאת אקסל ועיבוד נתונים (DRY RUN & SAVE) ---
export const uploadSchedule = catchAsync(async (req, res, next) => {
    if (!req.file) return next(new AppError('לא נבחר קובץ', 400));
    const { hotelId, dryRun } = req.body;

    if (!hotelId) return next(new AppError('חובה לבחור מלון', 400));

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    const existingRooms = await Room.find({ hotel: hotelId });
    const roomMap = new Map(existingRooms.map(r => [r.roomNumber, r]));

    let defaultType = await RoomType.findOne({ hotel: hotelId, isDefault: true });
    if (!defaultType) defaultType = await RoomType.findOne({ hotel: hotelId });

    const conflicts = [];
    const newBookings = [];
    const createdRooms = [];

    for (const row of rawData) {
        let roomNum = String(row['c_room_number'] || row['חדר'] || row['Room'] || '').trim();
        if (!roomNum || roomNum === '0') continue;

        let arrival = row['c_arrival_date'] || row['Arrival'] || row['הגעה'];
        let departure = row['c_depart_date'] || row['Departure'] || row['עזיבה'];

        if (!arrival || !departure) continue;

        const start = normalizeDate(arrival);
        const end = normalizeDate(departure);

        const adults = findColValue(row, ['c_adults', 'adults', 'adult', 'מבוגרים']);
        const juniors = findColValue(row, ['c_juniors', 'juniors', 'junior', 'נוער']);
        const children = findColValue(row, ['c_children', 'children', 'child', 'ילדים']);
        
        let pax = adults + juniors + children;
        if (pax === 0) pax = findColValue(row, ['total_pax', 'pax', 'total', 'סה"כ']);
        if (pax === 0) pax = 1;

        const babies = findColValue(row, ['c_babies', 'babies', 'baby', 'תינוקות']);

        let roomId;
        if (roomMap.has(roomNum)) {
            roomId = roomMap.get(roomNum)._id;
        } else {
            if (!defaultType) return next(new AppError('לא מוגדר סוג חדר למלון זה', 400));
            const newRoom = await Room.create({
                hotel: hotelId,
                roomNumber: roomNum,
                roomType: defaultType._id,
                status: 'dirty'
            });
            roomId = newRoom._id;
            roomMap.set(roomNum, newRoom);
            createdRooms.push(roomNum);
        }

        const overlap = await Booking.findOne({
            room: roomId,
            status: 'active',
            $or: [
                { arrivalDate: { $lt: end, $gte: start } },
                { departureDate: { $gt: start, $lte: end } },
                { arrivalDate: { $lte: start }, departureDate: { $gte: end } }
            ]
        });

        if (overlap) {
            conflicts.push({
                roomNumber: roomNum,
                newBooking: { start, end, pax, babies },
                existingBooking: {
                    id: overlap._id,
                    start: overlap.arrivalDate,
                    end: overlap.departureDate
                },
                type: 'overlap'
            });
        } else {
            newBookings.push({
                hotel: hotelId,
                room: roomId,
                roomNumber: roomNum,
                arrivalDate: start,
                departureDate: end,
                pax,
                babies,
                source: 'excel'
            });
        }
    }

    if (String(dryRun) === 'true') {
        return res.json({
            status: 'simulation',
            conflicts,
            validCount: newBookings.length,
            newRoomsCreated: createdRooms
        });
    }

    if (newBookings.length > 0) {
        await Booking.insertMany(newBookings);
    }

    res.json({
        status: 'success',
        message: `נוצרו ${newBookings.length} שיבוצים חדשים.`,
        conflicts: conflicts,
        createdRooms
    });
});

// --- 2. קבלת דשבורד יומי ---
export const getDailyDashboard = catchAsync(async (req, res, next) => {
    const { hotelId, date } = req.query;
    if (!hotelId) return next(new AppError('חסר מזהה מלון', 400));

    const queryDate = date ? normalizeDate(date) : normalizeDate(new Date());

    const rooms = await Room.find({ hotel: hotelId })
        .populate('assignedTo', 'name')
        .populate('roomType', 'name')
        .lean();

    const activeBookings = await Booking.find({
        hotel: hotelId,
        status: 'active',
        arrivalDate: { $lte: queryDate },
        departureDate: { $gte: queryDate }
    }).lean();

    const bookingMap = new Map();
    activeBookings.forEach(b => {
        if (!bookingMap.has(b.room.toString())) bookingMap.set(b.room.toString(), []);
        bookingMap.get(b.room.toString()).push(b);
    });

    const dashboardData = rooms.map(room => {
        const bookings = bookingMap.get(room._id.toString()) || [];
        let calculatedStatus = 'empty';
        let specialInfo = null;

        const arrivals = bookings.filter(b => normalizeDate(b.arrivalDate).getTime() === queryDate.getTime());
        const departures = bookings.filter(b => normalizeDate(b.departureDate).getTime() === queryDate.getTime());
        const stayovers = bookings.filter(b =>
            normalizeDate(b.arrivalDate) < queryDate &&
            normalizeDate(b.departureDate) > queryDate
        );

        if (arrivals.length > 0 && departures.length > 0) {
            calculatedStatus = 'back_to_back';
            specialInfo = {
                out: departures[0].pax,
                in: arrivals[0].pax,
                pax: arrivals[0].pax,
                babies: arrivals[0].babies
            };
        }
        else if (arrivals.length > 0) {
            calculatedStatus = 'arrival';
            specialInfo = {
                pax: arrivals[0].pax,
                babies: arrivals[0].babies
            };
        }
        else if (departures.length > 0) {
            calculatedStatus = 'departure';
            specialInfo = {
                out: departures[0].pax,
                pax: 0
            };
        }
        else if (stayovers.length > 0) {
            calculatedStatus = 'stayover';
            specialInfo = {
                pax: stayovers[0].pax,
                babies: stayovers[0].babies
            };
        }

        return {
            ...room,
            dashboardStatus: calculatedStatus,
            bookingInfo: specialInfo
        };
    });

    res.json(dashboardData);
});

// --- 3. פתרון התנגשויות ---
export const resolveConflict = catchAsync(async (req, res, next) => {
    const { action, conflictData } = req.body;
    if (action === 'overwrite') {
        const { existingBookingId, newBookingData } = conflictData;
        await Booking.findByIdAndUpdate(existingBookingId, { status: 'cancelled' });
        await Booking.create({ ...newBookingData, status: 'active', source: 'manual_fix' });
        res.json({ message: 'השיבוץ הישן נדרס והחדש נוצר.' });
    } else {
        res.json({ message: 'ההתנגשות נפתרה.' });
    }
});

// --- 4. 🔥 פונקציית הקצאה חכמה (כוללת את רובד האוטומציה) 🔥 ---
export const assignRoomsToHousekeeper = catchAsync(async (req, res, next) => {
    const { roomIds, userId } = req.body;
    
    // הגדרת טווח זמן לבדיקת הזמנות (היום)
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    let updatedCount = 0;

    // רצים על כל חדר שנבחר להקצאה
    for (const roomId of roomIds) {
        const room = await Room.findById(roomId);
        if (!room) continue;

        // 1. ביצוע ההקצאה (הרובד הבסיסי)
        room.assignedTo = userId || null;
        room.assignmentDate = normalizeDate(new Date());

        // 2. הפעלת רובד האוטומציה: בדיקה אם צריך לייצר משימות (אם אין)
        // אם החדר כבר בסטטוס 'מלוכלך' ויש לו משימות - לא ניגע בו כדי לא לדרוס עבודה.
        // אבל אם הוא 'נקי' או שאין לו משימות - נפעיל את האוטומציה.
        if (room.status === 'clean' || room.tasks.length === 0) {
            
            const hotelDoc = await Hotel.findById(room.hotel);
            
            // בדיקת הזמנות להיום (כדי לדעת איזה צ'ק ליסט לטעון וכמה מיטות)
            const bookingToday = await Booking.findOne({
                room: room._id,
                status: 'active',
                $or: [
                    { arrivalDate: { $gte: todayStart, $lte: todayEnd } },   // הגעה היום
                    { departureDate: { $gte: todayStart, $lte: todayEnd } }  // עזיבה היום
                ]
            });

            // ברירת מחדל: צ'ק ליסט שהייה
            let checklistType = 'stayover'; 
            let shouldAddBeds = false;

            if (bookingToday) {
                // לוגיקת זיהוי מדויקת: האם זה הגעה או עזיבה?
                const isArrival = bookingToday.arrivalDate >= todayStart && bookingToday.arrivalDate <= todayEnd;
                const isDeparture = bookingToday.departureDate >= todayStart && bookingToday.departureDate <= todayEnd;

                // עזיבה או הגעה = צ'ק ליסט יסודי
                if (isArrival || isDeparture) {
                    checklistType = 'departure'; 
                }
                
                // רק אם זו הגעה, צריך להכין מיטות
                if (isArrival) {
                    shouldAddBeds = true;
                }
            }

            // בחירת הרשימה המתאימה
            let selectedChecklist = [];
            if (checklistType === 'departure') {
                selectedChecklist = hotelDoc?.checklists?.departure || hotelDoc?.masterChecklist || [];
            } else {
                selectedChecklist = hotelDoc?.checklists?.stayover || [];
            }
            
            // Fallback
            if (selectedChecklist.length === 0) {
                selectedChecklist = [{ text: 'ניקיון כללי', order: 1 }];
            }

            // יצירת משימות רגילות מהצ'ק ליסט
            const newTasks = selectedChecklist.map(item => ({
                description: item.text,
                type: 'standard',
                isCompleted: false,
                isSystemTask: true
            }));

            // הוספת שכבת מיטות (אם יש הגעה)
            if (shouldAddBeds && bookingToday) {
                const totalBeds = bookingToday.pax || 0;
                const totalBabies = bookingToday.babies || 0;
                
                let taskDesc = `🛏️ להכין ${totalBeds} מיטות`;
                if (totalBabies > 0) {
                    taskDesc += ` + ${totalBabies} עריסות/לולים 👶`;
                }

                // דוחף לראש הרשימה
                newTasks.unshift({
                    description: taskDesc,
                    type: 'daily', // מוגדר כיומי כדי שיופיע כדגש
                    date: todayStart,
                    isCompleted: false,
                    isSystemTask: true,
                    isHighlight: true
                });
            }

            room.tasks = newTasks;
            room.status = 'dirty'; // הקצאה תמיד הופכת את החדר למלוכלך/לעבודה
        }

        await room.save();
        updatedCount++;
    }

    res.json({ message: `הוקצו ${updatedCount} חדרים ועודכנו משימות בהתאם להזמנות.` });
});