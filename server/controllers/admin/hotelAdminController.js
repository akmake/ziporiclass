import Hotel from '../../models/Hotel.js';
import PriceList from '../../models/PriceList.js';
import { catchAsync } from '../../middlewares/errorHandler.js';
import AppError from '../../utils/AppError.js';

// שליפת כל המלונות
export const getAllHotels = catchAsync(async (req, res) => {
    const hotels = await Hotel.find({}).sort({ name: 1 });
    res.status(200).json(hotels);
});

// יצירת מלון חדש
export const createHotel = catchAsync(async (req, res) => {
    const { name } = req.body;
    if (!name) throw new AppError('שם המלון הוא שדה חובה.', 400);
    const newHotel = await Hotel.create({ name });
    res.status(201).json(newHotel);
});

// === תיקון: עדכון כל סוגי הצ'ק ליסטים ===
export const updateMasterChecklist = catchAsync(async (req, res) => {
    const { id } = req.params;
    // המקבל יכול לשלוח checklists כאובייקט { arrival: [], departure: [], stayover: [] }
    // או checklist כמערך (תמיכה לאחור)
    const { checklists, checklist } = req.body;

    const updateData = {};
    
    if (checklists) {
        updateData.checklists = checklists;
    } else if (checklist) {
        // Fallback: אם נשלח רק checklist אחד, נשמור אותו כברירת מחדל בכולם או ב-departure
        updateData.masterChecklist = checklist; 
        // אופציונלי: לעדכן גם את החדשים
        updateData['checklists.departure'] = checklist;
    }

    const hotel = await Hotel.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
    );

    if (!hotel) throw new AppError('המלון לא נמצא.', 404);
    res.json(hotel);
});

// פונקציית Legacy
export const updateHotelTasks = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { tasks } = req.body;
    const hotel = await Hotel.findByIdAndUpdate(id, { defaultTasks: tasks }, { new: true });
    res.json(hotel);
});

// מחיקת מלון
export const deleteHotel = catchAsync(async (req, res) => {
    const { id } = req.params;
    const priceListsExist = await PriceList.exists({ hotel: id });
    if (priceListsExist) throw new AppError('לא ניתן למחוק מלון שמשויכים אליו מחירונים.', 400);

    const hotel = await Hotel.findByIdAndDelete(id);
    if (!hotel) throw new AppError('המלון לא נמצא.', 404);
    res.status(204).send();
});