import { Server } from 'socket.io';

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL, // הכתובת של הריאקט
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // ברגע שמשתמש מתחבר, הוא מצטרף ל"חדר" עם ה-ID שלו
        // כך נוכל לשלוח לו הודעות פרטיות בקלות
        socket.on('join_chat', (userId) => {
            socket.join(userId);
            console.log(`User ${userId} joined their private room`);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected');
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