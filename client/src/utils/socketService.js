import io from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '')
  : 'https://ziporiteem.com';

class SocketService {
  socket = null;

  connect(userId) {
    // אם כבר מחובר, לא עושים כלום
    if (this.socket && this.socket.connected) return;

    console.log("🔄 Initializing Socket Connection...");
    
    this.socket = io(SERVER_URL, {
      transports: ['websocket'], // הכי מהיר ויציב
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket Connected ID:', this.socket.id);
      // ברגע שמתחברים - מיד מצטרפים לחדר של המשתמש
      this.socket.emit('join_chat', userId);
    });

    this.socket.on('reconnect', (attempt) => {
        console.log('🔄 Reconnected, re-joining chat...', attempt);
        this.socket.emit('join_chat', userId);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // פונקציה להרשמה לאירועים (מונעת כפילויות)
  on(eventName, callback) {
    if (this.socket) {
      this.socket.off(eventName); // ניקוי מאזינים קודמים כדי למנוע הודעות כפולות
      this.socket.on(eventName, callback);
    }
  }

  emit(eventName, data) {
    if (this.socket) {
      this.socket.emit(eventName, data);
    }
  }
}

const socketService = new SocketService();
export default socketService;