import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';
import XLSX from 'xlsx';

// עזר: ניקוי שעות
const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

// עזר: חיפוש עמודות באקסל (גמיש)
const findColValue = (row, possibleNames) => {
    const rowKeys = Object.keys(row).map(k => k.toLowerCase());
    for (const name of possibleNames) {
        const lowerName = name.toLowerCase();
        if (row[name] !== undefined) return parseInt(row[name]);
        // חיפוש חכם גם אם ה-Key באותיות קטנות/גדולות
        const foundKeyIndex = rowKeys.indexOf(lowerName);
        if (foundKeyIndex !== -1) {
            const realKey = Object.keys(row)[foundKeyIndex];
            return parseInt(row[realKey]);
        }
    }
    return 0;
};

// --- 1. העלאת קובץ ועיבוד (Booking Data Only) ---
export const uploadSchedule = catchAsync(async (req, res, next) => {
    if (!req.file) return next(new AppError('לא נבחר קובץ', 400));
    const { hotelId, dryRun } = req.body;

    if (!hotelId) return next(new AppError('חובה לבחור מלון', 400));

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    // מכינים מפות לזיהוי מהיר
    const existingRooms = await Room.find({ hotel: hotelId });
    const roomMap = new Map(existingRooms.map(r => [r.roomNumber, r]));

    // סוג חדר ברירת מחדל (למקרה שצריך ליצור חדר חדש)
    let defaultType = await RoomType.findOne({ hotel: hotelId, isDefault: true });
    if (!defaultType) defaultType = await RoomType.findOne({ hotel: hotelId });

    const conflicts = [];
    const newBookings = [];
    const createdRooms = [];

    for (const row of rawData) {
        // זיהוי מספר חדר
        let roomNum = String(row['c_room_number'] || row['חדר'] || row['Room'] || '').trim();
        if (!roomNum || roomNum === '0') continue;

        // זיהוי תאריכים
        let arrival = row['c_arrival_date'] || row['Arrival'] || row['הגעה'];
        let departure = row['c_depart_date'] || row['Departure'] || row['עזיבה'];

        if (!arrival || !departure) continue;

        const start = normalizeDate(arrival);
        const end = normalizeDate(departure);

        // זיהוי כמויות (מיטות)
        const adults = findColValue(row, ['c_adults', 'adults', 'adult', 'מבוגרים']);
        const juniors = findColValue(row, ['c_juniors', 'juniors', 'junior', 'נוער']);
        const children = findColValue(row, ['c_children', 'children', 'child', 'ילדים']);

        let pax = adults + juniors + children;
        if (pax === 0) pax = findColValue(row, ['total_pax', 'pax', 'total', 'סה"כ']);
        if (pax === 0) pax = 1; // מינימום מיטה אחת

        const babies = findColValue(row, ['c_babies', 'babies', 'baby', 'תינוקות']);

        // טיפול בחדר (יצירה אם לא קיים)
        let roomId;
        if (roomMap.has(roomNum)) {
            roomId = roomMap.get(roomNum)._id;
        } else {
            if (!defaultType) return next(new AppError('לא מוגדר סוג חדר למלון זה - לא ניתן ליצור חדרים אוטומטית', 400));
            
            const newRoom = await Room.create({
                hotel: hotelId,
                roomNumber: roomNum,
                roomType: defaultType._id,
                status: 'dirty', // חדר חדש נוצר כמלוכלך כדי שייבדק
                tasks: [] // יקבל משימות כשנריץ עליו סטטוס או הפצה
            });
            roomId = newRoom._id;
            roomMap.set(roomNum, newRoom);
            createdRooms.push(roomNum);
        }

        // בדיקת חפיפות (Booking Overlap)
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
                roomNumber: roomNum, // שומרים גם כטקסט ליתר ביטחון
                arrivalDate: start,
                departureDate: end,
                pax,
                babies,
                source: 'excel'
            });
        }
    }

    // מצב סימולציה (Dry Run)
    if (String(dryRun) === 'true') {
        return res.json({
            status: 'simulation',
            conflicts,
            validCount: newBookings.length,
            newRoomsCreated: createdRooms
        });
    }

    // שמירה בפועל
    if (newBookings.length > 0) {
        await Booking.insertMany(newBookings);
    }

    res.json({
        status: 'success',
        message: `נקלטו ${newBookings.length} הזמנות. חדרים חדשים: ${createdRooms.length}`,
        conflicts: conflicts,
        createdRooms
    });
});

// --- 2. שליפת דשבורד יומי (תצוגה בלבד ל-DailyPlanPage) ---
export const getDailyDashboard = catchAsync(async (req, res, next) => {
    const { hotelId, date } = req.query;
    if (!hotelId) return next(new AppError('חסר מזהה מלון', 400));

    const queryDate = date ? normalizeDate(date) : normalizeDate(new Date());

    const rooms = await Room.find({ hotel: hotelId })
        .populate('assignedTo', 'name')
        .populate('roomType', 'name')
        .lean();

    // שליפת כל ההזמנות ש"נוגעות" בתאריך הזה
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

    // עיבוד הנתונים לתצוגה (סטטוס לוגי: הגעה/עזיבה)
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
            calculatedStatus = 'back_to_back'; // תחלופה
            specialInfo = {
                out: departures[0].pax,
                in: arrivals[0].pax,
                pax: arrivals[0].pax, // להכנה
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
                out: departures[0].pax
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
            dashboardStatus: calculatedStatus, // לשימוש בצבעים ב-UI
            bookingInfo: specialInfo
        };
    });

    // מיון לפי מספר חדר
    dashboardData.sort((a, b) => 
        a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
    );

    res.json(dashboardData);
});

// --- 3. פתרון התנגשויות (דריסה) ---
export const resolveConflict = catchAsync(async (req, res, next) => {
    const { action, conflictData } = req.body;
    
    if (action === 'overwrite') {
        const { existingBookingId, newBookingData } = conflictData;
        
        // ביטול הישן
        await Booking.findByIdAndUpdate(existingBookingId, { status: 'cancelled' });
        
        // יצירת החדש
        await Booking.create({ 
            ...newBookingData, 
            status: 'active', 
            source: 'manual_fix' 
        });
        
        res.json({ message: 'השיבוץ תוקן בהצלחה.' });
    } else {
        res.json({ message: 'ההתנגשות נשמרה (החדש נדחה).' });
    }
});

// --- 4. הקצאה לחדרנית (רק השיוך, לא המשימות) ---
export const assignRoomsToHousekeeper = catchAsync(async (req, res, next) => {
    const { roomIds, userId } = req.body;

    await Room.updateMany(
        { _id: { $in: roomIds } },
        { 
            $set: { 
                assignedTo: userId || null,
                assignmentDate: normalizeDate(new Date()) 
            }
        }
    );

    res.json({ message: 'החדרים הוקצו בהצלחה.' });
});