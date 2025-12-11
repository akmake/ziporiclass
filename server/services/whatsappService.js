import pkg from 'whatsapp-web.js';
const { Client, RemoteAuth } = pkg; // שים לב: החלפנו ל-RemoteAuth
import { MongoStore } from 'wwebjs-mongo';
import mongoose from 'mongoose'; // חייב לייבא את מונגוס
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

// משתנה גלובלי ללקוח כדי למנוע יצירה כפולה
let client;

export const initWhatsAppListener = async () => {
    // מונע הפעלה כפולה אם הפונקציה נקראת פעמיים
    if (client) return;

    console.log('🔄 מפעיל את שירות הוואטסאפ (מצב RemoteAuth)...');

    // אנו מוודאים שמונגו מחובר לפני יצירת החנות
    if (mongoose.connection.readyState !== 1) {
        console.log('⏳ ממתין לחיבור למונגו...');
        await new Promise(resolve => mongoose.connection.once('open', resolve));
    }

    // יצירת חנות לשמירת הסשן בתוך מונגו
    const store = new MongoStore({ mongoose: mongoose });

    client = new Client({
        // שימוש באסטרטגיית RemoteAuth לשמירה ב-DB
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000 // גיבוי סשן כל 5 דקות
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED. Scan this with your phone:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp Client is ready! (Session saved in DB)');
    });

    // טיפול בניתוקים וטעינת הברקוד מחדש אם צריך
    client.on('disconnected', (reason) => {
        console.log('❌ WhatsApp disconnected:', reason);
        // השרת ינסה להתחבר מחדש אוטומטית ע"י הלוגיקה של הספרייה, 
        // אבל במקרה של ניתוק לוגי, נצטרך לסרוק שוב.
    });

    client.on('remote_session_saved', () => {
        console.log('💾 WhatsApp session saved to MongoDB successfully');
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
                
                let senderRealName = senderPhone;
                if (msg._data && msg._data.notifyName) {
                    senderRealName = msg._data.notifyName;
                }

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