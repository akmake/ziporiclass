import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const { GOOGLE_SERVICE_ACCOUNT, GOOGLE_SHEET_ID_ORDERS, GOOGLE_SHEET_ID_PRODUCTS } = process.env;
if (!GOOGLE_SERVICE_ACCOUNT || !GOOGLE_SHEET_ID_ORDERS || !GOOGLE_SHEET_ID_PRODUCTS) {
  throw new Error('Missing Google Sheets environment variables');
}

const ORDERS_SHEET_NAME = 'Orders';
const PRODUCTS_SHEET_NAME = 'Products';
const PRICE_LISTS_SHEET_NAME = 'PriceLists';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE_PATH = path.resolve(__dirname, '..', GOOGLE_SERVICE_ACCOUNT);

let sheets;
try {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheets = google.sheets({ version: 'v4', auth });
} catch (authError) {
    console.error(`[G-Sheets] FATAL: Could not authenticate. Path: ${KEY_FILE_PATH}`, authError);
    throw authError;
}

async function ensureSheetAndHeaders(spreadsheetId, sheetName, headers) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === sheetName);
    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] },
      });
    }
  } catch (err) {
    console.error(`[G-Sheets] Error in ensureSheetAndHeaders for "${sheetName}":`, err.message);
    throw err;
  }
}

const rowsToObjects = (rows) => {
   if (!rows || rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj;
    });
};

const getSheetData = async (spreadsheetId, sheetName) => {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    return response.data.values;
};

const findRowIndex = (rows, columnHeader, value) => {
    if (!rows || rows.length < 1) return -1;
    const headerIndex = rows[0].indexOf(columnHeader);
    if (headerIndex === -1) return -1;
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][headerIndex] === value) return i + 1;
    }
    return -1;
};

const findSheetIdByName = async (spreadsheetId, sheetName) => {
    const res = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title))' });
    const sheet = res.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) throw new Error(`Sheet with name "${sheetName}" not found.`);
    return sheet.properties.sheetId;
};

const serializeRoomsToJSON = (rooms) => {
  if (!rooms || !Array.isArray(rooms)) return '[]';
  try {
    const simplifiedRooms = rooms.map(r => ({
      adults: r.adults, teens: r.teens, children: r.children, babies: r.babies,
      price_list_names: r.price_list_names, price: r.price,
    }));
    return JSON.stringify(simplifiedRooms);
  } catch (e) {
    return '[]';
  }
};

const ORDERS_HEADERS = ['orderId', 'orderNumber', 'userEmail', 'userName', 'customerName', 'customerPhone', 'status', 'totalPrice', 'createdAt', 'notes', 'roomsJSON'];

