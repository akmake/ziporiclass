import pkg from 'whatsapp-web.js';
const { Client, RemoteAuth } = pkg; // שינוי מ-LocalAuth ל-RemoteAuth
import { MongoStore } from 'wwebjs-mongo'; // ייבוא ה-Store של מונגו
import mongoose from 'mongoose';
import qrcode from 'qrcode-terminal';
import InboundEmail from '../models/InboundEmail.js';     
import ReferrerAlias from '../models/ReferrerAlias.js';   
import { sendPushToAll } from '../utils/pushHandler.js';  

async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim().replace(/[.,;!?-]$/, ''); 
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

let client; // הגדרת המשתנה בחוץ

export const initWhatsAppListener = async () => {
    if (client) return; // מניעת אתחול כפול

    console.log('🔄 מפעיל את שירות הוואטסאפ (עם שמירה ל-MongoDB)...');

    // 1. וידוא שיש חיבור ל-MongoDB לפני שמאתחלים את ה-Store
    if (mongoose.connection.readyState !== 1) {
        console.log('⏳ ממתין לחיבור למונגו...');
        await new Promise(resolve => mongoose.connection.once('open', resolve));
    }

    // 2. יצירת ה-Store שמחובר למונגו
    const store = new MongoStore({ mongoose: mongoose });

    // 3. הגדרת הקליינט עם RemoteAuth
    client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            clientId: 'zipori-session', // מזהה ייחודי לסשן בתוך הדאטהבייס
            backupSyncIntervalMs: 300000 // גיבוי סשן כל 5 דקות
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // חשוב לשרתים עם זיכרון מוגבל
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED. Scan this with your phone:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp Client is ready! (Connected to persistent session)');
    });

    // לוג לאישור שהסשן נשמר לדאטהבייס
    client.on('remote_session_saved', () => {
        console.log('💾 Session saved to MongoDB...');
    });

    client.on('message', async (msg) => {
        try {
            const body = msg.body || '';

            if (!body.includes('שלום הגעתי דרך')) {
                return; 
            }

            const regex = /שלום הגעתי דרך\s+(.+)/i;
            const match = body.match(regex);

            if (match && match[1]) {
                const senderPhone = msg.from.replace('@c.us', '');
                
                // --- מנגנון חילוץ שם ---
                let senderRealName = senderPhone;
                if (msg._data && msg._data.notifyName) {
                    senderRealName = msg._data.notifyName;
                }
                // -----------------------

                let rawName = match[1].trim().split(/\n/)[0];
                const finalReferrer = await getOfficialReferrerName(rawName);

                console.log(`🎯 זוהה ליד: ${senderRealName}, מפנה: ${finalReferrer}`);

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

    await client.initialize();
};