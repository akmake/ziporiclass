import Message from '../models/Message.js';
import User from '../models/userModel.js';
import { getSocketIO } from '../socket.js';
import { sendPushToUser } from '../utils/pushHandler.js';

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
    const myId = req.user._id;

    const allowedRoles = PERMISSION_MATRIX[myRole] || [];
    let query = {};
    if (!allowedRoles.includes('all')) {
        query.role = { $in: allowedRoles };
    }

    // 1. שליפת אנשי הקשר
    const contacts = await User.find({
        ...query,
        _id: { $ne: myId }
    }).select('name role email').lean();

    // 2. הוספת מידע על הודעות שלא נקראו והודעה אחרונה
    const contactsWithCounts = await Promise.all(contacts.map(async (contact) => {
        // ספירת הודעות שלא נקראו (שנשלחו אליי מאיש הקשר הזה)
        const unreadCount = await Message.countDocuments({
            sender: contact._id,
            recipient: myId,
            isRead: false
        });

        // שליפת ההודעה האחרונה בינינו (לתצוגה יפה בסרגל)
        const lastMessage = await Message.findOne({
            $or: [
                { sender: myId, recipient: contact._id },
                { sender: contact._id, recipient: myId }
            ]
        }).sort({ createdAt: -1 }).select('text createdAt').lean();

        return {
            ...contact,
            unreadCount,
            lastMessage
        };
    }));

    // 3. מיון: אנשים עם הודעות שלא נקראו יופיעו למעלה
    contactsWithCounts.sort((a, b) => {
        // עדיפות 1: כמות הודעות שלא נקראו
        if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
        
        // עדיפות 2: לפי זמן ההודעה האחרונה (החדש ביותר למעלה)
        const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(0);
        const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(0);
        return dateB - dateA;
    });

    res.json(contactsWithCounts);
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
    const { recipientId, text, orderId, isForwarded } = req.body;
    const senderId = req.user._id;
    const senderName = req.user.name;

    // שמירה ב-DB
    const newMessage = await Message.create({
        sender: senderId,
        recipient: recipientId,
        text,
        relatedOrder: orderId || null,
        isForwarded: isForwarded || false
    });

    const populatedMessage = await newMessage.populate('relatedOrder', 'orderNumber customerName status');

    // שליחה בזמן אמת (Socket)
    try {
        const io = getSocketIO();
        
        // שליחה לנמען
        io.to(recipientId).emit('receive_message', populatedMessage);
        
        // שליחה גם לשולח (למקרה שהוא מחובר ממכשיר אחר)
        io.to(senderId).emit('message_sent_confirmation', populatedMessage);

        // שליחת Push Notification
        sendPushToUser(recipientId, {
            title: `הודעה חדשה מ-${senderName}`,
            body: text || (orderId ? 'צורפה הזמנה' : 'הודעה חדשה'),
            url: '/chat'
        });

    } catch (err) {
        console.error("Notification error:", err.message);
    }

    res.status(201).json(populatedMessage);
};

export const markAsRead = async (req, res) => {
    const { senderId } = req.body;
    const myId = req.user._id;

    await Message.updateMany(
        { sender: senderId, recipient: myId, isRead: false },
        { $set: { isRead: true } }
    );

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

    try {
        const io = getSocketIO();
        io.to(message.recipient.toString()).emit('message_deleted', { messageId });
        io.to(userId.toString()).emit('message_deleted', { messageId });
    } catch (err) { console.error(err); }

    res.json({ success: true });
};