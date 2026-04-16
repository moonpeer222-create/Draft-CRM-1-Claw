/**
 * WhatsApp Integration - Pre-filled Message Templates
 * 
 * Provides functions to generate WhatsApp links with pre-filled messages
 * for various CRM scenarios like medical reminders, payment requests, etc.
 */

import { Case } from './mockData';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  nameUrdu: string;
  description: string;
  category: 'medical' | 'payment' | 'document' | 'visa' | 'protector' | 'general';
  getMessageText: (data: Partial<Case> & { customerName?: string; phone?: string; [key: string]: any }) => string;
  getMessageTextUrdu?: (data: Partial<Case> & { customerName?: string; phone?: string; [key: string]: any }) => string;
}

// WhatsApp Templates
export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  // Medical Guide Template
  {
    id: 'medical_guide',
    name: 'Medical Guide',
    nameUrdu: 'میڈیکل گائیڈ',
    description: 'Send medical center instructions and appointment details',
    category: 'medical',
    getMessageText: (data) => `🏥 *MEDICAL APPOINTMENT - EMERALD VISA*

Dear ${data.customerName || 'Customer'},

Your medical appointment has been scheduled:

📍 Center: ${data.medical?.center || 'TBD'}
📅 Date: ${data.medical?.appointmentDate ? new Date(data.medical.appointmentDate).toLocaleDateString() : 'TBD'}
⏰ Time: ${data.medical?.appointmentTime || 'TBD'}

*IMPORTANT INSTRUCTIONS:*
✅ Bring original passport
✅ Bring 2 passport-size photos  
✅ Come on empty stomach (no food for 8 hours)
✅ Bring medical fee in cash
✅ Arrive 15 minutes early

*PROHIBITED ITEMS:*
❌ No smoking 24 hours before
❌ No alcohol 48 hours before
❌ No heavy meals night before

📞 For queries: [Your Office Number]

*Emerald Visa Consultancy*
Your trusted visa partner 🌟`,
    getMessageTextUrdu: (data) => `🏥 *میڈیکل اپائنٹمنٹ - ایمرلڈ ویزا*

محترم ${data.customerName || 'کسٹمر'},

آپ کی میڈیکل اپائنٹمنٹ طے ہو گئی ہے:

📍 سینٹر: ${data.medical?.center || 'جلد'}
📅 تاریخ: ${data.medical?.appointmentDate ? new Date(data.medical.appointmentDate).toLocaleDateString() : 'جلد'}
⏰ وقت: ${data.medical?.appointmentTime || 'جلد'}

*اہم ہدایات:*
✅ اصلی پاسپورٹ ساتھ لائیں
✅ 2 پاسپورٹ سائز تصاویر
✅ خالی پیٹ آئیں (8 گھنٹے کچھ نہ کھائیں)
✅ میڈیکل فیس نقد
✅ 15 منٹ پہلے پہنچیں

*ممنوعات:*
❌ 24 گھنٹے پہلے سگریٹ نہیں
❌ 48 گھنٹے پہلے شراب نہیں
❌ رات کو بھاری کھانا نہیں

📞 رابطہ: [آپکا نمبر]

*ایمرلڈ ویزا کنسلٹنسی*
آپ کا بھروسہ مند ساتھی 🌟`,
  },

  // Payment Reminder Template
  {
    id: 'payment_reminder',
    name: 'Payment Reminder',
    nameUrdu: 'ادائیگی یاد دہانی',
    description: 'Remind customer about pending payment',
    category: 'payment',
    getMessageText: (data) => `💰 *PAYMENT REMINDER - EMERALD VISA*

Dear ${data.customerName || 'Customer'},

Case ID: *${data.id || 'N/A'}*
Country: *${data.country || 'N/A'}*

*PAYMENT DETAILS:*
Total Fee: Rs. ${data.totalFee?.toLocaleString() || '0'}
Paid: Rs. ${data.paidAmount?.toLocaleString() || '0'}
*Remaining: Rs. ${((data.totalFee || 0) - (data.paidAmount || 0)).toLocaleString()}*

⏰ Due by: ${data.stageDeadlineAt ? new Date(data.stageDeadlineAt).toLocaleDateString() : 'ASAP'}

*PAYMENT METHODS:*
🏦 Bank Transfer
💵 Cash at Office
📱 EasyPaisa / JazzCash

Please clear the payment to proceed with your visa process.

📍 Office Address: [Your Address]
📞 Contact: [Your Number]

*Emerald Visa Consultancy*`,
    getMessageTextUrdu: (data) => `💰 *ادائیگی یاد دہانی - ایمرلڈ ویزا*

محترم ${data.customerName || 'کسٹمر'},

کیس نمبر: *${data.id || 'N/A'}*
ملک: *${data.country || 'N/A'}*

*ادائیگی کی تفصیل:*
کل فیس: Rs. ${data.totalFee?.toLocaleString() || '0'}
ادا شدہ: Rs. ${data.paidAmount?.toLocaleString() || '0'}
*باقی: Rs. ${((data.totalFee || 0) - (data.paidAmount || 0)).toLocaleString()}*

⏰ آخری تاریخ: ${data.stageDeadlineAt ? new Date(data.stageDeadlineAt).toLocaleDateString() : 'جلد'}

*ادائیگی کے طریقے:*
🏦 بینک ٹرانسفر
💵 دفتر میں نقد
📱 ایزی پیسہ / جاز کیش

براہ کرم ادائیگی کریں تا کہ آپ کا ویزا پروسس جاری رہے۔

📍 دفتر: [آپ کا پتہ]
📞 رابطہ: [آپ کا نمبر]

*ایمرلڈ ویزا کنسلٹنسی*`,
  },

  // Visa Approval Template
  {
    id: 'visa_approval',
    name: 'Visa Approval Notification',
    nameUrdu: 'ویزا منظوری',
    description: 'Congratulations message for visa approval',
    category: 'visa',
    getMessageText: (data) => `🎉 *CONGRATULATIONS! VISA APPROVED*

Dear ${data.customerName || 'Customer'},

*Great News!* 🌟

Your visa application has been *APPROVED!*

Case ID: *${data.id || 'N/A'}*
Country: *${data.country || ''}*
Job: *${data.jobType || ''}*

*NEXT STEPS:*
1️⃣ Clear remaining payment (if any)
2️⃣ Visit office for final documents
3️⃣ Protector process
4️⃣ Ticket booking

*REQUIRED DOCUMENTS:*
✅ Original Passport
✅ Payment receipts
✅ 2 passport photos

📍 Visit us: [Office Address]
📞 Call us: [Phone Number]
⏰ Office Hours: 9 AM - 6 PM

*Congratulations once again!* 🎊

*Emerald Visa Consultancy*
Your dreams, our mission 🌟`,
    getMessageTextUrdu: (data) => `🎉 *مبارک ہو! ویزا منظور*

محترم ${data.customerName || 'کسٹمر'},

*خوشخبری!* 🌟

آپ کا ویزا *منظور* ہو گیا ہے!

کیس نمبر: *${data.id || 'N/A'}*
ملک: *${data.country || ''}*
کام: *${data.jobType || ''}*

*اگلے قدم:*
1️⃣ باقی رقم جمع کروائیں
2️⃣ آخری دستاویزات کے لیے دفتر آئیں
3️⃣ پروٹیکٹر پروسیس
4️⃣ ٹکٹ بکنگ

*ضروری دستاویزات:*
✅ اصلی پاسپورٹ
✅ ادائیگی کی رسیدیں
✅ 2 پاسپورٹ تصاویر

📍 دفتر: [آپ کا پتہ]
📞 فون: [نمبر]
⏰ اوقات: صبح 9 - شام 6

*ایک بار پھر مبارک ہو!* 🎊

*ایمرلڈ ویزا کنسلٹنسی*
آپ کے خواب، ہمارا مشن 🌟`,
  },

  // Protector Instructions Template
  {
    id: 'protector_instructions',
    name: 'Protector Process',
    nameUrdu: 'پروٹیکٹر پروسیس',
    description: 'Send protector appointment instructions',
    category: 'protector',
    getMessageText: (data) => `📋 *PROTECTOR APPOINTMENT - EMERALD VISA*

Dear ${data.customerName || 'Customer'},

Case ID: *${data.id || 'N/A'}*

Your Protector appointment is scheduled:

📅 Date: Tomorrow
⏰ Time: *8:00 AM SHARP*
📍 Location: [Protector Office Address]

*BRING WITH YOU:*
✅ Original Passport with visa stamp
✅ Rs. 200 for stamp fee (exact amount)
✅ Black pen for signature
✅ Your right thumb ready for impression

*IMPORTANT:*
⚠️ Be on time - Process starts at 8 AM
⚠️ Dress formally
⚠️ No mobile phones allowed inside
⚠️ Keep your documents safe

*PROCESS:*
1. Pay Rs. 200 stamp fee
2. Sign the protector form
3. Give right thumb impression  
4. Collect stamped documents

After completion, immediately bring documents to our office.

📞 Questions? Call: [Your Number]

*Emerald Visa Consultancy*`,
    getMessageTextUrdu: (data) => `📋 *پروٹیکٹر اپائنٹمنٹ - ایمرلڈ ویزا*

محترم ${data.customerName || 'کسٹمر'},

کیس نمبر: *${data.id || 'N/A'}*

آپ کی پروٹیکٹر اپائنٹمنٹ:

📅 تاریخ: کل
⏰ وقت: *صبح 8 بجے (بالکل)*
📍 جگہ: [پروٹیکٹر آفس کا پتہ]

*ساتھ لائیں:*
✅ ویزا والا اصلی پاسپورٹ
✅ Rs. 200 سٹیمپ فیس (عین رقم)
✅ کالا قلم دستخط کے لیے
✅ دائیں ہاتھ کا انگوٹھا

*اہم:*
⚠️ وقت پر پہنچیں - 8 بجے شروع
⚠️ فارمل لباس
⚠️ اندر موبائل منع
⚠️ دستاویزات محفوظ رکھیں

*طریقہ کار:*
1. Rs. 200 سٹیمپ فیس دیں
2. فارم پر دستخط کریں
3. دائیں انگوٹھے کا نشان لگائیں
4. مہر لگے دستاویزات لیں

مکمل ہونے کے بعد فوری ہمارے دفتر آئیں۔

📞 سوال؟ فون: [آپ کا نمبر]

*ایمرلڈ ویزا کنسلٹنسی*`,
  },

  // Document Request Template
  {
    id: 'document_request',
    name: 'Document Request',
    nameUrdu: 'دستاویزات کی درخواست',
    description: 'Request missing documents from customer',
    category: 'document',
    getMessageText: (data) => `📄 *DOCUMENT REQUEST - EMERALD VISA*

Dear ${data.customerName || 'Customer'},

Case ID: *${data.id || 'N/A'}*

We need the following documents to proceed with your visa:

*REQUIRED DOCUMENTS:*
${data.requiredDocs || '📋 Passport copy\n📋 CNIC copy\n📋 Educational certificates\n📋 Experience letter\n📋 Photos (2 passport size)'}

⏰ *Deadline: ${data.stageDeadlineAt ? new Date(data.stageDeadlineAt).toLocaleDateString() : '48 hours'}*

*SUBMISSION OPTIONS:*
1️⃣ Visit office and submit originals
2️⃣ Send scanned copies via WhatsApp
3️⃣ Email to: [your@email.com]

📍 Office: [Address]
📞 Call: [Phone]
⏰ Hours: 9 AM - 6 PM

Please submit ASAP to avoid delays.

*Emerald Visa Consultancy*`,
    getMessageTextUrdu: (data) => `📄 *دستاویزات کی درخواست - ایمرلڈ ویزا*

محترم ${data.customerName || 'کسٹمر'},

کیس نمبر: *${data.id || 'N/A'}*

آپ کے ویزا کے لیے یہ دستاویزات چاہیے:

*ضروری دستاویزات:*
${data.requiredDocs || '📋 پاسپورٹ کاپی\n📋 شناختی کارڈ کاپی\n📋 تعلیمی سرٹیفکیٹ\n📋 تجربے کا خط\n📋 تصاویر (2 پاسپورٹ سائز)'}

⏰ *آخری تاریخ: ${data.stageDeadlineAt ? new Date(data.stageDeadlineAt).toLocaleDateString() : '48 گھنٹے'}*

*جمع کروانے کے طریقے:*
1️⃣ دفتر آ کر اصل دیں
2️⃣ واٹس ایپ پر سکین بھیجیں
3️⃣ ای میل: [your@email.com]

📍 دفتر: [پتہ]
📞 فون: [نمبر]
⏰ اوقات: 9 صبح - 6 شام

جلد جمع کروائیں تاخیر سے بچیں۔

*ایمرلڈ ویزا کنسلٹنسی*`,
  },

  // Ticket Booking Confirmation
  {
    id: 'ticket_confirmation',
    name: 'Ticket Booking Confirmation',
    nameUrdu: 'ٹکٹ بکنگ تصدیق',
    description: 'Send flight ticket details',
    category: 'visa',
    getMessageText: (data) => `✈️ *TICKET BOOKED - EMERALD VISA*

Dear ${data.customerName || 'Customer'},

*Congratulations!* Your flight ticket is booked! 🎉

Case ID: *${data.id || 'N/A'}*

*FLIGHT DETAILS:*
📅 Date: ${data.flightDate || 'TBD'}
⏰ Time: ${data.flightTime || 'TBD'}
✈️ Flight: ${data.flightNumber || 'TBD'}
🛫 From: ${data.departureCity || 'Pakistan'}
🛬 To: ${data.country || ''}

*BEFORE DEPARTURE:*
✅ Collect passport from office
✅ Get airport guide & instructions
✅ Complete video statement
✅ Final briefing session

*COLLECT DOCUMENTS:*
📍 Office: [Your Address]
📞 Call: [Your Number]
⏰ Visit before: [Date]

*Tips for Journey:*
💼 Pack light
📱 Keep our number saved
🎫 Keep documents safe
💰 Carry some currency

Best wishes for your new journey! 🌟

*Emerald Visa Consultancy*
We're with you every step 💚`,
    getMessageTextUrdu: (data) => `✈️ *ٹکٹ بک - ایمرلڈ ویزا*

محترم ${data.customerName || 'کسٹمر'},

*مبارک ہو!* آپ کی فلائٹ ٹکٹ بک ہو گئی! 🎉

کیس نمبر: *${data.id || 'N/A'}*

*فلائٹ تفصیل:*
📅 تاریخ: ${data.flightDate || 'جلد'}
⏰ وقت: ${data.flightTime || 'جلد'}
✈️ فلائٹ: ${data.flightNumber || 'جلد'}
🛫 سے: ${data.departureCity || 'پاکستان'}
🛬 تک: ${data.country || ''}

*جانے سے پہلے:*
✅ دفتر سے پاسپورٹ لیں
✅ ایئرپورٹ گائیڈ لیں
✅ ویڈیو بیان مکمل کریں
✅ آخری بریفنگ لیں

*دستاویزات لیں:*
📍 دفتر: [آپ کا پتہ]
📞 فون: [نمبر]
⏰ سے پہلے آئیں: [تاریخ]

*سفر کے لیے نکات:*
💼 ہلکا سامان
📱 ہمارا نمبر محفوظ رکھیں
🎫 دستاویزات سنبھال کر
💰 کچھ کرنسی ساتھ رکھیں

نئے سفر کے لیے دعائیں! 🌟

*ایمرلڈ ویزا کنسلٹنسی*
ہم ہر قدم پر ساتھ ہیں 💚`,
  },
];

