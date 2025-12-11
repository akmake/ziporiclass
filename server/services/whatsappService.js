import { makeWASocket, DisconnectReason, BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import mongoose from 'mongoose';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import { sendPushToAll } from '../utils/pushHandler.js';

// === 1. הגדרת מודל מהיר לשמירת סשן במונגו ===
const sessionSchema = new mongoose.Schema({
    _id: String, // המפתח (למשל 'creds' או מפתחות הצפנה)
    data: Object // המידע עצמו
});
const Session = mongoose.models.WhatsAppSession || mongoose.model('WhatsAppSession', sessionSchema);

// === 2. פונקציית Auth מותאמת למונגו (מחליפה את הקבצים) ===
const useMongoDBAuthState = async () => {
    // פונקציה לכתיבת מידע
    const writeData = async (data, key) => {
        try {
            await Session.findByIdAndUpdate(key, { data }, { upsert: true });
        } catch (error) {
            console.error('Failed to save session to DB:', error);
        }
    };

    // פונקציה לקריאת מידע
    const readData = async (key) => {
        try {
            const doc = await Session.findById(key);
            return doc ? doc.data : null;
        } catch (error) {
            console.error('Failed to read session from DB:', error);
            return null;
        }
    };

    // טעינת או יצירת קרדנציאלים
    const creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = BufferJSON.reviver(null, value);
                        }
                        if (value) data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            // מחיקה או שמירה
                            if (value === null) {
                                tasks.push(Session.findByIdAndDelete(key));
                            } else {
                                tasks.push(writeData(value, key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
};

// === 3. לוגיקה עסקית (זיהוי לידים) ===
async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim().replace(/[.,;!?-]$/, '');
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

const getMessageText = (msg) => {
    if (!msg.message) return '';
    return msg.message.conversation || 
           msg.message.extendedTextMessage?.text || 
           msg.message.imageMessage?.caption || 
           '';
};

let sock;

async function startWhatsApp() {
    console.log('🔄 מפעיל את Baileys עם שמירה ל-MongoDB...');

    if (mongoose.connection.readyState !== 1) {
        await new Promise(resolve => mongoose.connection.once('open', resolve));
    }

    // שימוש באותנטיקציה מול מונגו במקום קבצים
    const { state, saveCreds } = await useMongoDBAuthState();

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Zipori Cloud", "Chrome", "10.0"],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 2000
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QR RECEIVED. Scan this with your phone:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                startWhatsApp();
            } else {
                console.log('⚠️ נותקנו סופית (Logout). יש למחוק את הסשן ממונגו כדי לסרוק מחדש.');
                // אופציונלי: כאן אפשר למחוק את הסשן מה-DB אוטומטית
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected & Saved to DB!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        for (const msg of messages) {
            try {
                if (msg.key.fromMe) continue;

                // סינון הודעות ישנות (מעל 2 דקות)
                const messageTimestamp = typeof msg.messageTimestamp === 'number' 
                    ? msg.messageTimestamp 
                    : msg.messageTimestamp.low;
                if ((Date.now() / 1000) - messageTimestamp > 120) continue;

                const body = getMessageText(msg);
                
                // לוג לשרת
                console.log(`📩 הודעה: ${body.substring(0, 30)}...`);

                if (!body.includes('שלום הגעתי דרך')) continue;

                const regex = /שלום הגעתי דרך\s+(.+)/i;
                const match = body.match(regex);

                if (match && match[1]) {
                    const senderPhone = msg.key.remoteJid.replace('@s.whatsapp.net', '');
                    const senderRealName = msg.pushName || senderPhone;
                    let rawName = match[1].trim().split(/\n/)[0];
                    const finalReferrer = await getOfficialReferrerName(rawName);

                    console.log(`🎯 ליד חדש נשמר: ${senderRealName}`);

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
            } catch (err) {
                console.error('Error processing message:', err);
            }
        }
    });
}

export const initWhatsAppListener = () => {
    startWhatsApp().catch(err => console.error("Baileys Init Error:", err));
};