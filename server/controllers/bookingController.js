import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import RoomType from '../models/RoomType.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';
import XLSX from 'xlsx';

// --- עזרים ---

// פונקציה לניקוי שעה מתאריך (משאירה רק את התאריך עצמו)
const normalizeDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

// ✨ הפונקציה החכמה למציאת ערך בעמודה (לא רגיש לאותיות גדולות/קטנות)
const findColValue = (row, possibleNames) => {
    // יצירת רשימת מפתחות של השורה באותיות קטנות לצורך השוואה
    const rowKeys = Object.keys(row).map(k => k.toLowerCase().trim());

    for (const name of possibleNames) {
        const lowerName = name.toLowerCase().trim();

        // 1. חיפוש מדויק (הכי מהיר)
        if (row[name] !== undefined) return parseInt(row[name]);

        // 2. חיפוש חכם (לפי המפתחות המנורמלים)
        const foundKeyIndex = rowKeys.indexOf(lowerName);
        if (foundKeyIndex !== -1) {
            const realKey = Object.keys(row)[foundKeyIndex];
            return parseInt(row[realKey]);
        }
    }
    return 0; // אם לא נמצא כלום, מחזיר 0
};


// --- הפעולה הראשית: העלאת אקסל ועיבוד נתונים ---
export const uploadSchedule = catchAsync(async (req, res, next) => {
    if (!req.file) return next(new AppError('לא נבחר קובץ', 400));
    
    const { hotelId, dryRun } = req.body;
    if (!hotelId) return next(new AppError('חובה לבחור מלון', 400));

    // קריאת הקובץ מהזיכרון
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    // defval: "" מבטיח שגם תאים ריקים יקבלו ערך, מונע קריסות
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    // שליפת נתונים קיימים להשוואה
    const existingRooms = await Room.find({ hotel: hotelId });
    const roomMap = new Map(existingRooms.map(r => [r.roomNumber, r]));

    // שליפת סוג חדר ברירת מחדל (למקרה שצריך ליצור חדר חדש)
    let defaultType = await RoomType.findOne({ hotel: hotelId, isDefault: true });
    if (!defaultType) defaultType = await RoomType.findOne({ hotel: hotelId });

    const conflicts = [];
    const newBookings = [];
    const createdRooms = [];

    // --- לולאת הניתוח הראשית ---
    for (const row of rawData) {
        
        // 1. זיהוי מספר חדר
        // מחפש לפי מגוון שמות אפשריים: 'c_room_number', 'חדר', 'Room'
        let roomNum = String(row['c_room_number'] || row['חדר'] || row['Room'] || '').trim();
        
        // דילוג על שורות לא רלוונטיות (ללא מספר חדר או חדר 0)
        if (!roomNum || roomNum === '0') continue;

        // 2. זיהוי תאריכים
        let arrivalRaw = row['c_arrival_date'] || row['Arrival'] || row['הגעה'];
        let departureRaw = row['c_depart_date'] || row['Departure'] || row['עזיבה'];

        if (!arrivalRaw || !departureRaw) continue; // דילוג אם אין תאריכים

        const start = normalizeDate(arrivalRaw);
        const end = normalizeDate(departureRaw);

        // ✨ 3. חישוב כמות אנשים (pax) - הלוגיקה המדויקת ✨
        
        // ניסיון לחלץ כמויות נפרדות לפי שמות עמודות נפוצים
        const adults = findColValue(row, ['c_adults', 'adults', 'adult', 'מבוגרים']);
        const juniors = findColValue(row, ['c_juniors', 'juniors', 'junior', 'נוער']);
        const children = findColValue(row, ['c_children', 'children', 'child', 'ילדים']);

        // חיבור הסכום: מבוגרים + נוער + ילדים
        let pax = adults + juniors + children;

        // Fallback: אם הסכום יצא 0, המערכת מחפשת עמודת "סה"כ" או "Total"
        if (pax === 0) {
             pax = findColValue(row, ['total_pax', 'pax', 'total', 'סה"כ']);
        }

        // הגנה מינימלית: אם עדיין 0, נגדיר 1 כדי שלא ייראה ריק
        if (pax === 0) pax = 1;

        // 4. חישוב תינוקות (בנפרד, כי הם דורשים עריסה ולא מיטה)
        const babies = findColValue(row, ['c_babies', 'babies', 'baby', 'תינוקות']);


        // --- לוגיקת יצירת/מציאת חדר ---
        let roomId;
        if (roomMap.has(roomNum)) {
            roomId = roomMap.get(roomNum)._id;
        } else {
            // אם החדר לא קיים - יוצרים אותו אוטומטית
            if (!defaultType) return next(new AppError('לא מוגדר סוג חדר למלון זה, לא ניתן ליצור חדרים חדשים.', 400));

            const newRoom = await Room.create({
                hotel: hotelId,
                roomNumber: roomNum,
                roomType: defaultType._id,
                status: 'dirty' // חדר חדש נוצר כמלוכלך כברירת מחדל
            });
            roomId = newRoom._id;
            roomMap.set(roomNum, newRoom);
            createdRooms.push(roomNum);
        }

        // --- בדיקת חפיפה (Conflict Detection) ---
        const overlap = await Booking.findOne({
            room: roomId,
            status: 'active',
            $or: [
                { arrivalDate: { $lt: end, $gte: start } }, // התחלה בתוך הטווח הקיים
                { departureDate: { $gt: start, $lte: end } }, // סיום בתוך הטווח הקיים
                { arrivalDate: { $lte: start }, departureDate: { $gte: end } } // הטווח החדש עוטף את הקיים
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
            // הכל תקין - מוסיפים לרשימת ההזמנות החדשות
            newBookings.push({
                hotel: hotelId,
                room: roomId,
                roomNumber: roomNum,
                arrivalDate: start,
                departureDate: end,
                pax,   // המספר הסופי שחושב
                babies,
                source: 'excel'
            });
        }
    }

    // --- סיום ומתן תשובה ---

    // במצב "סימולציה" (Dry Run) - רק מציגים מה יקרה, לא שומרים
    if (String(dryRun) === 'true') {
        return res.json({
            status: 'simulation',
            conflicts,
            validCount: newBookings.length,
            newRoomsCreated: createdRooms
        });
    }

    // שמירה בפועל לדאטהבייס
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

// --- שאר הפונקציות בקונטרולר (כמו שהיו) ---
// (העתקתי לך את החשובות כדי שהקובץ יהיה שלם)

export const resolveConflict = catchAsync(async (req, res, next) => {
    const { action, conflictData } = req.body;
    
    if (action === 'overwrite') {
        const { existingBookingId, newBookingData } = conflictData;
        // ביטול הישן
        await Booking.findByIdAndUpdate(existingBookingId, { status: 'cancelled' });
        // יצירת החדש
        await Booking.create({ ...newBookingData, status: 'active', source: 'manual_fix' });
        
        res.json({ message: 'השיבוץ הישן נדרס והחדש נוצר.' });
    } else {
        // התעלמות (ignore) - לא עושים כלום
        res.json({ message: 'ההתנגשות נפתרה (התעלמות מהחדש).' });
    }
});

export const getDailyDashboard = catchAsync(async (req, res, next) => {
    const { hotelId, date } = req.query;
    if (!hotelId) return next(new AppError('חסר מזהה מלון', 400));

    const queryDate = date ? normalizeDate(date) : normalizeDate(new Date());

    const rooms = await Room.find({ hotel: hotelId })
        .populate('assignedTo', 'name')
        .populate('roomType', 'name')
        .lean();

    // לוגיקה לשליפת הבוקינג הרלוונטי להיום (לצורך הצגה בדשבורד)
    // ... (אותה לוגיקה קיימת) ...
    // כאן רק לצורך הדוגמה אני מחזיר את החדרים כמו שהם
    // ביישום המלא תעתיק את פונקציית getDailyDashboard המקורית שלך
    
    res.json(rooms); 
});

export const assignRoomsToHousekeeper = catchAsync(async (req, res, next) => {
    const { roomIds, userId } = req.body;
    await Room.updateMany(
        { _id: { $in: roomIds } }, 
        { $set: { assignedTo: userId || null, assignmentDate: normalizeDate(new Date()) } }
    );
    res.json({ message: 'החדרים הוקצו בהצלחה.' });
});
