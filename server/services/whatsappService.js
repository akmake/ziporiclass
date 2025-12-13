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

// === הפתרון הסופי: שאילתה לשרת (Server Lookup) ===
async function resolvePhoneNumber(msg, client) {
    const rawId = msg.author || msg.from;

    // 1. אם זה כבר מספר תקין, מחזירים אותו
    if (rawId.includes('@c.us')) {
        return rawId.split('@')[0];
    }

    // 2. אם זה LID או כל דבר אחר - שולחים שאילתה לשרת
    try {
        // הפקודה הזו מכריחה את השרת להחזיר את המזהה האמיתי (c.us)
        // היא עובדת גם אם המספר לא באנשי הקשר שלך
        const resolved = await client.getNumberId(rawId);
        
        if (resolved && resolved._serialized) {
            return resolved.user; // .user תמיד מכיל את המספר הנקי (למשל 97250...)
        }
    } catch (error) {
        console.error('SERVER LOOKUP FAILED:', error);
    }

    // Fallback: במקרה קיצון שהשרת לא הגיב, מנסים לחלץ מהצ'אט
    try {
        const chat = await msg.getChat();
        if (chat.isGroup === false) {
             // בשיחה פרטית, ה-ID של הצ'אט הוא המספר
             return chat.id.user;
        }
    } catch (e) {}

    // אם הגענו לפה, יש כשל מערכתי בספרייה מול וואטסאפ
    return rawId.split('@')[0];
}

// === הגדרת הלקוח ===
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// === הפונקציה הראשית ===
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

            // שימוש בפונקציה שפונה לשרת
            const senderPhone = await resolvePhoneNumber(msg, client);
            
            // חילוץ שם (מהמידע הגולמי שמגיע עם ההודעה)
            const rawData = msg._data || {};
            const senderRealName = rawData.notifyName || rawData.pushname || senderPhone;

            console.log(`🎯 זיהוי סופי ומוחלט: ${senderRealName} (${senderPhone})`);

            // === מכאן הלוגיקה שלך רגילה ===
            const bodyRaw = msg.body || '';
            const bodyLower = bodyRaw.toLowerCase();
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const lastLead = await InboundEmail.findOne({ 
                parsedPhone: senderPhone 
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

                console.log(`✅ שומר ליד חדש לדאטהבייס...`);

                await InboundEmail.create({
                    from: 'WhatsApp',
                    type: matchedTrigger ? `וואטסאפ (${matchedTrigger.text})` : 'וואטסאפ (שיחה חדשה)',
                    body: bodyRaw,
                    receivedAt: new Date(),
                    status: 'new',
                    parsedName: senderRealName,
                    parsedPhone: senderPhone,
                    parsedNote: bodyRaw,
                    referrer: finalReferrer, 
                    hotel: null,
                    handledBy: null
                });

                sendPushToAll({
                    title: `ליד חדש: ${senderRealName}`,
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