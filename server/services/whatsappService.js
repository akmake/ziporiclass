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

// === הגדרת הלקוח ===
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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

            // === 🛑 התיקון: חילוץ נתונים ישיר (ללא getContact) 🛑 ===
            
            // חילוץ טלפון: חותכים את ה-@c.us מה-ID
            // אם זו קבוצה, לוקחים את ה-author (השולח), אחרת את ה-from
            let senderPhone = (msg.author || msg.from).split('@')[0];

            // חילוץ שם: מנסים לקחת את ה-PushName (הכינוי בוואטסאפ)
            // אנחנו ניגשים לשדה _data שהוא שדה פנימי שמכיל את המידע הגולמי
            const rawData = msg._data || {};
            const pushName = rawData.notifyName || null;
            
            // שם סופי: אם יש כינוי - מעולה, אם אין - משתמשים במספר הטלפון כשם
            const senderRealName = pushName || senderPhone;

            console.log(`🔎 זיהוי הודעה: שם: ${senderRealName} | טלפון: ${senderPhone}`);
            // ========================================================

            const bodyRaw = msg.body || '';
            const bodyLower = bodyRaw.toLowerCase();
            
            // === מכאן הלוגיקה שלך ממשיכה כרגיל ===
            
            // === בדיקה 1: האם זה לקוח "חדש" (לא דיבר 30 יום)? ===
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const lastLead = await InboundEmail.findOne({ 
                parsedPhone: senderPhone 
            }).sort({ receivedAt: -1 });

            const isNewConversation = !lastLead || new Date(lastLead.receivedAt) < thirtyDaysAgo;

            // === בדיקה 2: האם יש מילת מפתח (טריגר)? ===
            const activeTriggers = await LeadTrigger.find({ isActive: true }).lean();
            const matchedTrigger = activeTriggers.find(t => bodyLower.includes(t.text));
            
            // === החלטה: האם לפתוח ליד? ===
            if (isNewConversation || matchedTrigger) {

                // 3. חילוץ שם המפנה
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
                    parsedPhone: senderPhone,
                    parsedNote: bodyRaw,
                    referrer: finalReferrer, 
                    
                    hotel: null,
                    handledBy: null
                });

                // שליחת התראה
                sendPushToAll({
                    title: `ליד חדש: ${senderRealName}`,
                    body: matchedTrigger 
                        ? `זוהה: "${matchedTrigger.text}" ${finalReferrer ? `(מאת ${finalReferrer})` : ''}` 
                        : 'לקוח התחיל שיחה חדשה',
                    url: '/leads'
                });

            } else {
                console.log(`⏩ שיחה קיימת: ${senderRealName}`);
            }

        } catch (error) {
            console.error('❌ Error processing WhatsApp message:', error);
        }
    });

    client.initialize();
};