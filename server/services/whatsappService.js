import pkg from 'whatsapp-web.js';
const { Client, RemoteAuth } = pkg;
import { MongoStore } from 'wwebjs-mongo';
import mongoose from 'mongoose';
import qrcode from 'qrcode-terminal';
import InboundEmail from '../models/InboundEmail.js';     
import ReferrerAlias from '../models/ReferrerAlias.js';   
import { sendPushToAll } from '../utils/pushHandler.js';  

// פונקציית עזר לזיהוי שם מפנה
async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim().replace(/[.,;!?-]$/, ''); 
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

let client;

export const initWhatsAppListener = async () => {
    // מונע הפעלה כפולה אם הפונקציה נקראת פעמיים בטעות
    if (client) return;

    console.log('🔄 מפעיל את שירות הוואטסאפ (RemoteAuth + ClientID)...');

    // 1. שלב קריטי: מוודאים שמונגו מחובר לפני שמנסים לשמור בו את הסשן
    if (mongoose.connection.readyState !== 1) {
        console.log('⏳ ממתין לחיבור למונגו...');
        await new Promise(resolve => mongoose.connection.once('open', resolve));
        console.log('✔ מונגו מחובר, ממשיך בטעינת הוואטסאפ...');
    }

    // 2. הגדרת החנות במונגו - זה מה ששומר את הנתונים ב-DB במקום בקובץ
    const store = new MongoStore({ mongoose: mongoose });

    // 3. יצירת הלקוח עם מזהה קבוע
    client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            clientId: 'zipori-production-session', // <--- התיקון: שם קבוע שיישמר ב-DB ולא ישתנה בריסטרט
            backupSyncIntervalMs: 60000 // גיבוי הסשן למונגו כל דקה
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // מונע קריסות זכרון בסביבת דוקר/רנדר
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            timeout: 0
        }
    });

    // --- אירועים ---

    client.on('qr', (qr) => {
        console.log('QR RECEIVED. Scan this with your phone:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp Client is ready! (Connected via MongoDB)');
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Session saved to MongoDB...');
    });

    client.on('message', async (msg) => {
        try {
            const body = msg.body || '';

            // בדיקה אם ההודעה רלוונטית
            if (!body.includes('שלום הגעתי דרך')) {
                return; 
            }

            const regex = /שלום הגעתי דרך\s+(.+)/i;
            const match = body.match(regex);

            if (match && match[1]) {
                const senderPhone = msg.from.replace('@c.us', '');
                
                // ניסיון לחלץ שם פרטי (עם הגנה מקריסה)
                let senderRealName = senderPhone;
                if (msg._data && msg._data.notifyName) {
                    senderRealName = msg._data.notifyName;
                }

                let rawName = match[1].trim().split(/\n/)[0];
                const finalReferrer = await getOfficialReferrerName(rawName);

                console.log(`🎯 זוהה ליד: ${senderRealName}, מפנה: ${finalReferrer}`);

                // יצירת הליד ב-DB
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

                // שליחת התראה
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
    await client.initialize();
};