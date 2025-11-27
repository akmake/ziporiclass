// server/controllers/announcementController.js
import Announcement from '../models/Announcement.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';

/**
 * @desc    קבלת הודעות ציבוריות רלוונטיות למשתמש המחובר
 * @route   GET /api/announcements
 * @access  Private (User)
 */
export const getPublicAnnouncements = catchAsync(async (req, res, next) => {
  const now = new Date();

  const announcements = await Announcement.find({
    $and: [
      // תנאי 1: ההודעה מיועדת לכולם או ספציפית למשתמש הזה
      { $or: [
          { target: 'all' },
          { targetUser: req.user._id }
        ]
      },
      // תנאי 2: ההודעה לא פגה (או שאין לה תאריך תפוגה)
      { $or: [
          { expiresAt: { $gt: now } },
          { expiresAt: null }
        ]
      }
    ]
  }).sort({ createdAt: -1 }); // החדש ביותר למעלה

  res.status(200).json(announcements);
});

/**
 * @desc    קבלת כל ההודעות (לממשק ניהול)
 * @route   GET /api/announcements/all
 * @access  Admin
 */
export const getAllAnnouncements = catchAsync(async (req, res, next) => {
  const announcements = await Announcement.find()
    .populate('targetUser', 'name email')
    .sort({ createdAt: -1 });
  
  res.status(200).json(announcements);
});

/**
 * @desc    יצירת הודעה חדשה
 * @route   POST /api/announcements
 * @access  Admin
 */
export const createAnnouncement = catchAsync(async (req, res, next) => {
  const { title, content, target, targetUser, expiresAt } = req.body;

  if (!title || !content) {
    return next(new AppError('כותרת ותוכן הם שדות חובה.', 400));
  }

  const announcement = await Announcement.create({
    title,
    content,
    target,
    // אם היעד הוא משתמש ספציפי, חובה לשמור את ה-ID שלו
    targetUser: target === 'user' ? targetUser : null,
    expiresAt: expiresAt || null,
    authorName: req.user.name // נלקח אוטומטית מהמשתמש המחובר
  });

  res.status(201).json(announcement);
});

/**
 * @desc    עדכון הודעה קיימת
 * @route   PUT /api/announcements/:id
 * @access  Admin
 */
export const updateAnnouncement = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { title, content, target, targetUser, expiresAt } = req.body;
  
    if (!title || !content) {
      return next(new AppError('כותרת ותוכן הם שדות חובה.', 400));
    }
  
    const announcement = await Announcement.findByIdAndUpdate(
      id,
      {
        title,
        content,
        target,
        targetUser: target === 'user' ? targetUser : null,
        expiresAt: expiresAt || null
      },
      { new: true, runValidators: true }
    );
  
    if (!announcement) {
      return next(new AppError('הודעה לא נמצאה.', 404));
    }
  
    res.status(200).json(announcement);
  });

/**
 * @desc    מחיקת הודעה
 * @route   DELETE /api/announcements/:id
 * @access  Admin
 */
export const deleteAnnouncement = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const announcement = await Announcement.findByIdAndDelete(id);

  if (!announcement) {
    return next(new AppError('הודעה לא נמצאה.', 404));
  }

  res.status(204).send();
});