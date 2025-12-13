import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import LeadTrigger from '../models/LeadTrigger.js';
import { sendPushToAll } from '../utils/pushHandler.js';

// === פונקציות עזר ===

// נרמול שם מפנה
async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim().replace(/[.,;!?-]$/, '');
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

// === פונקציה אגרסיבית לחילוץ מספר אמיתי (Anti-LID) ===
async function getTruePhoneNumber(msg, client) {
    let candidate = null;

    // נסיון 1: בדיקת ה-Author/From הרגיל
    let rawFrom = msg.author || msg.from;
    if (rawFrom.includes('@c.us')) {
        return rawFrom.split('@')[0]; // זהו, יש לנו מספר
    }

    // נסיון 2: חילוץ דרך אובייקט ה-Chat (הכי אמין ל-LID)
    try {
        const chat = await msg.getChat();
        // ה-Chat ID לרוב מחזיק את המספר המקורי גם אם ההודעה הגיעה מ-LID
        if (chat && chat.id && chat.id.user) {
            candidate = chat.id.user;
            // אם זה לא LID (לא מתחיל ב-1 וארוך), זה המספר
            if (!candidate.includes('@lid') && candidate.length < 15) {
                return candidate;
            }
        }
    } catch (e) {
        console.log('Error fetching chat for number resolution');
    }

    // נסיון 3: המרה כפויה דרך Contact
    try {
        const contact = await msg.getContact();
        if (contact && contact.number) {
            return contact.number;
        }
    } catch (e) { }

    // נסיון 4: בדיקה במידע הגולמי הנסתר (_data)
    if (msg._data && msg._data.id && msg._data.id.remote) {
        const remote = msg._data.id.remote;
        if (remote.includes('@c.us')) {
            return remote.split('@')[0];
        }
    }

    // אם הכל נכשל, מחזירים את מה שיש (גם אם זה LID), אבל ברוב המקרים נסיון 2 יפתור את זה
    return rawFrom.split('@')[0];
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
            // 1. סינון סטטוסים
            if (msg.isStatus || msg.from === 'status@broadcast') {
                return; 
            }

            // === חילוץ מספר באמצעות הפונקציה החדשה ===
            const senderPhone = await getTruePhoneNumber(msg, client);
            
            // חילוץ שם
            const rawData = msg._data || {};
            const pushName = rawData.notifyName || rawData.pushname || null;
            const senderRealName = pushName || senderPhone;

            console.log(`🔎 בדיקה סופית: שם: ${senderRealName} | טלפון: ${senderPhone}`);
            
            // אזהרה ויזואלית במידה ועדיין חוזר LID
            if (senderPhone.length > 15 && senderPhone.startsWith('1')) {
                console.warn('⚠️ אזהרה: המספר שחזר עדיין נראה כמו מזהה מוצפן. ייתכן והלקוח משתמש בהגדרות פרטיות מתקדמות.');
            }
            // ========================================================

            const bodyRaw = msg.body || '';
            const bodyLower = bodyRaw.toLowerCase();
            
            // === בדיקה 1: לקוח חדש? ===
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const lastLead = await InboundEmail.findOne({ 
                parsedPhone: senderPhone 
            }).sort({ receivedAt: -1 });

            const isNewConversation = !lastLead || new Date(lastLead.receivedAt) < thirtyDaysAgo;

            // === בדיקה 2: טריגר? ===
            const activeTriggers = await LeadTrigger.find({ isActive: true }).lean();
            const matchedTrigger = activeTriggers.find(t => bodyLower.includes(t.text));
            
            // === החלטה ===
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

                console.log(`🎯 ליד חדש נפתח: ${senderRealName}`);

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
                    body: matchedTrigger 
                        ? `זוהה: "${matchedTrigger.text}" ${finalReferrer ? `(מאת ${finalReferrer})` : ''}` 
                        : 'לקוח התחיל שיחה חדשה',
                    url: '/leads'
                });

            } else {
                console.log(`⏩ שיחה שוטפת: ${senderRealName}`);
            }

        } catch (error) {
            console.error('❌ Error processing WhatsApp message:', error);
        }
    });

    client.initialize();
};