/**
 * Generate WhatsApp URL with pre-filled message
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  // Remove all non-numeric characters except +
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  
  // Encode the message for URL
  const encodedMessage = encodeURIComponent(message);
  
  // Generate WhatsApp Web URL
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): WhatsAppTemplate | undefined {
  return WHATSAPP_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: WhatsAppTemplate['category']): WhatsAppTemplate[] {
  return WHATSAPP_TEMPLATES.filter(t => t.category === category);
}

/**
 * Send WhatsApp message (opens WhatsApp with pre-filled message)
 */
export function sendWhatsAppMessage(
  templateId: string,
  data: Partial<Case> & { customerName?: string; phone?: string; [key: string]: any },
  useUrdu = false
): void {
  const template = getTemplate(templateId);
  if (!template) {
    console.error(`Template ${templateId} not found`);
    return;
  }

  const phone = data.phone || '';
  if (!phone) {
    console.error('Phone number is required');
    return;
  }

  const messageText = useUrdu && template.getMessageTextUrdu
    ? template.getMessageTextUrdu(data)
    : template.getMessageText(data);

  const whatsappUrl = generateWhatsAppLink(phone, messageText);
  
  // Open WhatsApp in new window
  window.open(whatsappUrl, '_blank');
}

/**
 * Get message preview without opening WhatsApp
 */
export function getMessagePreview(
  templateId: string,
  data: Partial<Case> & { customerName?: string; phone?: string; [key: string]: any },
  useUrdu = false
): string | null {
  const template = getTemplate(templateId);
  if (!template) return null;

  return useUrdu && template.getMessageTextUrdu
    ? template.getMessageTextUrdu(data)
    : template.getMessageText(data);
}
