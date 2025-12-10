import Order from '../../models/Order.js';
import User from '../../models/userModel.js';
import { logAction } from '../../utils/auditLogger.js';

/**
 * @desc    קבלת כל ההזמנות במערכת (למנהלים)
 * @route   GET /api/admin/orders
 * @access  Admin
 */
export const getAllOrders = async (req, res) => {
  try {
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
 * @desc    שליפת מפה של הזמנות לחישוב עמלות (היברידי - תיקון לפיצול)
 * @route   GET /api/admin/orders/commission-map
 * @access  Admin
 */
export const getOrdersForCommissionMap = async (req, res) => {
    try {
        // שולפים הזמנות שנסגרו ("בוצע")
        const orders = await Order.find({ status: { $in: ['בוצע', 'placed', 'converted'] } })
            .select('orderNumber createdByName closedByName optimaNumber total_price')
            .lean();

        const ordersMap = {};
        orders.forEach(o => {
            // המפתח הוא מספר אופטימה (אם קיים) או מספר ההזמנה
            // trim() קריטי כדי למנוע אי התאמות בגלל רווחים
            const key = o.optimaNumber ? o.optimaNumber.toString().trim() : o.orderNumber.toString();

            const creator = o.createdByName ? o.createdByName.trim() : 'לא ידוע';
            const closer = o.closedByName ? o.closedByName.trim() : 'לא ידוע';

            // האם יש פיצול? רק אם יש שני שמות שונים ושניהם קיימים
            const isSplit = !!(creator && closer && creator !== closer && closer !== 'לא ידוע');

            ordersMap[key] = {
                id: o._id,
                creator: creator,
                closer: closer,
                isSplit: isSplit
            };

            // שומרים גיבוי גם לפי מספר ההזמנה הפנימי (למקרה שלא הזינו אופטימה או הזינו את הפנימי בטעות)
            ordersMap[o.orderNumber.toString()] = ordersMap[key];
        });

        res.json(ordersMap);
    } catch (error) {
        console.error("Commission Map Error:", error);
        res.status(500).json({ message: "שגיאה בטעינת נתוני מיפוי עמלות." });
    }
};

/**
 * @desc    עדכון הזמנה קיימת
 * @route   PUT /api/admin/orders/:id
 * @access  Admin
 */
export const updateOrder = async (req, res) => {
  const { id } = req.params;
  const { customerName, customerPhone, status, notes, newUserId } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "ההזמנה לא נמצאה." });
    }

    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (status) order.status = status;
    if (notes) order.notes = notes;

    // שינוי שיוך נציג
    if (newUserId && newUserId !== order.user.toString()) {
        const newUser = await User.findById(newUserId);
        if (!newUser) {
            return res.status(404).json({ message: "המשתמש החדש לא נמצא במערכת" });
        }
        const oldName = order.salespersonName || 'נציג קודם';
        order.user = newUser._id;
        order.salespersonName = newUser.name;
        await logAction(req, 'UPDATE', 'Order', order._id, `שיוך ההזמנה שונה מ-${oldName} ל-${newUser.name}`);
    }

    const updatedOrder = await order.save();
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