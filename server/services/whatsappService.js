// server/services/whatsappService.js

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import LeadTrigger from '../models/LeadTrigger.js'; // ✨ המודל החדש
import { sendPushToAll } from '../utils/pushHandler.js';

// פונקציית עזר לניקוי שמות (כמו קודם)
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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

export const initWhatsAppListener = () => {
    console.log('🔄 מפעיל את שירות הוואטסאפ...');

    client.on('qr', (qr) => {
        console.log('QR RECEIVED. Scan this with your phone:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp Client is ready!');
    });

    client.on('message', async (msg) => {
        try {
            const bodyRaw = msg.body || '';
            const bodyLower = bodyRaw.toLowerCase();
            const senderPhone = msg.from.replace('@c.us', '');

            // 1. בדיקת חלון זמן (האם לקוח "חדש" שלא דיבר חודש)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // מחפשים את ההודעה האחרונה שקיבלנו מהמספר הזה
            const lastMessage = await InboundEmail.findOne({ 
                parsedPhone: senderPhone 
            }).sort({ receivedAt: -1 }); // החדש ביותר ראשון

            // תנאי ללקוח חדש/חוזר: אין הודעות בכלל, או שההודעה האחרונה ישנה מ-30 יום
            const isNewConversation = !lastMessage || new Date(lastMessage.receivedAt) < thirtyDaysAgo;

            // 2. בדיקת מילות מפתח דינמיות
            // שולפים את כל הטריגרים הפעילים מה-DB
            const activeTriggers = await LeadTrigger.find({ isActive: true }).lean();
            
            // בודקים אם ההודעה מכילה את אחד הטריגרים (כמו "הצעת מחיר", "הגעתי דרך")
            // אם הטריגר הוא "הגעתי דרך", ננסה לחלץ שם כמו קודם
            const matchedTrigger = activeTriggers.find(t => bodyLower.includes(t.text));
            
            // === ההחלטה: האם ליצור ליד? ===
            // יוצרים ליד אם: עבר חודש מאז השיחה האחרונה (התחלה חדשה) OR נמצאה מילת מפתח
            if (isNewConversation || matchedTrigger) {

                // לוגיקה לזיהוי שם (כמו קודם)
                let senderRealName = senderPhone;
                if (msg._data && msg._data.notifyName) {
                    senderRealName = msg._data.notifyName;
                }

                // ניסיון חילוץ מפנה (אם הטריגר היה קשור למפנים, או אם סתם יש את הטקסט)
                let finalReferrer = null;
                const referrerRegex = /(?:הגעתי|פניתי|באתי)\s*(?:דרך|מ|מה|בהמלצת|ע"י)\s+(.+)/i;
                const match = bodyRaw.match(referrerRegex);
                
                if (match && match[1]) {
                    let rawName = match[1].trim().split(/\n/)[0]; // לוקח את השורה הראשונה אחרי הטריגר
                    finalReferrer = await getOfficialReferrerName(rawName);
                }

                console.log(`🎯 זוהה ליד חדש!`);
                console.log(`👤 שם: ${senderRealName}`);
                console.log(`📞 סיבה: ${isNewConversation ? 'שיחה חדשה (עבר חודש/פעם ראשונה)' : `מילת מפתח: ${matchedTrigger.text}`}`);

                // שמירה כליד
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
                    body: matchedTrigger ? `זוהה ביטוי: "${matchedTrigger.text}"` : 'לקוח חדש/חוזר (התחיל שיחה)',
                    url: '/leads'
                });
            } else {
                // אם זה לקוח שדיבר איתנו לאחרונה (פחות מחודש) וסתם כתב הודעה בלי מילת מפתח - מתעלמים.
                console.log(`⏩ הודעה שוטפת מ-${senderPhone} (דיברנו ב-30 יום האחרונים), לא נוצר ליד.`);
            }

        } catch (error) {
            console.error('❌ Error processing WhatsApp message:', error);
        }
    });

    client.initialize();
};