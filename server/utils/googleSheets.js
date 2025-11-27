import { google } from 'googleapis';
import path from 'path';

const { GOOGLE_SERVICE_ACCOUNT, GOOGLE_SHEET_ID } = process.env;
if (!GOOGLE_SERVICE_ACCOUNT) throw new Error('GOOGLE_SERVICE_ACCOUNT missing');
if (!GOOGLE_SHEET_ID)       throw new Error('GOOGLE_SHEET_ID missing');

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

/* ───────── public helper ───────── */
export async function appendOrder(row, tab) {
  await ensureSheet(tab);

  /* ה-range חייב להיות עם גרשיים אם השם כולל תווים לא-לטיניים / רווחים */
  const range = `'${tab}'!A1`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

/* ───────── create sheet if missing ───────── */
async function ensureSheet(title) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    fields: 'sheets.properties.title',
  });

  const exists = meta.data.sheets.some(
    (s) => s.properties.title === title
  );
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
}