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
            if (msg.isStatus || msg.from === 'status@broadcast') return;

            const chat = await msg.getChat();

            // ============================================================
            // 🛑 חלק 1: חילוץ שם וטלפון (הגרסה שעבדה!) 🛑
            // ============================================================

            const senderName = msg._data.notifyName || msg.pushname || "Unknown";
            
            let rawPhone = chat.name; 
            // גיבוי למקרה שאין שם צ'אט
            if (!rawPhone) {
                 rawPhone = msg.from.replace('@c.us', '');
            }

            // ניקוי המספר מכל מה שאינו ספרה
            const finalPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';

            // ============================================================
            // 🛑 חלק 2: התיקון לטקסט הנעלם 🛑
            // ============================================================

            // אנחנו מנסים לשלוף את הטקסט מ-3 מקומות שונים ליתר ביטחון
            let bodyRaw = msg.body;

            // בדיקת גיבוי: אם ה-body ריק, נסה לשלוף מהמידע הפנימי (_data)
            if (!bodyRaw && msg._data && msg._data.body) {
                bodyRaw = msg._data.body;
            }

            // בדיקת גיבוי 2: אם זה עדיין ריק, אולי זה קפשן של תמונה/מדיה?
            if (!bodyRaw && msg.hasMedia && msg.caption) {
                bodyRaw = msg.caption;
            }
            
            // וידוא סופי שלא יהיה null
            if (!bodyRaw) bodyRaw = '';

            // לוג מיוחד כדי שנראה בעיניים מה מגיע
            console.log(`🔍 דיבאג הודעה >> שם: ${senderName} | טקסט שנקלט: "${bodyRaw}"`);
            
            // ============================================================

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

                console.log(`✅ שומר ליד חדש עם תוכן: ${bodyRaw}`);

                await InboundEmail.create({
                    from: 'WhatsApp',
                    type: matchedTrigger ? `וואטסאפ (${matchedTrigger.text})` : 'וואטסאפ (שיחה חדשה)',
                    body: bodyRaw, // זה התוכן שאמור להופיע עכשיו
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