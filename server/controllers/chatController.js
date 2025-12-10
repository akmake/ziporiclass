import Message from '../models/Message.js';
import User from '../models/userModel.js';
import { getSocketIO } from '../socket.js';

// === מטריצת הרשאות ===
const PERMISSION_MATRIX = {
    'admin': ['all'],
    'sales': ['admin', 'shift_manager', 'maintenance'],
    'shift_manager': ['all'],
    'housekeeper': ['shift_manager', 'maintenance'],
    'maintenance': ['all']
};

export const getMyContacts = async (req, res) => {
    const myRole = req.user.role;
    const allowedRoles = PERMISSION_MATRIX[myRole] || [];
    let query = {};
    if (!allowedRoles.includes('all')) {
        query.role = { $in: allowedRoles };
    }
    const contacts = await User.find({
        ...query,
        _id: { $ne: req.user._id }
    }).select('name role email');
    res.json(contacts);
};

export const getMessages = async (req, res) => {
    const { otherUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
        $or: [
            { sender: myId, recipient: otherUserId },
            { sender: otherUserId, recipient: myId }
        ]
    })
    .sort({ createdAt: 1 })
    .populate('relatedOrder', 'orderNumber customerName total_price status');

    res.json(messages);
};

export const sendMessage = async (req, res) => {
    const { recipientId, text, orderId, isForwarded } = req.body; // הוספנו isForwarded
    const senderId = req.user._id;

    // 1. שמירה ב-DB
    const newMessage = await Message.create({
        sender: senderId,
        recipient: recipientId,
        text,
        relatedOrder: orderId || null,
        isForwarded: isForwarded || false
    });

    const populatedMessage = await newMessage.populate('relatedOrder', 'orderNumber customerName status');

    // 2. שליחה בזמן אמת
    try {
        const io = getSocketIO();
        // שולחים למקבל
        io.to(recipientId).emit('receive_message', populatedMessage);
        // שולחים גם לשולח (כדי לעדכן את ה-ID הזמני ב-Real ID אם צריך, או לסנכרון טאבים)
        io.to(senderId).emit('message_sent_confirmation', populatedMessage);
    } catch (err) {
        console.error("Socket error:", err.message);
    }

    res.status(201).json(populatedMessage);
};

// --- פונקציות חדשות ---

export const markAsRead = async (req, res) => {
    const { senderId } = req.body; // ה-ID של מי ששלח לי את ההודעות (שאני קורא עכשיו)
    const myId = req.user._id;

    // מעדכן את כל ההודעות שלא נקראו בשיחה הזו
    await Message.updateMany(
        { sender: senderId, recipient: myId, isRead: false },
        { $set: { isRead: true } }
    );

    // מודיע לשולח שהודעותיו נקראו
    try {
        const io = getSocketIO();
        io.to(senderId).emit('messages_read_update', { byUserId: myId });
    } catch (err) { console.error(err); }

    res.json({ success: true });
};

export const deleteMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findOne({ _id: messageId, sender: userId });
    if (!message) return res.status(403).json({ message: 'לא מורשה' });

    message.isDeleted = true;
    await message.save();

    // עדכון בזמן אמת לשני הצדדים
    try {
        const io = getSocketIO();
        io.to(message.recipient.toString()).emit('message_deleted', { messageId });
        io.to(userId.toString()).emit('message_deleted', { messageId });
    } catch (err) { console.error(err); }

    res.json({ success: true });
};