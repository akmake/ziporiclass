import XLSX from 'xlsx';
import Room from '../models/Room.js';

// פונקציית העזר המקורית שלך - היא מצוינת, שמרתי אותה
const findColValue = (row, possibleNames) => {
    if (!row || typeof row !== 'object') return null;
    const rowKeys = Object.keys(row).map(k => k.toLowerCase().trim());
    for (const name of possibleNames) {
        if (row[name] !== undefined) return row[name];
        const lowerName = name.toLowerCase();
        const foundKeyIndex = rowKeys.indexOf(lowerName);
        if (foundKeyIndex !== -1) {
            const realKey = Object.keys(row)[foundKeyIndex];
            return row[realKey];
        }
    }
    return null;
};

const normalizeDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
};

export const uploadSchedule = async (req, res) => {
    // הגנה קריטית: בדיקה שהקובץ קיים בזיכרון
    if (!req.file || !req.file.buffer) {
        return res.status(400).json({ message: 'שגיאה: לא התקבל קובץ בשרת (req.file חסר)' });
    }

    try {
        const { hotelId } = req.body;
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        // defval: "" חשוב כדי לא לקבל undefined על תאים ריקים
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

        const today = normalizeDate(new Date());
        let updatedCount = 0;

        for (const row of rawData) {
            // 1. זיהוי מספר חדר (לוגיקה מהקוד המקורי שלך)
            let roomNum = findColValue(row, ['c_room_number', 'חדר', 'Room']);
            roomNum = String(roomNum || '').trim();

            // הסינון שביקשת: מדלגים על 0, 00, או ריק
            if (!roomNum || roomNum === '0' || roomNum === '00') continue;

            // 2. זיהוי תאריכים
            const arrivalRaw = findColValue(row, ['c_arrival_date', 'Arrival', 'הגעה']);
            const departureRaw = findColValue(row, ['c_depart_date', 'Departure', 'עזיבה']);
            
            const start = normalizeDate(arrivalRaw);
            const end = normalizeDate(departureRaw);

            // אם אין תאריכים, אי אפשר לחשב סטטוס - נדלג (או נשאיר סטטוס קיים)
            if (!start || !end) continue;

            // 3. חילוץ הרכב (Pax)
            const adults = parseInt(findColValue(row, ['c_adults', 'adults', 'מבוגרים']) || 0);
            const children = parseInt(findColValue(row, ['c_children', 'children', 'ילדים']) || 0);
            const babies = parseInt(findColValue(row, ['c_babies', 'babies', 'תינוקות']) || 0);
            const guestName = findColValue(row, ['c_guest_name', 'Guest', 'שם', 'שם אורח']) || '';

            const totalPax = adults + children;

            // 4. חישוב סטטוס להיום
            let status = 'stayover';
            const isArr = start.getTime() === today.getTime();
            const isDep = end.getTime() === today.getTime();

            if (isArr && isDep) status = 'back_to_back';
            else if (isArr) status = 'arrival';
            else if (isDep) status = 'departure';

            // 5. בניית משימות (משתמש במבנה ה-tasks הקיים במודל שלך)
            const tasks = [];

            // משימות בסיס
            if (status === 'departure' || status === 'back_to_back') {
                tasks.push({ description: 'ניקיון יסודי (צ\'ק אאוט)', type: 'standard', isCompleted: false });
                tasks.push({ description: 'החלפת מצעים ומגבות', type: 'standard', isCompleted: false });
            } else if (status === 'stayover') {
                tasks.push({ description: 'ריענון חדר', type: 'standard', isCompleted: false });
            } else if (status === 'arrival') {
                tasks.push({ description: 'בדיקת חדר לפני כניסה', type: 'standard', isCompleted: false });
            }

            // לוגיקה חכמה: מיטות ולולים
            if (status === 'arrival' || status === 'back_to_back') {
                if (totalPax > 2) {
                    tasks.unshift({ 
                        description: `⚠️ להוסיף ${totalPax - 2} מיטות`, 
                        type: 'special', // זה ה-Enum הקיים במודל שלך
                        isCompleted: false 
                    });
                }
                if (babies > 0) {
                    tasks.unshift({ 
                        description: `👶 להוסיף ${babies} לולים`, 
                        type: 'special', 
                        isCompleted: false 
                    });
                }
            }

            // 6. עדכון המסד
            // שימוש ב-updateOne עם upsert כדי ליצור חדרים חסרים
            await Room.updateOne(
                { hotel: hotelId, roomNumber: roomNum },
                {
                    $set: {
                        status: 'dirty', // תמיד מתחיל מלוכלך כשיש עדכון
                        tasks: tasks,    // דריסת המשימות הישנות
                        currentGuest: {
                            pax: totalPax,
                            babies: babies,
                            status: status, // arrival/departure...
                            arrival: start,
                            departure: end,
                            name: guestName
                        },
                        lastUpdated: new Date()
                    }
                },
                { upsert: true }
            );
            updatedCount++;
        }

        res.json({ message: 'הקובץ עובד בהצלחה', roomsProcessed: updatedCount });

    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ message: "שגיאה בעיבוד: " + error.message });
    }
};