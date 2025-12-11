import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import InboundEmail from '../models/InboundEmail.js';     
import ReferrerAlias from '../models/ReferrerAlias.js';   
import { sendPushToAll } from '../utils/pushHandler.js';  

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
            const body = msg.body || '';

            if (!body.includes('שלום הגעתי דרך')) {
                return; 
            }

            const regex = /שלום הגעתי דרך\s+(.+)/i;
            const match = body.match(regex);

            if (match && match[1]) {
                const senderPhone = msg.from.replace('@c.us', '');
                
                // --- תיקון: שליפת שם ללא קריסה ---
                // במקום הפונקציה getContact שקורסת, אנחנו בודקים אם השם הגיע עם ההודעה עצמה.
                // אם אין שם, נשתמש במספר הטלפון.
                let senderRealName = senderPhone;
                if (msg._data && msg._data.notifyName) {
                    senderRealName = msg._data.notifyName;
                }
                // --------------------------------

                let rawName = match[1].trim().split(/\n/)[0];
                const finalReferrer = await getOfficialReferrerName(rawName);

                console.log(`🎯 זוהה ליד: ${senderRealName}, מפנה: ${finalReferrer}`);

                await InboundEmail.create({
                    from: 'WhatsApp',
                    type: 'הודעת וואטסאפ',
                    body: body,
                    receivedAt: new Date(),
                    status: 'new',
                    
                    parsedName: senderRealName, // השם שהצלחנו לחלץ או הטלפון
                    
                    parsedPhone: senderPhone,
                    parsedNote: body,
                    referrer: finalReferrer, 
                    hotel: null,
                    handledBy: null
                });

                sendPushToAll({
                    title: `ליד חדש: ${senderRealName}`,
                    body: `הגיע דרך: ${finalReferrer}`,
                    url: '/leads'
                });
            }

        } catch (error) {
            console.error('❌ Error processing WhatsApp message:', error);
        }
    });

    client.initialize();
};