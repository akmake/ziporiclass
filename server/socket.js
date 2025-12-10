import { Server } from 'socket.io';
import Message from './models/Message.js'; // וודא שהנתיב נכון למודל שלך

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: [
                "http://localhost:5173",
                "https://zipori-client.onrender.com",
                process.env.CLIENT_URL
            ].filter(Boolean),
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 60000,
    });

    io.on('connection', (socket) => {
        console.log(`🔌 New Connection: ${socket.id}`);

        // 1. הצטרפות לחדר פרטי
        socket.on('join_chat', (userId) => {
            if (!userId) return;
            socket.join(userId);
            // שומרים את ה-ID על הסוקט לשימוש עתידי
            socket.userId = userId; 
            console.log(`👤 User ${userId} joined room`);
        });

        // 2. טיפול באירועי הקלדה (Typing)
        socket.on('typing_start', (recipientId) => {
            // שולחים רק לנמען הספציפי
            io.to(recipientId).emit('user_typing', { senderId: socket.userId });
        });

        socket.on('typing_stop', (recipientId) => {
            io.to(recipientId).emit('user_stopped_typing', { senderId: socket.userId });
        });

        // 3. טיפול מהיר בסימון "נקרא" (V כחול)
        socket.on('mark_as_read_realtime', async ({ senderId }) => {
            // senderId = מי ששלח לי את ההודעה (שאותה אני קורא עכשיו)
            // socket.userId = אני (הקורא)
            
            try {
                // עדכון במסד הנתונים
                await Message.updateMany(
                    { sender: senderId, recipient: socket.userId, isRead: false },
                    { $set: { isRead: true } }
                );

                // שליחת עדכון בזמן אמת לצד השני (כדי שיראה V כחול)
                io.to(senderId).emit('messages_read_update', { byUserId: socket.userId });
            } catch (error) {
                console.error("Error marking as read in socket:", error);
            }
        });

        socket.on('disconnect', () => {
            // אופציונלי: אפשר לשלוח כאן typing_stop לכולם אם רוצים להיות דקדקנים
            console.log(`❌ Disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getSocketIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};