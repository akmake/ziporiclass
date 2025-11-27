// server/models/Announcement.js
import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  content: { 
    type: String, 
    required: true 
  },
  // למי ההודעה מיועדת?
  target: { 
    type: String, 
    enum: ['all', 'user'], 
    default: 'all' 
  },
  // רלוונטי רק אם target === 'user'
  targetUser: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: function() { return this.target === 'user'; }
  },
  // שם המנהל שיצר את ההודעה
  authorName: { 
    type: String, 
    required: true 
  }, 
  // תאריך תפוגה (אם קיים)
  expiresAt: { 
    type: Date, 
    default: null 
  }
}, { 
  timestamps: true 
});

// אינדקס TTL: מונגו ימחק אוטומטית מסמכים ברגע שיעבור הזמן ב-expiresAt.
// זה עובד רק אם expiresAt הוא תאריך (לא null).
announcementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Announcement', announcementSchema);