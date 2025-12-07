// server/controllers/admin/orderAdminController.js

import Order from '../../models/Order.js';
import User from '../../models/userModel.js'; // ✨ ייבוא מודל משתמש
import { logAction } from '../../utils/auditLogger.js'; // ✨ ייבוא לוגר לתיעוד

/**
 * @desc    קבלת כל ההזמנות במערכת (למנהלים)
 * @route   GET /api/admin/orders
 * @access  Admin
 */
export const getAllOrders = async (req, res) => {
  try {
    console.log('Fetching all orders from MongoDB...');
    const orders = await Order.find({})
        .sort({ createdAt: -1 })
        .populate('user', 'name email')
        .populate('hotel', 'name');
    res.json(orders);
  } catch (error) {
    console.error('Critical Error: Failed to fetch all orders from MongoDB.', error);
    res.status(500).json({ message: "שגיאה בטעינת ההזמנות." });
  }
};

/**
 * @desc    עדכון הזמנה קיימת (שינוי סטטוס, פרטים, או שיוך נציג)
 * @route   PUT /api/admin/orders/:id
 * @access  Admin
 */
export const updateOrder = async (req, res) => {
  const { id } = req.params;
  // ✨ הוספנו את newUserId לחילוץ מה-body
  const { customerName, customerPhone, status, notes, newUserId } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "ההזמנה לא נמצאה." });
    }

    // עדכונים רגילים
    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (status) order.status = status;
    if (notes) order.notes = notes;

    // --- ✨ לוגיקה לשינוי שיוך נציג ✨ ---
    if (newUserId && newUserId !== order.user.toString()) {
        const newUser = await User.findById(newUserId);
        if (!newUser) {
            return res.status(404).json({ message: "המשתמש החדש לא נמצא במערכת" });
        }

        const oldName = order.salespersonName || 'נציג קודם';
        
        // עדכון השדות
        order.user = newUser._id;
        order.salespersonName = newUser.name; // עדכון השם לתצוגה ולדוחות

        // תיעוד ב-Audit Log
        await logAction(req, 'UPDATE', 'Order', order._id, `שיוך ההזמנה שונה מ-${oldName} ל-${newUser.name}`);
    }
    // -------------------------------------------

    const updatedOrder = await order.save();
    
    // החזרת אובייקט מלא עם ה-populate כדי שהטבלה תתעדכן מיד בקליינט
    await updatedOrder.populate('user', 'name email');
    await updatedOrder.populate('hotel', 'name');

    res.json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "שגיאה בעדכון ההזמנה." });
  }
};

/**
 * @desc    מחיקת הזמנה
 * @route   DELETE /api/admin/orders/:id
 * @access  Admin
 */
export const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'ההזמנה לא נמצאה' });
        }
        res.json({ message: 'ההזמנה נמחקה בהצלחה' });
    } catch (error) {
        res.status(500).json({ message: 'שגיאה במחיקת ההזמנה' });
    }
};