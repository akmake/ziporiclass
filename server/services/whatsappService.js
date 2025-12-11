import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import mongoose from 'mongoose';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import { sendPushToAll } from '../utils/pushHandler.js';

// --- מנגנון אימות מותאם ל-MongoDB (כדי שהחיבור יישמר ב-Render) ---
const useMongoDBAuthState = async (collectionName) => {
    const collection = mongoose.connection.db.collection(collectionName);
    
    // פונקציה לכתיבת נתונים
    const writeData = (data, key) => collection.updateOne({ _id: key }, { $set: { value: JSON.stringify(data, Buffer.from) } }, { upsert: true });
    
    // פונקציה לקריאת נתונים
    const readData = async (key) => {
        const result = await collection.findOne({ _id: key });
        if (result) return JSON.parse(result.value, (key, value) => {
            return value && value.type === 'Buffer' ? Buffer.from(value.data) : value;
        });
        return null;
    };

    // הסרת נתונים
    const removeData = (key) => collection.deleteOne({ _id: key });

    const creds = await readData('creds') || (await useMultiFileAuthState('temp_auth')).state.creds;

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value =  require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
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
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
};

// --- עזרים ללוגיקה העסקית שלך ---
async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim().replace(/[.,;!?-]$/, '');
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

let sock;

export const initWhatsAppListener = async () => {
    console.log('🔄 מפעיל את שירות הוואטסאפ (Baileys Light)...');

    if (mongoose.connection.readyState !== 1) {
        await new Promise(resolve => mongoose.connection.once('open', resolve));
    }

    const startSock = async () => {
        const { state, saveCreds } = await useMongoDBAuthState('baileys_auth_sessions');
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }), // לוגר שקט כדי לא להציף את הטרמינל
            printQRInTerminal: true, // ידפיס לך את ה-QR בטרמינל של Render
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            generateHighQualityLinkPreview: true,
        });

        // האזנה לעדכוני חיבור (ניתוקים, QR וכו')
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('⚡ אנא סרוק את הקוד החדש בטרמינל!');
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('❌ החיבור נותק. מנסה להתחבר מחדש?', shouldReconnect);
                if (shouldReconnect) {
                    startSock();
                } else {
                    console.log('⛔ נותקת מהוואטסאפ. יש למחוק את הקולקציה baileys_auth_sessions במונגו כדי לסרוק מחדש.');
                }
            } else if (connection === 'open') {
                console.log('✅ מחובר לוואטסאפ בהצלחה!');
            }
        });

        // שמירת אישורים במונגו
        sock.ev.on('creds.update', saveCreds);

        // האזנה להודעות חדשות
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            
            for (const msg of messages) {
                try {
                    if (!msg.message) continue;
                    
                    // חילוץ טקסט (Baileys תומך בכמה סוגי הודעות, זה מכסה את הרוב)
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                    
                    if (!text || !text.includes('שלום הגעתי דרך')) continue;

                    // --- הלוגיקה העסקית שלך ---
                    const regex = /שלום הגעתי דרך\s+(.+)/i;
                    const match = text.match(regex);

                    if (match && match[1]) {
                        const senderJid = msg.key.remoteJid; // לדוגמה: 972501234567@s.whatsapp.net
                        const senderPhone = senderJid.replace('@s.whatsapp.net', '');
                        
                        let senderRealName = msg.pushName || senderPhone; // Baileys נותן את ה-pushName בקלות
                        
                        let rawName = match[1].trim().split(/\n/)[0];
                        const finalReferrer = await getOfficialReferrerName(rawName);

                        console.log(`🎯 זוהה ליד חדש (Baileys): ${senderRealName}, מפנה: ${finalReferrer}`);

                        await InboundEmail.create({
                            from: 'WhatsApp',
                            type: 'הודעת וואטסאפ',
                            body: text,
                            receivedAt: new Date(),
                            status: 'new',
                            parsedName: senderRealName,
                            parsedPhone: senderPhone,
                            parsedNote: text,
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
                    console.error('❌ שגיאה בעיבוד הודעה:', err);
                }
            }
        });
    };

    startSock();
};