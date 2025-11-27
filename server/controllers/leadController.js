import InboundEmail from '../models/InboundEmail.js';
import ReferrerAlias from '../models/ReferrerAlias.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';

// עזר: מציאת שם רשמי
export async function getOfficialReferrerName(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim();
    const aliasEntry = await ReferrerAlias.findOne({ alias: cleanName });
    return aliasEntry ? aliasEntry.officialName : cleanName;
}

// עזר: ניתוח טקסט
export async function parseLeadBodyAsync(rawBody) {
  const data = {
    parsedName: null,
    parsedPhone: null,
    parsedNote: null,
    conversationLink: null,
    rawReferrer: null
  };

  if (typeof rawBody !== 'string') return data;

  try {
    // פורמט בוט רגיל
    const nameMatch = rawBody.match(/שם מלא:\s*([\s\S]*?)\s*מספר וואטצאפ/);
    if (nameMatch && nameMatch[1]) data.parsedName = nameMatch[1].trim();

    const waPhoneMatch = rawBody.match(/מספר וואטצאפ\s*([\s\S]*?)\s*מספר לחזרה/);
    if (waPhoneMatch && waPhoneMatch[1]) {
       let phone = waPhoneMatch[1].trim().replace(/[^0-9+]/g, '');
       if (phone.startsWith('0')) phone = '972' + phone.substring(1);
       data.parsedPhone = phone;
    }

    let noteMatch = rawBody.match(/הערה:\s*([\s\S]*?)\s*View Conversation/);
    if (!noteMatch) noteMatch = rawBody.match(/הערה:\s*([\s\S]*?)$/);
    if (noteMatch && noteMatch[1]) data.parsedNote = noteMatch[1].trim();

    const linkMatch = rawBody.match(/View Conversation\s*<(.*?)>/);
    if (linkMatch && linkMatch[1]) data.conversationLink = linkMatch[1].trim();

    // זיהוי "הגעתי דרך"
    const referralPattern = /הגעתי\s+דרך\s+(.+)/i;
    const referralMatch = rawBody.match(referralPattern);

    if (referralMatch && referralMatch[1]) {
        let rawReferrer = referralMatch[1].trim().split(/\s+/).slice(0, 2).join(' ');
        rawReferrer = rawReferrer.replace(/[.,;!]$/, ''); 
        data.rawReferrer = rawReferrer;
    }

    return data;

  } catch (error) {
    console.error("Error parsing lead body:", error);
    return data;
  }
}

// --- פונקציות ניהול ---

export const getAllLeads = catchAsync(async (req, res) => {
  const leads = await InboundEmail.find({})
    .sort({ receivedAt: -1 })
    .populate('handledBy', 'name')
    .limit(200);
  res.status(200).json(leads);
});

// עיבוד ידני (אם צריך)
export const processLead = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const lead = await InboundEmail.findById(id);
  if (!lead) return next(new AppError('פנייה לא נמצאה', 404));

  const parsedData = await parseLeadBodyAsync(lead.body);

  // אם מצאנו מפנה בעיבוד חוזר, נעדכן את השדה הנסתר
  if (parsedData.rawReferrer) {
      lead.referrer = await getOfficialReferrerName(parsedData.rawReferrer);
  }

  Object.assign(lead, {
      parsedName: parsedData.parsedName || lead.parsedName,
      parsedPhone: parsedData.parsedPhone || lead.parsedPhone,
      parsedNote: parsedData.parsedNote || lead.parsedNote,
      conversationLink: parsedData.conversationLink || lead.conversationLink,
      status: 'processed',
      handledBy: req.user._id
  });

  const updatedLead = await lead.save();
  res.status(200).json(updatedLead);
});

export const updateLeadStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body; // <-- תיקון: קורא את שני השדות
  const lead = await InboundEmail.findById(id);
  if (!lead) return next(new AppError('פנייה לא נמצאה', 404));

  lead.status = status;
  
  // --- ✨ הוספה ---
  if (status === 'not_relevant') {
      lead.rejectionReason = rejectionReason || 'לא צוינה סיבה';
  }
  if (status === 'new' || status === 'in_progress' || status === 'closed') {
      lead.rejectionReason = null; // איפוס הסיבה אם הליד חוזר לטיפול
  }
  // --- סוף הוספה ---

  if (status === 'closed') lead.handledBy = req.user._id;
  else if (status === 'new') {
    lead.handledBy = null;
    lead.referrer = null; 
  }

  await lead.save();
  res.status(200).json(lead);
});

export const deleteLead = catchAsync(async (req, res, next) => {
  await InboundEmail.findByIdAndDelete(req.params.id);
  res.status(204).send();
});
