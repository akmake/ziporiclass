import RateHistory from '../models/RateHistory.js';

export const updatePrimeRate = async (req, res, next) => {
  try {
    const { rate, date } = req.body;
    if (rate === undefined || !date) {
      return res.status(400).json({ message: 'Rate and date are required.' });
    }

    // `findOneAndUpdate` עם `upsert` יעדכן אם קיים תאריך זהה, או ייצור רשומה חדשה
    const newRate = await RateHistory.findOneAndUpdate(
      { date: new Date(date), indexName: 'prime' },
      { rate: parseFloat(rate) },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Prime rate updated successfully.', rate: newRate });
  } catch (error) {
    next(error);
  }
};