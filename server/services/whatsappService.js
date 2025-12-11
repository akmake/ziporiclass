import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import mongoose from 'mongoose';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import { sendPushToAll } from '../utils/pushHandler.js';

// פונקציית עזר למציאת שם המפנה (מהקוד המקורי שלך)
async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim().replace(/[.,;!?-]$/, '');
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

// פונקציית עזר לחילוץ טקסט מהודעת Baileys (המבנה שם מורכב יותר)
const getMessageText = (msg) => {
    if (!msg.message) return '';
    return msg.message.conversation || 
           msg.message.extendedTextMessage?.text || 
           msg.message.imageMessage?.caption || 
           '';
};

let sock;

async function startWhatsApp() {
    console.log('🔄 מפעיל את Baileys WhatsApp Listener...');

    // וידוא חיבור למונגו
    if (mongoose.connection.readyState !== 1) {
        await new Promise(resolve => mongoose.connection.once('open', resolve));
    }

    // ניהול אותנטיקציה (שומר תיקייה מקומית 'auth_info_baileys')
    // הערה: ב-Render התיקייה תימחק ב-Deploy חדש, אז תצטרך לסרוק שוב.
    // לפתרון קבוע ב-Render צריך לחבר את זה ל-Mongo, אבל זה הקוד הפשוט והעובד מיידית.
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // אנחנו מטפלים ב-QR ידנית
        logger: pino({ level: 'silent' }), // משתיק לוגים מיותרים
        browser: ["Zipori System", "Chrome", "10.0"], // מזהה דפדפן פיקטיבי
        connectTimeoutMs: 60000,
    });

    // ניהול אירועי חיבור
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QR RECEIVED. Scan this with your phone:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                startWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp (Baileys) Connected!');
        }
    });

    // שמירת קרדנציאלים כשהם מתעדכנים
    sock.ev.on('creds.update', saveCreds);

    // האזנה להודעות חדשות
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                if (msg.key.fromMe) continue; // מתעלם מהודעות שאני שלחתי

                const body = getMessageText(msg);
                
                // === הלוגיקה העסקית שלך ===
                if (!body.includes('שלום הגעתי דרך')) continue;

                const regex = /שלום הגעתי דרך\s+(.+)/i;
                const match = body.match(regex);

                if (match && match[1]) {
                    // חילוץ מספר טלפון (Baileys נותן פורמט 97250...@s.whatsapp.net)
                    const senderPhone = msg.key.remoteJid.replace('@s.whatsapp.net', '');
                    const senderRealName = msg.pushName || senderPhone;

                    let rawName = match[1].trim().split(/\n/)[0];
                    const finalReferrer = await getOfficialReferrerName(rawName);

                    console.log(`🎯 זוהה ליד (Baileys): ${senderRealName}, מפנה: ${finalReferrer}`);

                    // שמירה ב-DB (בדיוק כמו בקוד הקודם)
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

                    // שליחת Push
                    sendPushToAll({
                        title: `ליד חדש: ${senderRealName}`,
                        body: `הגיע דרך: ${finalReferrer}`,
                        url: '/leads'
                    });
                }
            } catch (err) {
                console.error('Error processing message:', err);
            }
        }
    });
}

export const initWhatsAppListener = () => {
    startWhatsApp().catch(err => console.error("Baileys Init Error:", err));
};