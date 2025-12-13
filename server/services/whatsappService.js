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
            // 🛑 התיקון הקריטי: החלפה בין מקורות השם והטלפון 🛑
            // ============================================================

            // 1. שם השולח: לוקחים אך ורק מהכינוי שהמשתמש בחר (notifyName/pushname)
            // כדי שלא ייכנס לכאן מספר טלפון בטעות.
            let senderName = msg._data.notifyName || msg.pushname;

            // 2. חילוץ הטלפון:
            // ברירת המחדל היא ה-ID (שלפעמים יוצא מוזר כמו 1979...)
            let finalPhone = chat.id.user; 
            
            // המשתנה chat.name החזיק את המספר היפה (+1 347...) בתמונה ששלחת.
            // אנחנו בודקים: אם chat.name נראה כמו מספר טלפון (מכיל ספרות, פלוס, סוגריים)
            // אנחנו לוקחים אותו, מנקים ממנו את הסימנים, ושמים אותו ב-finalPhone!
            const chatTitle = chat.name || '';
            
            // הבדיקה: האם זה מכיל רק תווים של מספרי טלפון?
            if (/^[\d\+\-\(\)\s]+$/.test(chatTitle)) {
                // כן, זה מספר טלפון בפורמט יפה. בוא נהפוך אותו למספר נקי לדאטה-בייס.
                // הפעולה replace(/\D/g, '') משאירה רק ספרות.
                finalPhone = chatTitle.replace(/\D/g, ''); 
                console.log(`📞 תוקן מספר טלפון מתוך שם הצ'אט: ${chatTitle} -> ${finalPhone}`);
                
                // אם אין לנו שם שולח (כי המשתמש לא הגדיר), נשתמש במספר היפה כשם זמני
                if (!senderName) senderName = chatTitle;
            } else {
                // אם chat.name הוא לא מספר (למשל "משה כהן"), סימן שזה איש קשר שמור.
                // אז נשתמש בזה כשם אם חסר לנו שם.
                if (!senderName && chatTitle) senderName = chatTitle;
            }

            // ============================================================

            console.log(`📩 הודעה חדשה מ: ${senderName} (טלפון סופי: ${finalPhone})`);

            // --- המשך הלוגיקה כרגיל ---
            const bodyRaw = msg.body || '';
            const bodyLower = bodyRaw.toLowerCase();

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // חיפוש לפי המספר הסופי והמתוקן
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
                    
                    parsedName: senderName, // השם האמיתי
                    parsedPhone: finalPhone, // המספר הנכון (חולץ מ-chat.name)
                    
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