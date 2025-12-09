import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import RoomType from '../models/RoomType.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';
import XLSX from 'xlsx';

// --- עזרים ---
const normalizeDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

// ✨ הפונקציה החכמה למציאת ערך בעמודה (לא רגיש לאותיות גדולות/קטנות)
const findColValue = (row, possibleNames) => {
    const rowKeys = Object.keys(row).map(k => k.toLowerCase().trim());
    for (const name of possibleNames) {
        const lowerName = name.toLowerCase().trim();
        // 1. חיפוש מדויק
        if (row[name] !== undefined) return parseInt(row[name]);
        // 2. חיפוש חכם
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
    console.log("--- STARTING UPLOAD PROCESS ---");

    if (!req.file) return next(new AppError('לא נבחר קובץ', 400));
    const { hotelId, dryRun } = req.body;

    if (!hotelId) return next(new AppError('חובה לבחור מלון', 400));

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    console.log(`Excel Loaded. Rows found: ${rawData.length}`);

    const existingRooms = await Room.find({ hotel: hotelId });
    const roomMap = new Map(existingRooms.map(r => [r.roomNumber, r]));

    let defaultType = await RoomType.findOne({ hotel: hotelId, isDefault: true });
    if (!defaultType) defaultType = await RoomType.findOne({ hotel: hotelId });

    const conflicts = [];
    const newBookings = [];
    const createdRooms = [];

    let loopCount = 0;
    for (const row of rawData) {
        loopCount++;
        const shouldLog = loopCount <= 5; // נדפיס לוג רק ל-5 שורות ראשונות

        // 1. זיהוי מספר חדר
        let roomNum = String(row['c_room_number'] || row['חדר'] || row['Room'] || '').trim();
        if (!roomNum || roomNum === '0') {
            if (shouldLog) console.log(`Skipping row ${loopCount}: No room number`);
            continue;
        }

        // 2. זיהוי תאריכים
        let arrival = row['c_arrival_date'] || row['Arrival'] || row['הגעה'];
        let departure = row['c_depart_date'] || row['Departure'] || row['עזיבה'];

        if (!arrival || !departure) {
             if (shouldLog) console.log(`Skipping row ${loopCount} (Room ${roomNum}): No dates`);
             continue;
        }

        const start = normalizeDate(arrival);
        const end = normalizeDate(departure);
        
        if (shouldLog) console.log(`Processing Room ${roomNum}: ${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`);

        // 3. חישוב כמות אנשים (PAX)
        const adults = findColValue(row, ['c_adults', 'adults', 'adult', 'מבוגרים']);
        const juniors = findColValue(row, ['c_juniors', 'juniors', 'junior', 'נוער']);
        const children = findColValue(row, ['c_children', 'children', 'child', 'ילדים']);

        let pax = adults + juniors + children;
        if (pax === 0) {
             pax = findColValue(row, ['total_pax', 'pax', 'total', 'סה"כ']);
        }
        if (pax === 0) pax = 1;

        const babies = findColValue(row, ['c_babies', 'babies', 'baby', 'תינוקות']);

        // 4. מציאת/יצירת חדר
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

// --- 2. קבלת דשבורד יומי (שוחזר מהמקור) ---
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

// --- פונקציות עזר נוספות (שוחזרו מהמקור) ---
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

export const assignRoomsToHousekeeper = catchAsync(async (req, res, next) => {
    const { roomIds, userId } = req.body;
    await Room.updateMany({ _id: { $in: roomIds } }, { $set: { assignedTo: userId || null, assignmentDate: normalizeDate(new Date()) } });
    res.json({ message: 'החדרים הוקצו בהצלחה.' });
});
