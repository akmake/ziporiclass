import LeadTrigger from '../../models/LeadTrigger.js';
import { catchAsync } from '../../middlewares/errorHandler.js';

export const getTriggers = catchAsync(async (req, res) => {
  const triggers = await LeadTrigger.find({}).sort({ createdAt: -1 });
  res.json(triggers);
});

export const addTrigger = catchAsync(async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'חסר טקסט' });

  // בדיקת כפילות
  const exists = await LeadTrigger.findOne({ text: text.toLowerCase().trim() });
  if (exists) return res.status(400).json({ message: 'הביטוי כבר קיים במערכת' });

  const trigger = await LeadTrigger.create({
    text: text.toLowerCase().trim(),
    createdBy: req.user._id
  });
  res.status(201).json(trigger);
});

export const deleteTrigger = catchAsync(async (req, res) => {
  await LeadTrigger.findByIdAndDelete(req.params.id);
  res.json({ message: 'נמחק בהצלחה' });
});