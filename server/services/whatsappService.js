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
            // 🛑 חילוץ וניקוי נתונים 🛑
            // ============================================================

            // 1. שם: לוקחים מהכינוי שהמשתמש בחר
            const senderName = msg._data.notifyName || msg.pushname || "Unknown";

            // 2. טלפון גולמי: לוקחים את מה שמופיע בכותרת הצ'אט (המספר עם ה-+, סוגריים וכו')
            let rawPhone = chat.name; 

            // גיבוי: אם אין שם צ'אט, לוקחים את ה-ID
            if (!rawPhone) {
                 rawPhone = msg.from.replace('@c.us', '');
            }

            // 3. 🛑 הניקוי (החלק החדש): מוחקים כל מה שהוא לא ספרה! 🛑
            // הופך את "+1 (347) 770-0657" ל- "13477700657"
            // אם rawPhone הוא null/undefined, נחזיר מחרוזת ריקה כדי לא לקרוס
            const finalPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';

            // ============================================================

            console.log(`📩 הודעה מ: ${senderName} | מקור: ${rawPhone} | נשמר כ: ${finalPhone}`);

            const bodyRaw = msg.body || '';
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
                    parsedPhone: finalPhone, // עכשיו זה נקי ומוכן לוואטסאפ
                    
                    parsedNote: bodyRaw,
                    referrer: finalReferrer,
                    hotel: null,
                    handledBy: null
                });

                sendPushToAll({
                    title: `ליד חדש: ${senderName}`,
                    body: matchedTrigger ? `זוהה: "${matchedTrigger.text}"` : 'לקוח התחיל שיחה חדשה',
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