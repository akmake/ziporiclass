import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// טעינת ההגדרות מקובץ ה-.env הראשי
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const cleanWhatsappSessions = async () => {
  console.log('🧹 מתחיל תהליך ניקוי טוטאלי לוואטסאפ...');

  try {
    if (!process.env.MONGO_URI) {
      throw new Error('❌ MONGO_URI חסר בקובץ .env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ מחובר ל-MongoDB.');

    const collections = await mongoose.connection.db.listCollections().toArray();
    
    // מוצא את כל הקולקציות שקשורות לוואטסאפ (קבצים, צ'אנקים, סשנים)
    const targets = collections.filter(c => 
        c.name.includes('whatsapp') || 
        c.name.includes('remote-auth') || 
        c.name.includes('wwebjs')
    );

    if (targets.length === 0) {
        console.log('✨ השרת נקי! לא נמצאו סשנים למחיקה.');
    } else {
        for (const col of targets) {
            await mongoose.connection.db.dropCollection(col.name);
            console.log(`🗑️ נמחקה קולקציה: ${col.name}`);
        }
        console.log('🚀 כל נתוני הוואטסאפ נמחקו בהצלחה.');
    }

  } catch (error) {
    console.error('❌ שגיאה בניקוי:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 התהליך הסתיים.');
    process.exit(0);
  }
};

cleanWhatsappSessions();