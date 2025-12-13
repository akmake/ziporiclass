// server/services/whatsappService.js

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
            // סינון הודעות סטטוס ומערכת
            if (msg.isStatus || msg.from === 'status@broadcast') return;

            // === 🛠️ תיקון ה-LID (2025 Fix) 🛠️ ===
            let senderPhone = null;

            if (msg.from.includes('@lid')) {
                try {
                    // המרה של ה-LID למספר אמיתי דרך אובייקט איש הקשר
                    const contact = await client.getContactById(msg.from);
                    
                    if (contact && contact.number) {
                        senderPhone = contact.number; // המספר האמיתי (למשל 97250...)
                        console.log(`✅ LID Resolved: ${msg.from} -> ${senderPhone}`);
                    } else {
                        // במקרה נדיר שהמרה נכשלת, ניקח את החלק הראשון (עדיף מכלום)
                        senderPhone = msg.from.split('@')[0];
                        console.warn(`⚠️ Could not resolve LID completely: ${msg.from}`);
                    }
                } catch (err) {
                    console.error('Error resolving LID:', err.message);
                    senderPhone = msg.from.split('@')[0]; // Fallback
                }
            } else {
                // הודעה רגילה (c.us) - פשוט מנקים את הסיומת
                senderPhone = msg.from.replace('@c.us', '');
            }
            // ==========================================

            // זיהוי שם השולח (Pushname או שם שמור)
            const senderName = msg._data.notifyName || msg.pushname || senderPhone;

            console.log(`📩 הודעה חדשה מ: ${senderName} (${senderPhone})`);

            // מכאן הלוגיקה שלך ממשיכה כרגיל...
            const bodyRaw = msg.body || '';
            const bodyLower = bodyRaw.toLowerCase();

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // בדיקת ליד קיים לפי המספר *המתוקן*
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
                    
                    // נתונים מתוקנים:
                    parsedName: senderName,
                    parsedPhone: senderPhone, // עכשיו זה המספר האמיתי!
                    
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

// פונקציות עזר לייצוא
export const sendWhatsAppMessage = async ({ chatId, text }) => {
    // וידוא פורמט תקין לשליחה (כאן אנחנו שולחים, אז משתמשים ב-c.us רגיל)
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