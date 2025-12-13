import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import LeadTrigger from '../models/LeadTrigger.js';
import { sendPushToAll } from '../utils/pushHandler.js';

// === פונקציות עזר ===

// 1. נרמול שם מפנה (בודק אם יש 'כינוי' ומחזיר את השם הרשמי)
async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim().replace(/[.,;!?-]$/, ''); // מנקה סימני פיסוק בסוף
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

// 2. נרמול מספר טלפון (משאיר פורמט בינלאומי מלא ללא @c.us)
function cleanPhoneNumber(wid) {
    return wid.replace('@c.us', '');
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
            // 🛑 1. סינון סטטוסים (Stories) - כדי למנוע ספאם
            if (msg.isStatus || msg.from === 'status@broadcast') {
                return; 
            }

            const bodyRaw = msg.body || '';
            const bodyLower = bodyRaw.toLowerCase();
            
            // 🛑 2. קבלת מספר טלפון נקי (למשל 97250...)
            const senderPhone = cleanPhoneNumber(msg.from);

            // === בדיקה 1: האם זה לקוח "חדש" (לא דיבר 30 יום)? ===
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // מחפשים את הליד האחרון מהטלפון הזה
            const lastLead = await InboundEmail.findOne({ 
                parsedPhone: senderPhone 
            }).sort({ receivedAt: -1 });

            // האם עבר חודש מאז ההודעה האחרונה (או שאין בכלל)?
            const isNewConversation = !lastLead || new Date(lastLead.receivedAt) < thirtyDaysAgo;

            // === בדיקה 2: האם יש מילת מפתח (טריגר)? ===
            // שולפים את המילים שהמנהל הגדיר מהדאטה-בייס
            const activeTriggers = await LeadTrigger.find({ isActive: true }).lean();
            
            // בודקים אם גוף ההודעה מכיל את אחת המילים
            const matchedTrigger = activeTriggers.find(t => bodyLower.includes(t.text));
            
            // === החלטה: האם לפתוח ליד? ===
            // פותחים אם: (לקוח חדש/חוזר) או (נמצאה מילת מפתח)
            if (isNewConversation || matchedTrigger) {

                // ניסיון להשיג את שם השולח מהפרופיל שלו בוואטסאפ
                let senderRealName = senderPhone;
                if (msg._data && msg._data.notifyName) {
                    senderRealName = msg._data.notifyName;
                }

                // 🛑 3. חילוץ שם המפנה (2 המילים אחרי הטריגר)
                let finalReferrer = null;

                if (matchedTrigger) {
                    // מוצאים איפה המילה נגמרת
                    const triggerIndex = bodyLower.indexOf(matchedTrigger.text);
                    // לוקחים את כל הטקסט שמופיע *אחרי* מילת המפתח
                    const textAfterTrigger = bodyRaw.substring(triggerIndex + matchedTrigger.text.length).trim();
                    
                    if (textAfterTrigger) {
                        // לוקחים את 2 המילים הראשונות (למשל: "יוסי כהן")
                        let rawReferrerName = textAfterTrigger.split(/\s+/).slice(0, 2).join(' ');
                        // בודקים אם יש לשם הזה "תרגום" רשמי במערכת
                        finalReferrer = await getOfficialReferrerName(rawReferrerName);
                    }
                }

                console.log(`🎯 ליד חדש נוצר!`);
                console.log(`👤 שם: ${senderRealName} | טלפון: ${senderPhone}`);
                console.log(`🔍 סיבה: ${matchedTrigger ? `מילת מפתח ("${matchedTrigger.text}")` : 'לקוח חדש/חוזר'}`);
                if (finalReferrer) console.log(`🔗 מפנה שזוהה: ${finalReferrer}`);

                // שמירה לדאטהבייס
                await InboundEmail.create({
                    from: 'WhatsApp',
                    // סוג הליד: מציג את הטריגר או מציין שזו שיחה חדשה
                    type: matchedTrigger ? `וואטסאפ (${matchedTrigger.text})` : 'וואטסאפ (שיחה חדשה)',
                    body: bodyRaw,
                    receivedAt: new Date(),
                    status: 'new',
                    
                    // השדות המעובדים
                    parsedName: senderRealName,
                    parsedPhone: senderPhone, // המספר הנקי
                    parsedNote: bodyRaw,
                    referrer: finalReferrer, // השם שחילצנו (אם יש)
                    
                    hotel: null,
                    handledBy: null
                });

                // שליחת התראה (Push) למשתמשים
                sendPushToAll({
                    title: `ליד חדש: ${senderRealName}`,
                    // גוף ההודעה מותאם למצב
                    body: matchedTrigger 
                        ? `זוהה ביטוי: "${matchedTrigger.text}" ${finalReferrer ? `(מאת ${finalReferrer})` : ''}` 
                        : 'לקוח חדש/חוזר התחיל שיחה',
                    url: '/leads'
                });

            } else {
                // הלקוח בתוך חלון ה-30 יום וסתם מקשקש בלי מילת מפתח - מתעלמים
                console.log(`⏩ הודעה שוטפת מ-${senderPhone} (בתוך חלון ה-30 יום), לא נפתח ליד.`);
            }

        } catch (error) {
            console.error('❌ Error processing WhatsApp message:', error);
        }
    });

    client.initialize();
};