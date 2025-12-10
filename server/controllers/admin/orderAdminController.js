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
 * @desc    שליפת מפה של הזמנות לחישוב עמלות (חדש)
 * @route   GET /api/admin/orders/commission-map
 * @access  Admin
 */
export const getOrdersForCommissionMap = async (req, res) => {
    try {
        // שולפים רק הזמנות בסטטוס "בוצע" כי רק הן רלוונטיות לעמלות
        const orders = await Order.find({ status: 'בוצע' })
            .select('orderNumber createdBy createdByName closedBy closedByName optimaNumber total_price')
            .lean();

        // המרה למפה (Dictionary) לגישה מהירה ב-O(1)
        const ordersMap = {};
        orders.forEach(o => {
            // המפתח הוא מספר ההזמנה (אופטימה) אם הוזן, או מספר ההזמנה הפנימי כגיבוי
            const key = o.optimaNumber ? o.optimaNumber.trim() : o.orderNumber.toString();
            
            ordersMap[key] = {
                id: o._id,
                creator: o.createdByName || 'לא ידוע',
                closer: o.closedByName || 'לא ידוע',
                // אם היוצר והסוגר שונים - סימן שיש פיצול
                isSplit: !!(o.createdByName && o.closedByName && o.createdByName !== o.closedByName)
            };
            
            // גיבוי: נשמור גם לפי מספר הזמנה פנימי למקרה שההתאמה היא לפי זה
            ordersMap[o.orderNumber.toString()] = ordersMap[key];
        });

        res.json(ordersMap);
    } catch (error) {
        console.error("Commission Map Error:", error);
        res.status(500).json({ message: "שגיאה בטעינת נתוני מיפוי עמלות." });
    }
};

/**
 * @desc    עדכון הזמנה קיימת (שינוי סטטוס, פרטים, או שיוך נציג)
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

    // עדכונים רגילים
    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (status) order.status = status;
    if (notes) order.notes = notes;

    // --- לוגיקה לשינוי שיוך נציג ---
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