export const ordersService = {
  async ensureSheet() {
    await ensureSheetAndHeaders(GOOGLE_SHEET_ID_ORDERS, ORDERS_SHEET_NAME, ORDERS_HEADERS);
  },

  async getAll() {
    await this.ensureSheet();
    try {
        const rows = await getSheetData(GOOGLE_SHEET_ID_ORDERS, ORDERS_SHEET_NAME);
        return rowsToObjects(rows).map(o => {
            let roomsData = [];
            try {
                if (o.roomsJSON) roomsData = JSON.parse(o.roomsJSON);
            } catch (e) {
                console.error(`Failed to parse roomsJSON for orderId ${o.orderId}`, e);
            }
            return {
                ...o,
                _id: o.orderId,
                total_price: parseFloat(o.totalPrice) || 0,
                createdAt: o.createdAt,
                rooms: roomsData,
            };
        });
    } catch (err) {
        console.error('❌ [G-Sheets] Failed to getAll orders:', err);
        throw err;
    }
  },

  async add(orderData) {
    await this.ensureSheet();
    try {
        const newRow = [
            orderData._id.toString(),
            orderData.orderNumber,
            orderData.user?.email || 'N/A',
            orderData.salespersonName || orderData.user?.name || 'N/A',
            orderData.customerName,
            orderData.customerPhone || '',
            orderData.status || 'בהמתנה',
            orderData.total_price,
            orderData.createdAt.toISOString(),
            orderData.notes || '',
            serializeRoomsToJSON(orderData.rooms),
        ];
        await sheets.spreadsheets.values.append({
            spreadsheetId: GOOGLE_SHEET_ID_ORDERS, range: `${ORDERS_SHEET_NAME}!A1`,
            valueInputOption: 'USER_ENTERED', requestBody: { values: [newRow] },
        });
        return orderData;
    } catch(err) {
        console.error(`❌ [G-Sheets] Failed to add order ID ${orderData._id}:`, err);
        throw err;
    }
  },

  async update(orderId, orderData) {
    await this.ensureSheet();
    try {
      const rows = await getSheetData(GOOGLE_SHEET_ID_ORDERS, ORDERS_SHEET_NAME);
      const rowIndex = findRowIndex(rows, 'orderId', orderId.toString());
      if (rowIndex === -1) {
          return this.add({ ...orderData, _id: orderId });
      }
      const updatedRow = [
        orderId.toString(), orderData.orderNumber,
        orderData.user?.email || rows[rowIndex-1][2],
        orderData.salespersonName || orderData.user?.name || rows[rowIndex-1][3],
        orderData.customerName,
        orderData.customerPhone || (rows[rowIndex-1] ? rows[rowIndex-1][5] : ''),
        orderData.status, orderData.total_price,
        new Date(orderData.createdAt).toISOString(),
        orderData.notes || '',
        serializeRoomsToJSON(orderData.rooms),
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID_ORDERS,
        range: `${ORDERS_SHEET_NAME}!A${rowIndex}:${String.fromCharCode(65 + updatedRow.length - 1)}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [updatedRow] },
      });
    } catch(err) {
      console.error(`❌ [G-Sheets] Failed to update order ID ${orderId}:`, err);
      throw err;
    }
  },

  async delete(orderId) {
    await this.ensureSheet();
    try {
      const rows = await getSheetData(GOOGLE_SHEET_ID_ORDERS, ORDERS_SHEET_NAME);
      const rowIndex = findRowIndex(rows, 'orderId', orderId.toString());
      if (rowIndex === -1) return;
      const sheetId = await findSheetIdByName(GOOGLE_SHEET_ID_ORDERS, ORDERS_SHEET_NAME);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEET_ID_ORDERS,
        requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] }
      });
    } catch (err) {
      console.error(`❌ [G-Sheets] Failed to delete order ID ${orderId}:`, err);
      throw err;
    }
  }
};

// --- שירות מוצרים (Products Service) ---
export const productsService = {
  async getAll() {
    console.log('[G-Sheets] Getting all products.');
    try {
      await ensureSheetAndHeaders(GOOGLE_SHEET_ID_PRODUCTS, PRODUCTS_SHEET_NAME, ['productId', 'name', 'description', 'price', 'category', 'kashrut', 'unit', 'imageUrl', 'isActive']);
      const rows = await getSheetData(GOOGLE_SHEET_ID_PRODUCTS, PRODUCTS_SHEET_NAME);
      const products = rowsToObjects(rows);
      return products.filter(p => p.isActive === 'TRUE');
    } catch (err) {
      console.error('❌ [G-Sheets] Failed to getAll products:', err);
      throw err;
    }
  },
  async add(productData) {
    console.log(`[G-Sheets] Adding product: ${productData.name}`);
    try {
        const newRow = [
            productData._id.toString(), productData.name, productData.description || '', productData.price,
            productData.category, productData.kashrut, productData.unit, productData.imageUrl || '', 'TRUE'
        ];
        await sheets.spreadsheets.values.append({
           spreadsheetId: GOOGLE_SHEET_ID_PRODUCTS, range: `${PRODUCTS_SHEET_NAME}!A1`,
           valueInputOption: 'USER_ENTERED', requestBody: { values: [newRow] }
        });
        console.log(`✅ [G-Sheets] Successfully added product: ${productData.name}`);
        return productData;
    } catch(err) {
        console.error(`❌ [G-Sheets] Failed to add product "${productData.name}":`, err);
        throw err;
    }
  },
  async update(productId, productData) {
    console.log(`[G-Sheets] Updating product ID: ${productId}`);
     try {
         const rows = await getSheetData(GOOGLE_SHEET_ID_PRODUCTS, PRODUCTS_SHEET_NAME);
        const rowIndex = findRowIndex(rows, 'productId', productId);
        if (rowIndex === -1) throw new Error('Product not found in Sheet');
        const updatedRow = [
           productId, productData.name, productData.description || '', productData.price,
           productData.category, productData.kashrut, productData.unit, productData.imageUrl || '',
            productData.isActive !== false ? 'TRUE' : 'FALSE'
        ];
        await sheets.spreadsheets.values.update({
           spreadsheetId: GOOGLE_SHEET_ID_PRODUCTS,
           range: `${PRODUCTS_SHEET_NAME}!A${rowIndex}:${String.fromCharCode(65 + updatedRow.length - 1)}${rowIndex}`,
            valueInputOption: 'USER_ENTERED', requestBody: { values: [updatedRow] }
        });
        console.log(`✅ [G-Sheets] Successfully updated product ID: ${productId}`);
        return { _id: productId, ...productData };
    } catch(err) {
        console.error(`❌ [G-Sheets] Failed to update product ID ${productId}:`, err);
        throw err;
    }
  },
  async delete(productId) {
    console.log(`[G-Sheets] Deleting (disabling) product ID: ${productId}`);
    try {
        const rows = await getSheetData(GOOGLE_SHEET_ID_PRODUCTS, PRODUCTS_SHEET_NAME);
        const rowIndex = findRowIndex(rows, 'productId', productId);
        if (rowIndex === -1) throw new Error('Product not found in Sheet');
        const activeColIndex = rows[0].indexOf('isActive');
        const activeColLetter = String.fromCharCode(65 + activeColIndex);
        await sheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEET_ID_PRODUCTS,
            range: `${PRODUCTS_SHEET_NAME}!${activeColLetter}${rowIndex}`,
            valueInputOption: 'USER_ENTERED', requestBody: { values: [['FALSE']] }
        });
        console.log(`✅ [G-Sheets] Successfully disabled product ID: ${productId}`);
        return { productId };
    } catch(err) {
        console.error(`❌ [G-Sheets] Failed to delete product ID ${productId}:`, err);
        throw err;
    }
  }
};

// --- שירות מחירונים (Price Lists Service) ---
const PRICE_LISTS_HEADERS = ['priceListId', 'name', 'couple', 'teen', 'child', 'baby', 'single_room', 'userEmail'];

export const priceListsService = {
  async ensureSheet() {
    await ensureSheetAndHeaders(GOOGLE_SHEET_ID_PRODUCTS, PRICE_LISTS_SHEET_NAME, PRICE_LISTS_HEADERS);
  },

  async getAll() {
    console.log('[G-Sheets] Getting all price lists.');
    await this.ensureSheet();
    try {
      const rows = await getSheetData(GOOGLE_SHEET_ID_PRODUCTS, PRICE_LISTS_SHEET_NAME);

      const priceLists = (rowsToObjects(rows) || []).map(pl => ({
        ...pl,
        _id: pl.priceListId,
        couple: parseFloat(pl.couple) || 0,
        teen: parseFloat(pl.teen) || 0,
        child: parseFloat(pl.child) || 0,
        baby: parseFloat(pl.baby) || 0,
        single_room: parseFloat(pl.single_room) || 0,
      }));

      console.log(`✅ [G-Sheets] Successfully fetched ${priceLists.length} price lists.`);
      return priceLists;
    } catch (err) {
      console.error('❌ [G-Sheets] Failed to getAll price lists:', err);
      throw err;
    }
  },

  async add(priceListData) {
    console.log(`[G-Sheets] Adding price list: ${priceListData.name}`);
    await this.ensureSheet();
    try {
        const newRow = [
            priceListData._id.toString(),
            priceListData.name,
            priceListData.couple,
            priceListData.teen,
            priceListData.child,
            priceListData.baby,
            priceListData.single_room,
            priceListData.user?.email || 'N/A'
        ];
        await sheets.spreadsheets.values.append({
            spreadsheetId: GOOGLE_SHEET_ID_PRODUCTS,
            range: `${PRICE_LISTS_SHEET_NAME}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [newRow] },
        });
        console.log(`✅ [G-Sheets] Successfully added price list: ${priceListData.name}`);
        return priceListData;
    } catch(err) {
        console.error(`❌ [G-Sheets] Failed to add price list "${priceListData.name}":`, err);
        throw err;
    }
  },

  async update(priceListId, priceListData) {
      console.log(`[G-Sheets] Updating price list ID: ${priceListId}`);
      await this.ensureSheet();
      try {
          const rows = await getSheetData(GOOGLE_SHEET_ID_PRODUCTS, PRICE_LISTS_SHEET_NAME);
          const rowIndex = findRowIndex(rows, 'priceListId', priceListId);
          if (rowIndex === -1) throw new Error('Price list not found in Sheet');

          const updatedRow = [
              priceListId,
              priceListData.name,
              priceListData.couple,
              priceListData.teen,
              priceListData.child,
              priceListData.baby,
              priceListData.single_room,
              priceListData.user?.email || (rows[rowIndex-1] ? rows[rowIndex-1][7] : 'N/A')
          ];

          await sheets.spreadsheets.values.update({
              spreadsheetId: GOOGLE_SHEET_ID_PRODUCTS,
              range: `${PRICE_LISTS_SHEET_NAME}!A${rowIndex}:${String.fromCharCode(65 + updatedRow.length - 1)}${rowIndex}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [updatedRow] },
          });
          console.log(`✅ [G-Sheets] Successfully updated price list ID: ${priceListId}`);
          return { _id: priceListId, ...priceListData };
      } catch(err) {
          console.error(`❌ [G-Sheets] Failed to update price list ID ${priceListId}:`, err);
          throw err;
      }
  },

  async delete(priceListId) {
      console.log(`[G-Sheets] Deleting price list ID: ${priceListId}`);
      await this.ensureSheet();
      try {
          const rows = await getSheetData(GOOGLE_SHEET_ID_PRODUCTS, PRICE_LISTS_SHEET_NAME);
          const rowIndex = findRowIndex(rows, 'priceListId', priceListId);
          if (rowIndex === -1) {
              console.warn(`[G-Sheets] Price list ${priceListId} not found for deletion.`);
              return;
          }

          const sheetId = await findSheetIdByName(GOOGLE_SHEET_ID_PRODUCTS, PRICE_LISTS_SHEET_NAME);

          await sheets.spreadsheets.batchUpdate({
              spreadsheetId: GOOGLE_SHEET_ID_PRODUCTS,
              requestBody: {
                  requests: [{
                      deleteDimension: {
                          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
                      }
                  }]
              }
          });
          console.log(`✅ [G-Sheets] Successfully deleted price list ID: ${priceListId}`);
      } catch(err) {
          console.error(`❌ [G-Sheets] Failed to delete price list ID ${priceListId}:`, err);
          throw err;
      }
  }
};