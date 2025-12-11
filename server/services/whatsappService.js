import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import mongoose from 'mongoose';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import { sendPushToAll } from '../utils/pushHandler.js';

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
    console.log('🔄 מפעיל את Baileys WhatsApp Listener (גרסה יציבה)...');

    if (mongoose.connection.readyState !== 1) {
        await new Promise(resolve => mongoose.connection.once('open', resolve));
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Zipori Server", "Chrome", "10.0"],
        // === תיקון 1: הגדרות רשת למניעת ניתוקים ===
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000, // שולח פינג כל 10 שניות
        retryRequestDelayMs: 2000
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QR RECEIVED. Scan this with your phone:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            // זיהוי אם הניתוק הוא "בעיטה" (לוגאאוט) או סתם נפילה
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Connection closed. Reconnecting:', shouldReconnect);
            
            // אם זה סתם ניתוק רשת, נסה להתחבר שוב מיד
            if (shouldReconnect) {
                startWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected! Ready for NEW messages.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // בודקים כל הודעה שנכנסת
        for (const msg of messages) {
            try {
                if (msg.key.fromMe) continue;

                // === תיקון 2: התעלמות מהודעות ישנות (היסטוריה) ===
                // אם ההודעה בת יותר מ-2 דקות (120 שניות), דלג עליה
                const messageTimestamp = typeof msg.messageTimestamp === 'number' 
                    ? msg.messageTimestamp 
                    : msg.messageTimestamp.low;
                
                const secondsAgo = (Date.now() / 1000) - messageTimestamp;
                
                if (secondsAgo > 120) {
                    // לוג שקט כדי שתדע שזה קורה
                    // console.log(`⏳ Skipped old message (${Math.round(secondsAgo)}s ago)`);
                    continue;
                }

                const body = getMessageText(msg);
                
                // לוג דיבוג לשרת: מראה כל הודעה שנכנסת בזמן אמת
                console.log(`📩 הודעה נכנסה: ${body.substring(0, 30)}...`);

                if (!body.includes('שלום הגעתי דרך')) continue;

                const regex = /שלום הגעתי דרך\s+(.+)/i;
                const match = body.match(regex);

                if (match && match[1]) {
                    const senderPhone = msg.key.remoteJid.replace('@s.whatsapp.net', '');
                    const senderRealName = msg.pushName || senderPhone;
                    let rawName = match[1].trim().split(/\n/)[0];
                    const finalReferrer = await getOfficialReferrerName(rawName);

                    console.log(`🎯 ליד חדש זוהה ונשמר: ${senderRealName}`);

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