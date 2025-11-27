// server/controllers/admin/orderAdminController.js

import Order from '../../models/Order.js';

/**
 * @desc    קבלת כל ההזמנות במערכת (למנהלים)
 * @route   GET /api/admin/orders
 * @access  Admin
 */
export const getAllOrders = async (req, res) => {
  try {
    console.log('Fetching all orders from MongoDB...');
    const orders = await Order.find({}).sort({ createdAt: -1 }).populate('user', 'name email').populate('hotel', 'name');
    res.json(orders);
  } catch (error) {
    console.error('Critical Error: Failed to fetch all orders from MongoDB.', error);
    res.status(500).json({ message: "שגיאה בטעינת ההזמנות." });
  }
};

/**
 * @desc    עדכון הזמנה קיימת (למשל, שינוי סטטוס)
 * @route   PUT /api/admin/orders/:id
 * @access  Admin
 */
export const updateOrder = async (req, res) => {
  const { id } = req.params;
  const { customerName, customerPhone, status, notes } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "ההזמנה לא נמצאה." });
    }

    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (status) order.status = status;
    if (notes) order.notes = notes;

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
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