// server/controllers/admin/roomTypeController.js
import RoomType from '../../models/RoomType.js';
import { catchAsync } from '../../middlewares/errorHandler.js';
import AppError from '../../utils/AppError.js';

// קבלת כל סוגי החדרים של מלון מסוים
export const getRoomTypesByHotel = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;

  // שליפה מה-DB ומיון לפי המחיר (מהזול ליקר)
  const roomTypes = await RoomType.find({ hotel: hotelId }).sort({ supplementPerNight: 1 });

  res.status(200).json(roomTypes);
});

// יצירת סוג חדר חדש
export const createRoomType = catchAsync(async (req, res, next) => {
  const { hotel, name, supplementPerNight, isDefault } = req.body;

  if (!hotel || !name) {
    return next(new AppError('מלון ושם חדר הם שדות חובה.', 400));
  }

  try {
    // אם סומן כברירת מחדל, נסיר את הסימון מאחרים באותו מלון
    if (isDefault) {
      await RoomType.updateMany({ hotel }, { isDefault: false });
    }

    const newRoomType = await RoomType.create({
      hotel,
      name,
      supplementPerNight: Number(supplementPerNight) || 0,
      isDefault: !!isDefault
    });

    res.status(201).json(newRoomType);
  } catch (error) {
    // טיפול בשגיאת כפילות (שם חדר קיים באותו מלון)
    if (error.code === 11000) {
      return next(new AppError('סוג חדר בשם זה כבר קיים במלון שנבחר.', 400));
    }
    // העברת שאר השגיאות לטיפול הכללי
    throw error;
  }
});

// עדכון סוג חדר קיים
export const updateRoomType = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, supplementPerNight, isDefault, hotel } = req.body;

  try {
    // אם מעדכנים ל-Default, צריך לאפס את האחרים
    if (isDefault && hotel) {
       await RoomType.updateMany({ hotel }, { isDefault: false });
    }
  
    const updatedRoomType = await RoomType.findByIdAndUpdate(id, {
      name,
      supplementPerNight,
      isDefault
    }, {
      new: true, // החזר את האובייקט המעודכן
      runValidators: true
    });
  
    if (!updatedRoomType) {
      return next(new AppError('סוג חדר לא נמצא.', 404));
    }
  
    res.status(200).json(updatedRoomType);
  } catch (error) {
     if (error.code === 11000) {
        return next(new AppError('סוג חדר בשם זה כבר קיים במלון שנבחר.', 400));
      }
      throw error;
  }
});

// מחיקת סוג חדר
export const deleteRoomType = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deleted = await RoomType.findByIdAndDelete(id);

  if (!deleted) {
    return next(new AppError('סוג חדר לא נמצא.', 404));
  }

  res.status(204).send();
});