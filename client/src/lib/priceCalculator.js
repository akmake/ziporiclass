// client/src/lib/priceCalculator.js

// היררכיית מחירים: מי נחשב "יקר" יותר בחדר
const guestHierarchy = {
  adult: { priceKey: 'teen', order: 1 }, // מבוגר הוא היקר ביותר
  teen: { priceKey: 'teen', order: 2 },
  child: { priceKey: 'child', order: 3 },
};

/**
 * מחשב מחיר בסיס *ללילה אחד* עבור הרכב אורחים ומחירון ספציפי.
 * (פונקציה פנימית)
 */
export function calculateSingleNightBasePrice(room, priceList) {
  const { adults = 0, teens = 0, children = 0, babies = 0 } = room;

  // 1. תינוקות: תוספת קבועה (ללילה)
  const babyCost = babies * (priceList.baby || 0);

  // 2. קבוצה עיקרית (ללא תינוקות)
  const mainGroupSize = adults + teens + children;
  let mainGroupPrice = 0;

  if (mainGroupSize === 0) {
    mainGroupPrice = 0;
  } else if (mainGroupSize === 1) {
    // מחיר יחיד בחדר
    mainGroupPrice = priceList.single_room || 0;
  } else {
    // זוג ומעלה
    // ממיינים כדי ששני ה"יקרים" ביותר יתפסו את מחיר ה"זוג"
    const guests = [
      ...Array(adults).fill('adult'),
      ...Array(teens).fill('teen'),
      ...Array(children).fill('child'),
    ];

    guests.sort((a, b) => guestHierarchy[a].order - guestHierarchy[b].order);

    // מחיר הבסיס לזוג
    mainGroupPrice = priceList.couple || 0;

    // תוספות עבור כל אדם מעבר לזוג (החל מהאדם השלישי)
    for (let i = 2; i < guests.length; i++) {
      const guestType = guests[i];
      const priceKey = guestHierarchy[guestType].priceKey;
      mainGroupPrice += (priceList[priceKey] || 0);
    }
  }

  return mainGroupPrice + babyCost;
}

/**
 * הפונקציה הראשית לחישוב מחיר חדר.
 * משקללת: מחירונים נבחרים + תוספת סוג חדר + מספר לילות.
 * * @param {Object} room - אובייקט החדר (כמויות אורחים)
 * @param {Object} allPriceLists - מפה של כל המחירונים הזמינים
 * @param {Array} selectedNames - מערך שמות המחירונים שנבחרו לחדר זה
 * @param {Number} nights - מספר הלילות (ברירת מחדל 1)
 * @param {Number} roomSupplementPerNight - תוספת שקלית ללילה עבור סוג החדר (ברירת מחדל 0)
 */
export function calculateRoomTotalPrice(room, allPriceLists, selectedNames, nights = 1, roomSupplementPerNight = 0) {
    if (!allPriceLists || !selectedNames || selectedNames.length === 0) {
        return 0;
    }

    let totalBasePricePerNight = 0;

    // סיכום המחירים מכל המחירונים שנבחרו (ללילה אחד)
    for (const name of selectedNames) {
        const priceList = allPriceLists[name];
        if (priceList) {
            totalBasePricePerNight += calculateSingleNightBasePrice(room, priceList);
        }
    }

    // המחיר הסופי ללילה = (מחיר מחירונים) + (תוספת סוג חדר)
    const finalPricePerNight = totalBasePricePerNight + roomSupplementPerNight;

    // הכפלה במספר הלילות
    return finalPricePerNight * nights;
}