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
        const roomNum = String(row['c_room_number'] || '').trim();
        if (!roomNum || roomNum === '0') continue;

        const arrival = row['c_arrival_date'];
        const departure = row['c_depart_date'];

        if (!arrival || !departure) continue;

        const start = normalizeDate(arrival);
        const end = normalizeDate(departure);
        
        // ✨✨✨ התיקון הגדול: סיכום העמודות הנפרדות ✨✨✨
        const adults = parseInt(row['c_adults'] || 0);
        const juniors = parseInt(row['c_juniors'] || 0);
        const children = parseInt(row['c_children'] || 0);
        
        // סך הכל מיטות = מבוגרים + נוער + ילדים
        let pax = adults + juniors + children;

        // הגנה: אם יצא 0 (אולי השמות באקסל שונים?), ננסה למצוא עמודת סיכום ישנה כגיבוי
        if (pax === 0) {
             pax = parseInt(row['total_pax'] || row['Total Pax'] || 0);
        }
        
        // אם עדיין 0, נגדיר מינימום 1 כדי שלא יופיע "0 מיטות"
        if (pax === 0) pax = 1;

        const babies = parseInt(row['c_babies'] || 0);

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
                pax, // המספר המסוכם יישמר כאן
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
                pax: arrivals[0].pax, // המספר החדש שחישבנו
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
                pax: 0 // בעזיבה אין מיטות להכנה ללילה
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

// --- פונקציות עזר (ללא שינוי, אך חובה שיהיו בקובץ) ---
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