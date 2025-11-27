// server/utils/excelCleaners.js

/**
 * פונקציית עזר גנרית לאיתור טבלת הנתונים בתוך קובץ אקסל.
 * @param {Array<Array<string>>} data הנתונים הגולמיים מהגיליון.
 * @param {string[]} keyHeaders רשימת כותרות חובה שחייבות להופיע בשורת הכותרות.
 * @returns {{headers: string[], dataRows: Array<Array<string>>}}
 */
function findTableData(data, keyHeaders) {
  const headerRowIndex = data.findIndex(row =>
    Array.isArray(row) && keyHeaders.every(header =>
      row.some(cell => typeof cell === 'string' && cell.trim().includes(header))
    )
  );

  if (headerRowIndex === -1) {
    throw new Error(`לא הצלחנו לזהות את שורת הכותרות. ודא שהקובץ מכיל עמודות: ${keyHeaders.join(', ')}.`);
  }

  const headers = data[headerRowIndex].map(h => String(h || '').trim().replace(/\s+/g, ' '));
  const rowsAfterHeaders = data.slice(headerRowIndex + 1);

  const dataRows = rowsAfterHeaders.filter(row =>
    Array.isArray(row) && row.filter(cell => cell != null && String(cell).trim() !== '').length >= 2
  );

  return { headers, dataRows };
}

/**
 * מנקה ומעבד קובץ עסקאות של חברת "מקס".
 */
export function cleanMaxFile(data) {
  const { headers, dataRows } = findTableData(data, ['תאריך עסקה', 'שם בית העסק', 'סכום חיוב']);

  if (dataRows.length < 1) {
    throw new Error("לא נמצאו נתונים בקובץ 'מקס' לאחר הניקוי.");
  }

  return dataRows.map(rowArray => {
    let rowObject = {};
    headers.forEach((header, index) => {
      if (header) {
        rowObject[header] = rowArray[index];
      }
    });
    return rowObject;
  });
}

/**
 * מנקה ומעבד קובץ עסקאות של חברת "כאל".
 * הלוגיקה מזהה את תחילת הנתונים וממפה אותם לפי מיקום קבוע של עמודות.
 */
export function cleanCalFile(data) {
    // שלב 1: מצא את האינדקס של שורת הכותרות כדי לדעת מאיפה להתחיל
    const headerRowIndex = data.findIndex(row =>
        Array.isArray(row) &&
        row.some(cell => typeof cell === 'string' && cell.includes('תאריך')) &&
        row.some(cell => typeof cell === 'string' && cell.includes('שם בית עסק'))
    );

    if (headerRowIndex === -1) {
        throw new Error("קובץ 'כאל' לא תקין: לא הצלחנו לזהות את שורת הכותרות. ודא שהקובץ מכיל את העמודות הנדרשות.");
    }

    // שלב 2: חלץ את שורות הנתונים שמתחילות מיד אחרי הכותרות
    const dataRows = data.slice(headerRowIndex + 1);

    // שלב 3: סנן שורות לא רלוונטיות (ריקות או שורות סיכום)
    const finalRows = dataRows.filter(row =>
        Array.isArray(row) &&
        row[0] && // חייב להיות ערך בעמודת התאריך (אינדקס 0)
        row[1]    // חייב להיות ערך בעמודת שם בית העסק (אינדקס 1)
    );

    if (finalRows.length < 1) {
        throw new Error("לא נמצאו שורות נתונים תקינות בקובץ 'כאל' לאחר הניקוי.");
    }

    // --- 👇 התיקון כאן: מיפוי לפי מיקום קבוע של שלוש העמודות הראשונות ---
    return finalRows.map(rowArray => {
        return {
            "תאריך עסקה": rowArray[0],
            "שם בית העסק": rowArray[1],
            // עמודה 3 היא הסכום, וניתן לה שם קבוע שהקוד מצפה לו
            "סכום חיוב": rowArray[2]
        };
    });
}