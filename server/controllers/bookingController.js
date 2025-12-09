import XLSX from 'xlsx';
import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js'; // צריך כדי לשלוף צ'ק ליסטים קבועים אם נרצה בעתיד

// --- עזרים ---
const normalizeDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    // תיקון איזור זמן פשוט כדי לוודא שהיום הוא היום
    date.setHours(0, 0, 0, 0);
    return date;
};

// פונקציה חכמה למציאת ערך בעמודה (גם אם השם באקסל טיפה שונה)
const findValue = (row, possibleHeaders) => {
    const keys = Object.keys(row);
    for (const header of possibleHeaders) {
        // חיפוש מדויק או מכיל
        const foundKey = keys.find(k => k.trim() === header || k.toLowerCase().includes(header.toLowerCase()));
        if (foundKey) return row[foundKey];
    }
    return null;
};

// --- הלוגיקה הראשית ---
export const uploadDailyReport = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "לא נבחר קובץ" });
        const { hotelId } = req.body;

        // 1. קריאת האקסל מהזיכרון
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const today = normalizeDate(new Date());
        let updatedCount = 0;

        // 2. ריצה על כל שורה
        for (const row of rawData) {
            
            // >> תנאי סינון 1: חילוץ מספר חדר <<
            let roomNum = findValue(row, ['חדר', 'Room', 'Room Number']);
            roomNum = String(roomNum || '').trim();

            // >> תנאי סינון 2: אם החדר הוא 0, ריק, או לא קיים - מדלגים <<
            if (!roomNum || roomNum === '0' || roomNum === '00') {
                continue; 
            }

            // 3. חילוץ נתונים
            const guestName = findValue(row, ['שם', 'Guest Name']) || 'אורח';
            const adults = parseInt(findValue(row, ['מבוגרים', 'Adults']) || 0);
            const children = parseInt(findValue(row, ['ילדים', 'Children']) || 0);
            const babies = parseInt(findValue(row, ['תינוקות', 'Babies']) || 0);
            
            // תאריכים
            const arrivalRaw = findValue(row, ['הגעה', 'Arrival']);
            const departureRaw = findValue(row, ['עזיבה', 'Departure']);
            const arrivalDate = normalizeDate(arrivalRaw);
            const departureDate = normalizeDate(departureRaw);

            const totalPax = adults + children;

            // 4. חישוב סטטוס (הגעה/עזיבה/שוהה)
            let resStatus = 'stayover'; // ברירת מחדל: שוהה

            const isArrivingToday = arrivalDate && arrivalDate.getTime() === today.getTime();
            const isDepartingToday = departureDate && departureDate.getTime() === today.getTime();

            if (isArrivingToday && isDepartingToday) {
                resStatus = 'back_to_back'; // תחלופה (נדיר)
            } else if (isArrivingToday) {
                resStatus = 'arrival';
            } else if (isDepartingToday) {
                resStatus = 'departure';
            }

            // 5. בניית משימות חכמות (The Dynamic Checklist)
            const tasks = [];

            // -- שלב א': משימות בסיס לפי סטטוס --
            if (resStatus === 'departure' || resStatus === 'back_to_back') {
                tasks.push({ description: 'החלפת מצעים מלאה', type: 'standard' });
                tasks.push({ description: 'ניקיון שירותים ומקלחת יסודי', type: 'standard' });
                tasks.push({ description: 'החלפת מגבות ומוצרי טואלטיקה', type: 'standard' });
            } else if (resStatus === 'stayover') {
                tasks.push({ description: 'סידור מיטה (מתיחה)', type: 'standard' });
                tasks.push({ description: 'ריקון פחים', type: 'standard' });
                tasks.push({ description: 'החלפת מגבות (אם על הרצפה)', type: 'standard' });
            } else if (resStatus === 'arrival') {
                 tasks.push({ description: 'בדיקת חדר לפני כניסה (ריח/מזגן)', type: 'standard' });
            }

            // -- שלב ב': תוספות חכמות (רק בהגעה או תחלופה) --
            // אם אורח נכנס היום, צריך להכין לו את החדר לפי ההרכב
            if (resStatus === 'arrival' || resStatus === 'back_to_back') {
                
                // לוגיקת מיטות: נניח בסיס של 2 אנשים בחדר. כל אדם מעל 2 צריך מיטה.
                if (totalPax > 2) {
                    const extraBeds = totalPax - 2;
                    tasks.unshift({ 
                        description: `⚠️ להוסיף ${extraBeds} מיטות/ספות`, 
                        type: 'special',
                        isBlocking: true // חוסם!
                    });
                }

                // לוגיקת תינוקות
                if (babies > 0) {
                    tasks.unshift({ 
                        description: `👶 להוסיף ${babies} לולים/עריסות`, 
                        type: 'special',
                        isBlocking: true // חוסם!
                    });
                }
            }

            // 6. שמירה לדאטה-בייס (Upsert - מעדכן אם קיים, יוצר אם חדש)
            // אנחנו מאפסים את הסטטוס ל-'dirty' כי הגיע יום חדש ויש משימות
            await Room.findOneAndUpdate(
                { hotel: hotelId, roomNumber: roomNum },
                {
                    $set: {
                        status: 'dirty', 
                        currentGuest: {
                            name: guestName,
                            pax: totalPax,
                            babies: babies,
                            arrivalDate,
                            departureDate,
                            reservationStatus: resStatus
                        },
                        dailyTasks: tasks, // דריסת המשימות של אתמול בחדשות
                        lastUpdated: new Date()
                    }
                },
                { upsert: true, new: true } // Upsert = אם החדר לא קיים במערכת, צור אותו
            );
            updatedCount++;
        }

        res.json({ message: 'הקובץ עובד בהצלחה', roomsProcessed: updatedCount });

    } catch (error) {
        console.error("Excel Error:", error);
        res.status(500).json({ message: "שגיאה בעיבוד הקובץ: " + error.message });
    }
};
