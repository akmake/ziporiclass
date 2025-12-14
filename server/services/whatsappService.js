import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import LeadTrigger from '../models/LeadTrigger.js';
import { sendPushToAll } from '../utils/pushHandler.js';

// === פונקציות עזר ===

async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim().replace(/[.,;!?-]$/, '');
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu']
    }
});

export const initWhatsAppListener = () => {
    console.log('🔄 מפעיל את שירות הוואטסאפ...');

    client.on('qr', (qr) => {
        console.log('QR RECEIVED:', qr);
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp Client is ready!');
    });

    client.on('message', async (msg) => {
        try {
            // ============================================================
            // 🛑 חלק חדש: מנגנון סינון הודעות זבל (Anti-Duplicate) 🛑
            // ============================================================
            
            // 1. רשימת סוגים טכניים שאנחנו לא רוצים לשמור
            const ignoredTypes = ['e2e_notification', 'cipher', 'call_log', 'protocol', 'gp2'];
            
            if (msg.isStatus || msg.from === 'status@broadcast') return; // סטטוסים
            if (ignoredTypes.includes(msg.type)) {
                // console.log(`🗑️ הודעה טכנית סוננה מסוג: ${msg.type}`);
                return;
            }

            // 2. אם ההודעה ריקה לגמרי (אין טקסט ואין מדיה) - דלג
            // זה מעיף את ה"Unknown" הריקים שראית
            if (!msg.body && !msg.hasMedia && !msg._data.body) {
                // console.log(`🗑️ הודעה ריקה סוננה`);
                return;
            }

            // ============================================================
            // 🛑 חלק 1: חילוץ שם וטלפון (הגרסה שעבדה) 🛑
            // ============================================================

            const chat = await msg.getChat();

            const senderName = msg._data.notifyName || msg.pushname || "Unknown";
            
            let rawPhone = chat.name; 
            if (!rawPhone) {
                 rawPhone = msg.from.replace('@c.us', '');
            }

            // ניקוי המספר (Sanitization)
            const finalPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';

            // ============================================================
            // 🛑 חלק 2: חילוץ הטקסט (שרשרת הבדיקות) 🛑
            // ============================================================

            let bodyRaw = msg.body;

            if (!bodyRaw && msg._data && msg._data.body) {
                bodyRaw = msg._data.body;
            }

            if (!bodyRaw && msg.hasMedia && msg.caption) {
                bodyRaw = msg.caption;
            }
            
            // טיפול בסוגי מדיה ללא טקסט
            if (!bodyRaw && msg.hasMedia) {
                 if (msg.type === 'image') bodyRaw = '[תמונה]';
                 else if (msg.type === 'ptt' || msg.type === 'audio') bodyRaw = '[הודעה קולית]';
                 else if (msg.type === 'document') bodyRaw = '[קובץ]';
                 else bodyRaw = '[מדיה]';
            }

            if (!bodyRaw) bodyRaw = ''; // מונע קריסה

            // ============================================================

            console.log(`📩 הודעה תקינה מ: ${senderName} | טלפון: ${finalPhone} | תוכן: "${bodyRaw}"`);

            const bodyLower = bodyRaw.toLowerCase();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const lastLead = await InboundEmail.findOne({
                parsedPhone: finalPhone 
            }).sort({ receivedAt: -1 });

            const isNewConversation = !lastLead || new Date(lastLead.receivedAt) < thirtyDaysAgo;

            const activeTriggers = await LeadTrigger.find({ isActive: true }).lean();
            const matchedTrigger = activeTriggers.find(t => bodyLower.includes(t.text));

            if (isNewConversation || matchedTrigger) {
                let finalReferrer = null;
                
                if (matchedTrigger) {
                    const triggerIndex = bodyLower.indexOf(matchedTrigger.text);
                    const textAfterTrigger = bodyRaw.substring(triggerIndex + matchedTrigger.text.length).trim();
                    if (textAfterTrigger) {
                        let rawReferrerName = textAfterTrigger.split(/\s+/).slice(0, 2).join(' ');
                        finalReferrer = await getOfficialReferrerName(rawReferrerName);
                    }
                }

                console.log(`✅ שומר ליד חדש...`);

                await InboundEmail.create({
                    from: 'WhatsApp',
                    type: matchedTrigger ? `וואטסאפ (${matchedTrigger.text})` : 'וואטסאפ (שיחה חדשה)',
                    body: bodyRaw,
                    receivedAt: new Date(),
                    status: 'new',
                    
                    parsedName: senderName,
                    parsedPhone: finalPhone,
                    
                    parsedNote: bodyRaw,
                    referrer: finalReferrer,
                    hotel: null,
                    handledBy: null
                });

                sendPushToAll({
                    title: `ליד חדש: ${senderName}`,
                    body: matchedTrigger ? `זוהה: "${matchedTrigger.text}"` : (bodyRaw || 'הודעה חדשה'),
                    url: '/leads'
                });
            } else {
                console.log(`⏩ שיחה קיימת, מדלג.`);
            }

        } catch (error) {
            console.error('❌ Error processing WhatsApp message:', error);
        }
    });

    client.initialize();
};

export const sendWhatsAppMessage = async ({ chatId, text }) => {
    if (!chatId.includes('@c.us') && !chatId.includes('@g.us') && !chatId.includes('@lid')) {
        chatId = `${chatId}@c.us`;
    }
    await client.sendMessage(chatId, text);
};

export const getWhatsAppStatus = () => {
    return {
        isConnected: client?.info !== undefined,
        pushName: client?.info?.pushname,
        wid: client?.info?.wid
    };
};