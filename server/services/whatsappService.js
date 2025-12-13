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

// === פונקציה קריטית: חילוץ מספר אמיתי (מתמודד עם LID) ===
async function getTruePhoneNumber(msg, client) {
    // 1. קביעת ה-ID הגולמי (בקבוצה לוקחים את המחבר, בפרטי את השולח)
    let rawId = msg.author || msg.from;

    // 2. אם זה כבר בפורמט הישן והטוב (@c.us), פשוט חותכים
    if (rawId.includes('@c.us')) {
        return rawId.split('@')[0];
    }

    // 3. אם זה פורמט הפרטיות החדש (@lid), חייבים המרה
    if (rawId.includes('@lid')) {
        try {
            // שימוש בפונקציה הישירה של הלקוח (יציב יותר מ-msg.getContact)
            const contact = await client.getContactById(rawId);
            if (contact && contact.number) {
                return contact.number; // זה מחזיר את המספר האמיתי!
            }
        } catch (error) {
            console.error('⚠️ נכשל במיפוי LID למספר:', rawId, error.message);
        }
    }

    // 4. Fallback - מחזיר את החלק הראשון (עדיף מכלום, אבל ב-LID זה יהיה קוד)
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
            // 1. סינון סטטוסים
            if (msg.isStatus || msg.from === 'status@broadcast') {
                return; 
            }

            // === 🛑 התיקון: שימוש בפונקציית החילוץ החדשה 🛑 ===
            const senderPhone = await getTruePhoneNumber(msg, client);
            
            // חילוץ שם (PushName) מהמידע הגולמי - הכי מהיר
            const rawData = msg._data || {};
            const pushName = rawData.notifyName || rawData.pushname || null;
            
            // אם אין שם, משתמשים במספר
            const senderRealName = pushName || senderPhone;

            console.log(`🔎 זוהה: שם: ${senderRealName} | טלפון: ${senderPhone}`);
            // ========================================================

            const bodyRaw = msg.body || '';
            const bodyLower = bodyRaw.toLowerCase();
            
            // === בדיקה 1: האם זה לקוח "חדש" (לא דיבר 30 יום)? ===
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // חיפוש לפי המספר שחילצנו
            const lastLead = await InboundEmail.findOne({ 
                parsedPhone: senderPhone 
            }).sort({ receivedAt: -1 });

            const isNewConversation = !lastLead || new Date(lastLead.receivedAt) < thirtyDaysAgo;

            // === בדיקה 2: האם יש מילת מפתח? ===
            const activeTriggers = await LeadTrigger.find({ isActive: true }).lean();
            const matchedTrigger = activeTriggers.find(t => bodyLower.includes(t.text));
            
            // === החלטה: האם לפתוח ליד? ===
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

                console.log(`🎯 ליד חדש נוצר! מאת: ${senderRealName}`);

                // שמירה לדאטהבייס
                await InboundEmail.create({
                    from: 'WhatsApp',
                    type: matchedTrigger ? `וואטסאפ (${matchedTrigger.text})` : 'וואטסאפ (שיחה חדשה)',
                    body: bodyRaw,
                    receivedAt: new Date(),
                    status: 'new',
                    
                    parsedName: senderRealName,
                    parsedPhone: senderPhone, // נשמר המספר המומר
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