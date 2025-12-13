// server/services/whatsappService.js

import pkg from 'whatsapp-web.js';
const { Client, RemoteAuth } = pkg;
import { MongoStore } from 'wwebjs-mongo';
import mongoose from 'mongoose';
import qrcode from 'qrcode-terminal';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import { sendPushToAll } from '../utils/pushHandler.js';

// פונקציית עזר למציאת שם המפנה
async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim().replace(/[.,;!?-]$/, '');
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

let client;

export const initWhatsAppListener = async () => {
    if (client) return;

    console.log('🔄 מפעיל את שירות הוואטסאפ (גרסה מותאמת לענן)...');

    // וידוא חיבור למונגו
    if (mongoose.connection.readyState !== 1) {
        console.log('⏳ ממתין לחיבור למונגו...');
        await new Promise(resolve => mongoose.connection.once('open', resolve));
    }

    const store = new MongoStore({ mongoose: mongoose });

    client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            clientId: 'zipori-main-session', // מזהה קבוע לסשן
            backupSyncIntervalMs: 60000
        }),
        // הגדלת זמן המתנה לאותנטיקציה - מונע נפילות בטעינה איטית בענן
        authTimeoutMs: 60000, 
        
        puppeteer: {
            // שימוש בנתיב מהסביבה אם קיים (קריטי ל-Render/Heroku), אחרת לוקאל
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            
            // שימוש ב-Headless החדש של כרום (יציב יותר)
            headless: 'new', 
            
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',      // מונע קריסות זיכרון בסביבת דוקר
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',             // חוסך המון זיכרון (קריטי לשרתים קטנים)
                '--disable-gpu'
            ],
            // מונע Timeout בטעינת הדף הראשון
            timeout: 0 
        }
    });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED. Scan this with your phone:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp Client is ready! (Connected to persistent session)');
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Session saved to DB...');
    });

    // טיפול בניתוקים - ניסיון התחברות מחדש
    client.on('disconnected', (reason) => {
        console.log('❌ Client was logged out', reason);
        // אופציונלי: אפשר להוסיף כאן לוגיקה לאתחול מחדש
    });

    client.on('message', async (msg) => {
        try {
            const body = msg.body || '';

            // סינון ראשוני - רק הודעות עם "שלום הגעתי דרך"
            if (!body.includes('שלום הגעתי דרך')) {
                return;
            }

            const regex = /שלום הגעתי דרך\s+(.+)/i;
            const match = body.match(regex);

            if (match && match[1]) {
                const senderPhone = msg.from.replace('@c.us', '');

                let senderRealName = senderPhone;
                if (msg._data && msg._data.notifyName) {
                    senderRealName = msg._data.notifyName;
                }

                let rawName = match[1].trim().split(/\n/)[0];
                const finalReferrer = await getOfficialReferrerName(rawName);

                console.log(`🎯 זוהה ליד: ${senderRealName}, מפנה: ${finalReferrer}`);

                // שמירה ב-DB
                await InboundEmail.create({
                    from: 'WhatsApp',
                    type: 'הודעת וואטסאפ',
                    body: body,
                    receivedAt: new Date(),
                    status: 'new',
                    parsedName: senderRealName,
                    parsedPhone: senderPhone,
                    parsedNote: body,
                    referrer: finalReferrer,
                    hotel: null,
                    handledBy: null
                });

                // שליחת התראה (Push)
                sendPushToAll({
                    title: `ליד חדש: ${senderRealName}`,
                    body: `הגיע דרך: ${finalReferrer}`,
                    url: '/leads'
                });
            }

        } catch (error) {
            console.error('❌ Error processing WhatsApp message:', error);
        }
    });

    // הפעלה
    try {
        await client.initialize();
    } catch (err) {
        console.error('❌ Failed to initialize WhatsApp client:', err);
    }
};