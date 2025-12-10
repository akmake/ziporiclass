import { Server } from 'socket.io';

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
        pingTimeout: 60000, // שומר על חיבור יציב
    });

    io.on('connection', (socket) => {
        console.log(`🔌 New Connection: ${socket.id}`);

        // הצטרפות לחדר פרטי
        socket.on('join_chat', (userId) => {
            if (!userId) return;
            socket.join(userId);
            console.log(`👤 User ${userId} joined room: ${userId}`);
        });

        socket.on('disconnect', () => {
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