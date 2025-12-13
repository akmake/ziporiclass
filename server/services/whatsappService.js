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

            // === ✨ התיקון הסופי לזיהוי מספר טלפון ✨ ===
            // במקום להסתמך על המחרוזת msg.from שיכולה להיות מזהה מכשיר (LID)
            // אנחנו שולפים את אובייקט ה"איש קשר" המלא.
            const contact = await msg.getContact();
            
            // contact.number תמיד יכיל את מספר הטלפון האמיתי (למשל 972501234567)
            const senderPhone = contact.number; 
            
            // ניקח גם את השם האמיתי מהאובייקט הזה על הדרך
            const senderRealName = contact.name || contact.pushname || senderPhone;
            // ===============================================

            const bodyRaw = msg.body || '';
            const bodyLower = bodyRaw.toLowerCase();
            
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

                // 3. חילוץ שם המפנה (2 מילים אחרי הטריגר)
                let finalReferrer = null;

                if (matchedTrigger) {
                    const triggerIndex = bodyLower.indexOf(matchedTrigger.text);
                    const textAfterTrigger = bodyRaw.substring(triggerIndex + matchedTrigger.text.length).trim();
                    
                    if (textAfterTrigger) {
                        let rawReferrerName = textAfterTrigger.split(/\s+/).slice(0, 2).join(' ');
                        finalReferrer = await getOfficialReferrerName(rawReferrerName);
                    }
                }

                console.log(`🎯 ליד חדש נוצר!`);
                console.log(`📞 טלפון שזוהה: ${senderPhone}`); // וודא בלוג שזה המספר הנכון
                console.log(`👤 שם: ${senderRealName}`);

                // שמירה לדאטהבייס
                await InboundEmail.create({
                    from: 'WhatsApp',
                    type: matchedTrigger ? `וואטסאפ (${matchedTrigger.text})` : 'וואטסאפ (שיחה חדשה)',
                    body: bodyRaw,
                    receivedAt: new Date(),
                    status: 'new',
                    
                    parsedName: senderRealName,
                    parsedPhone: senderPhone, // ✨ המספר האמיתי
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
                console.log(`⏩ הודעה שוטפת מ-${senderRealName} (${senderPhone}) - בתוך חלון ה-30 יום.`);
            }

        } catch (error) {
            console.error('❌ Error processing WhatsApp message:', error);
        }
    });

    client.initialize();
};