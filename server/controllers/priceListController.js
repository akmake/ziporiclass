import PriceList from '../models/PriceList.js';

/**
 * @desc    קבלת כל המחירונים (עם סינון לפי מלון, פעיל/לא פעיל ומיון)
 * @route   GET /api/pricelists?hotelId=:hotelId&active=true
 * @access  Private
 */
export const getAllPriceLists = async (req, res) => {
  try {
    const { hotelId, active } = req.query;
    const filter = {};
    
    if (hotelId) {
      filter.hotel = hotelId;
    }

    // ✨ אם נשלח הפרמטר active=true, נחזיר רק מחירונים גלויים
    if (active === 'true') {
      filter.isVisible = true;
    }

    console.log(`Fetching price lists from MongoDB with filter:`, filter);

    // ✨ מיון: קודם לפי displayOrder (עולה), ואז לפי שם (אם הסדר זהה)
    const priceListsFromDB = await PriceList.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .populate('hotel', 'name');
      
    res.json(priceListsFromDB);
  } catch (dbError) {
    console.error('Failed to fetch price lists from MongoDB.', dbError);
    res.status(500).json({ message: "שגיאה בטעינת המחירונים." });
  }
};

/**
 * @desc    יצירת מחירון חדש
 * @route   POST /api/pricelists
 * @access  Private (דורש הרשאת ניהול מחירונים)
 */
export const createPriceList = async (req, res) => {
  // ✨ הוספנו את displayOrder ו-isVisible
  const { name, couple, teen, child, baby, single_room, hotel, maxNights, displayOrder, isVisible } = req.body;

  if (!name || !hotel) {
    return res.status(400).json({ message: "שם המחירון ושיוך למלון הם שדות חובה" });
  }

  try {
    const newPriceListInMongo = await PriceList.create({
      name,
      hotel,
      couple,
      teen,
      child,
      baby,
      single_room,
      maxNights: maxNights || 0,
      displayOrder: displayOrder || 0, // ✨ שמירת הסדר
      isVisible: isVisible !== undefined ? isVisible : true, // ✨ שמירת הנראות
      user: req.user.id,
    });
    res.status(201).json(newPriceListInMongo);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "שם מחירון זה כבר קיים עבור המלון שנבחר." });
    }
    res.status(500).json({ message: "שגיאה ביצירת המחירון." });
  }
};

/**
 * @desc    עדכון מחירון קיים
 * @route   PUT /api/pricelists/:id
 * @access  Private (דורש הרשאת ניהול מחירונים)
 */
export const updatePriceList = async (req, res) => {
  const { id } = req.params;
  // מפרקים את הגוף כדי לאפשר עדכון של כל השדות
  const { name, ...otherFields } = req.body;

  if (!name) {
    return res.status(400).json({ message: "שם המחירון הוא שדה חובה" });
  }

  try {
     const findQuery = { _id: id };
     if (req.user.role !== 'admin') {
        findQuery.user = req.user.id;
     }

    const updatedPriceList = await PriceList.findOneAndUpdate(
      findQuery,
      { name, ...otherFields }, // ✨ זה יעדכן גם את isVisible ו-displayOrder אם נשלחו
      { new: true, runValidators: true }
    );

    if (!updatedPriceList) {
      return res.status(404).json({ message: "המחירון לא נמצא או שאין לך הרשאה לערוך אותו." });
    }
    res.json(updatedPriceList);
  } catch (error) {
     if (error.code === 11000) {
      return res.status(400).json({ message: "שם מחירון זה כבר קיים עבור המלון שנבחר." });
    }
    res.status(500).json({ message: "שגיאה בעדכון המחירון" });
  }
};

/**
 * @desc    מחיקת מחירון
 * @route   DELETE /api/pricelists/:id
 * @access  Private (דורש הרשאת ניהול מחירונים)
 */
export const deletePriceList = async (req, res) => {
  const { id } = req.params;
  try {
    const findQuery = { _id: id };
    if (req.user.role !== 'admin') {
        findQuery.user = req.user.id;
    }

    const deletedPriceList = await PriceList.findOneAndDelete(findQuery);

    if (!deletedPriceList) {
      return res.status(404).json({ message: "המחירון לא נמצא או שאין לך הרשאה למחוק אותו." });
    }

    res.json({ message: "המחירון נמחק בהצלחה" });
  } catch (error) {
    res.status(500).json({ message: "שגיאה במחיקת המחירון" });
  }
};