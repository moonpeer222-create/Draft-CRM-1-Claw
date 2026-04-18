import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send, Bot, Shield, Briefcase, Crown, Mic, MicOff, Volume2 } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import {
  processMessage, createContext,
  getGreetingResponse, getThankYouResponse, getFollowUpIntro,
  getSmartFallback,
  type ConversationContext, type UserRole,
} from "./SmartNLP";
import { callGeminiAI, streamQwenAI, type ChatMessage } from "../../lib/geminiApi";
import { buildCRMContext, CRM_ACTION_INSTRUCTIONS, parseActions, executeAllActions } from "../../lib/crmTools";

interface Message {
  id: number;
  text: string;
  isBot: boolean;
  avatar?: string;
}

interface RoleBasedChatbotProps {
  role: UserRole;
}

// Comprehensive Urdu + English knowledge base by role — trained on visa-consultancy-process.md
const ROLE_KNOWLEDGE = {
  admin: {
    greetings: {
      en: "Assalam o Alaikum! I'm your Admin AI Assistant. Ask me anything about cases, team, payments, or approvals. How can I help? 🎯",
      ur: "السلام علیکم! میں آپ کا ایڈمن AI ہوں۔ کیسز، ٹیم، پیسے، یا منظوری — جو بھی پوچھنا ہو پوچھیں۔ بتائیں کیا کروں؟ 🎯"
    },
    quickActions: [
      { label: "All Cases", labelUrdu: "تمام کیسز", icon: "📋", prompt: "تمام کیسز کی رپورٹ بنا دو" },
      { label: "CRM Stats", labelUrdu: "CRM اعداد و شمار", icon: "📊", prompt: "CRM کے مکمل اعداد و شمار دکھاؤ" },
      { label: "Agent Performance", labelUrdu: "ایجنٹ کارکردگی", icon: "🏆", prompt: "کون سا ایجنٹ بہتر کارکردگی دکھا رہا ہے؟" },
      { label: "Overdue Cases", labelUrdu: "تاخیر والے کیسز", icon: "⚠️", prompt: "تاخیر والے کیسز دکھاؤ" },
      { label: "Visa Process", labelUrdu: "ویزا پراسیس", icon: "🔄" },
    ],
    responses: {
      team: {
        en: "Current team: 4 agents (Faizan, Imran, Safeer, Aynee). All active. Faizan leads with 12 cases this month. Need to assign new cases? 👥",
        ur: "موجودہ ٹیم: 4 ایجنٹس (فیضان، عمران، صفیر، عائنی)۔ سب فعال۔ فیضان اس ماہ 12 کیسز کے ساتھ آگے ہیں۔ نئے کیسز تفویض کریں؟ 👥"
      },
      stats: {
        en: "System Overview: 45 active cases, 12 pending approvals, 8 overdue payments. Revenue this month: PKR 2.4M. Overall health: 92% ✅",
        ur: "سسٹم کا جائزہ: 45 فعال کیسز، 12 زیر التواء منظوریاں، 8 واجب الادا ادائیگیاں۔ اس ماہ آمدنی: 24 لاکھ روپے۔ مجموعی صحت: 92% ✅"
      },
      performance: {
        en: "Agent Performance:\n🥇 Faizan: 12 cases, 95% success\n🥈 Imran: 10 cases, 90% success\n🥉 Safeer: 8 cases, 88% success\n• Aynee: 6 cases, 85% success\n\nRecommendation: Assign high-priority cases to Faizan.",
        ur: "ایجنٹ کارکردگی:\n🥇 فیضان: 12 کیسز، 95% کامیابی\n🥈 عمران: 10 کیسز، 90% کامیابی\n🥉 صفیر: 8 کیسز، 88% کامیابی\n• عائنی: 6 کیسز، 85% کامیابی\n\nسفارش: اہم کیسز فیضان کو تفویض کریں۔"
      },
      approval: {
        en: "You have 12 pending approvals:\n• 5 Payment confirmations\n• 4 Document verifications\n• 3 Case stage advances\n\nPriority: 2 cases overdue > 48hrs. Review now? ⚠️",
        ur: "آپ کے پاس 12 زیر التواء منظوریاں ہیں:\n• 5 ادائیگی کی تصدیقات\n• 4 دستاویزات کی تصدیق\n• 3 کیس مرحلہ پیش رفت\n\nترجیح: 2 کیسز 48 گھنٹے سے تاخیر۔ ابھی جائزہ لیں؟ ⚠️"
      },
      agents: {
        en: "Agent Management:\n• Create new agent codes: Settings → Agent Codes\n• Monitor agent activity: Team → Attendance\n• Set performance targets: Settings → KPIs\n• View leaderboard: Reports → Leaderboard 📈",
        ur: "ایجنٹ کا انتظام:\n• نئے ایجنٹ کوڈز بنائیں: ترتیبات → ایجنٹ کوڈز\n• ایجنٹ سرگرمی کی نگرانی: ٹیم → حاضری\n• کارکردگی کے اہداف مقرر کریں: ترتیبات → KPIs\n• لیڈر بورڈ دیکھیں: رپورٹس → لیڈر بورڈ 📈"
      },
      backup: {
        en: "Data Backup & Security:\n✅ Last backup: 2 hours ago\n✅ Auto-backup: Every 6 hours\n✅ Sync status: Online\n\nManual backup available at: System → Data Backup 💾",
        ur: "ڈیٹا بیک اپ اور سیکیورٹی:\n✅ آخری بیک اپ: 2 گھنٹے پہلے\n✅ خودکار بیک اپ: ہر 6 گھنٹے\n✅ سنک حیثیت: آن لائن\n\nدستی بیک اپ یہاں دستیاب ہے: سسٹم → ڈیٹا بیک اپ 💾"
      },
      financials: {
        en: "Financial Summary (This Month):\n💰 Revenue: PKR 2,400,000\n💸 Pending: PKR 450,000\n📊 Commission paid: PKR 180,000\n📈 Growth: +15% vs last month\n\nDetailed report: Financials → Analytics 💼",
        ur: "مالیاتی خلاصہ (اس ماہ):\n💰 آمدنی: 24 لاکھ روپے\n💸 باقی: 4.5 لاکھ روپے\n📊 کمیشن ادا: 1.8 لاکھ روپے\n📈 ترقی: گزشتہ ماہ سے +15%\n\nتفصیلی رپورٹ: مالیات → تجزیات 💼"
      },
      visaProcess: {
        en: "📋 Complete 12-Stage Visa Process:\n\n1️⃣ Lead Generation - Chatbot filters serious clients\n2️⃣ Office Visit - Professional first impression\n3️⃣ Document Collection - Scan all docs\n4️⃣ Medical/GAMCA - Token: 4,500 PKR\n5️⃣ E-Number & Vendor - PDF file to vendor\n6️⃣ Payment (2 Lakh) - Cash/Online + receipt\n7️⃣ Case Registration - CRM + manual register\n8️⃣ Vendor Payment - Owner confirms all\n9️⃣ Visa Approval - Mubarakbad + remaining payment\n🔟 Protector Process - 8 AM appointment\n1️⃣1️⃣ Ticket Booking - Video statement\n1️⃣2️⃣ Departure - Alhamdulillah! ✈️\n\nAsk about any stage for details.",
        ur: "📋 مکمل 12 مراحل ویزا پراسیس:\n\n1️⃣ لیڈ جنریشن - چیٹ بوٹ غیر سنجیدہ کلائنٹس فلٹر کرتی ہے\n2️⃣ آفس وزٹ - پیشہ ورانہ پہلا تاثر\n3️⃣ دستاویزات جمع - تمام کاغذات سکین\n4️⃣ میڈیکل/گامکا - ٹوکن: 4,500 روپے\n5️⃣ ای نمبر اور وینڈر - PDF فائل وینڈر کو\n6️⃣ ادائیگی (2 لاکھ) - کیش/آن لائن + رسید\n7️⃣ کیس رجسٹریشن - CRM + مینول رجسٹر\n8️⃣ وینڈر ادائیگی - مالک کی تصدیق لازمی\n9️⃣ ویزا منظوری - مبارکباد + باقی رقم وصولی\n🔟 پروٹیکٹر پراسیس - صبح 8 بجے اپائنٹمنٹ\n1️⃣1️⃣ ٹکٹ بکنگ - ویڈیو اسٹیٹمنٹ\n1️⃣2️⃣ روانگی - الحمداللہ! ✈️\n\nکسی بھی مرحلے کی تفصیل پوچھیں۔"
      },
      leadGeneration: {
        en: "📱 Stage 1 - Lead Generation & Qualification:\n\n• Client contacts via Facebook post\n• Chatbot collects basic info + filters non-serious clients\n• Sales Rep target: 5 mature clients/day\n• Mature clients scheduled for office visit\n• Follow-up via WhatsApp as clients mature\n\n⚡ Key: Chatbot saves time by auto-filtering!",
        ur: "📱 مرحلہ 1 - لیڈ جنریشن اور کوالیفکیشن:\n\nکلائنٹ فیس بک پوسٹ پڑھ کر سٹاف ویزا سیل ریپریزنٹیٹو سے رابطہ کرتا ہے۔ چیٹ بوٹ خود ہی غیر سنجیدہ کلائنٹس فلٹر کر دیتی ہے اور مکمل بنیادی معلومات لے لیتی ہے۔\n\n• سیلز ریپریزنٹیٹو کا ٹارگٹ روزانہ 5 کلائنٹ میچور ہونے چاہیے\n• جیسے جیسے کلائنٹس میچور ہوتے جائیں آفس بلائیں\n• ڈیل کلوز کرتے جائیں\n\n⚡ اہم: چیٹ بوٹ وقت بچاتی ہے خودکار فلٹرنگ سے!"
      },
      officeVisit: {
        en: "🏢 Stage 2 - Office Visit & First Impression:\n\n• Client observes: Cleanliness, staff discipline, other clients\n• Expert/Main person handles consultation\n• Must answer ALL client questions confidently\n• Professional paperwork & bio-data forms\n• Retainer Agreement signed (client-friendly terms)\n\n💡 Client checks: \"Are there other clients too?\" (trust building)",
        ur: "🏢 مرحلہ 2 - آفس وزٹ اور پہلا تاثر:\n\nجب کلائنٹ آفس آتا ہے تو سب سے پہلے صفائی دیکھتا ہے، سٹاف کی آبزرویشن کرتا ہے، اپنے علاوہ کوئی اور کلائنٹس دیکھتا ہے کہ میرے علاوہ بھی کوئی ہے یا نہیں۔\n\n• آفس میں ڈسیپلن ہونا چاہیے\n• ایسا مین بندہ چاہیے جو ایکسپرٹ ہو\n• ہر سوال کا مؤثر جواب دے، کلائنٹ کو لاجواب کر دے\n• پیپر ورک بائیو ڈیٹا فارم پروفیشنل انداز سے ہو\n• اقرار نامہ سائن کروایا جائے\n\n💡 کلائنٹ کو لاجواب کر دیں تو ڈیل ہو جائے گی!"
      },
      documentCollection: {
        en: "📄 Stage 3 - Document Collection & Scanning:\n\nAll documents must be scanned:\n• CNIC (front & back)\n• Passport (all pages)\n• Passport-size + Full body photos\n• Driver's License (if Driver/Operator)\n\n⚠️ Data must be properly saved with client name + date\n📌 Everything professional - other clients watching should feel confident!",
        ur: "📄 مرحلہ 3 - دستاویزات جمع اور سکیننگ:\n\nتمام ڈاکومنٹس اسکین کیے جائیں اور جو ہمیں ریکوائرڈ ہیں وہ سیو کیے جائیں:\n\n• شناختی کارڈ (آگے اور پیچھے)\n• پاسپورٹ (تمام صفحات)\n• پاسپورٹ سائز + فل باڈی پکچر\n• ڈرائیور/آپریٹرز ہے تو لائسنس بھی سکین کریں\n\n⚠️ پراپرٹی طور پر ڈیٹا سیو ہونا چاہیے\n📌 یہ ساری کارروائی پیشہ ورانہ مہارت سے ہو کہ دوسرا کلائنٹ دیکھ کر مطمئن ہو جائے!"
      },
      medicalProcess: {
        en: "🏥 Stage 4 - Medical Token & GAMCA Process:\n\n• Token Fee: PKR 4,500 (client pays us, we book online)\n• Medical Center Fee: PKR 25,000-35,000 (varies, client pays directly)\n• Client needs: Passport copy + photos\n• Guide client: Lab address, route via WhatsApp\n• Result: Within 36 hours\n\n❌ If Unfit → Case cancel + passport return\n✅ If Fit → Start visa processing ASAP\n\n📌 After medical: Client submits passport + medical center receipt to office\n📌 Receipt goes in file, Passport to stock (Imran's house)",
        ur: "🏥 مرحلہ 4 - میڈیکل ٹوکن اور گامکا پراسیس:\n\nگیمکا میڈیکل ٹوکن کی قیمت 4,500 روپے ہے جو کلائنٹ ہمیں پیڈ کرتا ہے اور ہم آن لائن بک کرواتے ہیں۔\n\n• میڈیکل سینٹر کی فیس: 25,000 سے 35,000 روپے (مختلف ٹائم پہ مختلف)\n• کلائنٹ کو واٹس ایپ پر گائیڈ کریں: لیب کا ایڈریس، راستہ\n• ساتھ لے جائے: پاسپورٹ کی کاپی اور تصاویر\n• 36 گھنٹوں کے اندر میڈیکل رزلٹ آ جاتا ہے\n\n❌ اگر میڈیکل انفٹ → کیس کینسل + پاسپورٹ واپسی\n✅ اگر میڈیکل فٹ → ویزا پراسیسنگ فوراً شروع\n\n📌 میڈیکل کے بعد: پاسپورٹ + رسید آفس جمع → رسید فائل میں، پاسپورٹ سٹاک (عمران کے گھر) بھجوائیں"
      },
      eNumber: {
        en: "📤 Stage 5 - E-Number & Vendor Submission:\n\n1. Computer Operator prepares PDF file (36hrs before biometric)\n2. PDF sent to Owner → Owner sends to Vendor\n3. E-Number received via WhatsApp → shared with Computer Operator\n4. Client called: \"Come tomorrow with 2 Lakh PKR\"\n5. Original passport retrieved from stock (Imran's house)\n\n⚠️ E-Number must be issued BEFORE client arrives\n⚠️ Expert person calls client for next-day payment collection",
        ur: "📤 مرحلہ 5 - ای نمبر اور وینڈر سبمشن:\n\nکمپیوٹر آپریٹر کلائنٹ کی مکمل PDF فائل 36 گھنٹے پہلے تیار کر چکا ہے اور مالک کو سینڈ کرتا ہے۔\n\n1. مالک وہ فائل وینڈر کو بھیجتا ہے\n2. ای نمبر واٹس ایپ پر وصول کر کے کمپیوٹر آپریٹر کو سینڈ کرتا ہے\n3. کمپیوٹر آپریٹر کلائنٹ کے کاغذات فولڈر میں محفوظ کرتا ہے\n4. اوریجنل پاسپورٹ سٹاک (عمران کے گھر) سے منگوایا جاتا ہے\n5. کلائنٹ کو ایکسپرٹ بندے کی کال: \"کل 2 لاکھ لے کر آئیں\"\n\n⚠️ کلائنٹ کے آنے سے پہلے ای نمبر جاری ہو چکا ہو\n⚠️ پاسپورٹ سٹاک سے آیا ہوا ہو"
      },
      paymentCollection: {
        en: "💰 Stage 6 - Payment Collection (2 Lakh PKR):\n\nPayment Options:\n• Cash → Issue payment receipt + register entry\n• Online Transfer → Take screenshot → Owner confirmation → then entry\n\nOriginal Documents Collected:\n📌 Old + New Original Passport\n📌 Original CNIC\n📌 Original Photos\n📌 Original FRC & PCC\n📌 2 Original Biometric Slips\n📌 Original Medical Report\n📌 License (if Driver/Operator)\n\n⚠️ CRITICAL: Even ONE missing original document = Embassy won't grant visa!",
        ur: "💰 مرحلہ 6 - رقم وصولی (2 لاکھ روپے):\n\nادائیگی کے طریقے:\n• کیش → رقم ادائیگی کی رسید دیں + رجسٹر میں اندراج\n• آن لائن → سکرین شاٹ لیں → مالک سے کنفرمیشن → پھر اندراج\n\nاصل دستاویزات وصول کیے جائیں:\n📌 پرانا اور نیا اصل پاسپورٹ\n📌 اصل شناختی کارڈ\n📌 اصل تصاویر\n📌 اصل FRC اور PCC\n📌 بائیومیٹرک کی دو اصل سلپس\n📌 اصل میڈیکل رپورٹ\n📌 لائسنس (اگر ڈرائیور/آپریٹرز ہو)\n\n⚠️ انتہائی اہم: ایک کاغذ بھی اوریجنل مس ہو تو ایمبیسی ویزا گرانٹ نہیں کرتی!"
      },
      caseRegistration: {
        en: "📝 Stage 7 - Case Registration & Vendor Handover:\n\n• Entry in BOTH computer CRM + manual register\n• TCS slip attached to file (if sending docs)\n• Note which vendor the case goes to\n• File handed over to Owner\n\n⚡ Dual entry system ensures no data loss!",
        ur: "📝 مرحلہ 7 - کیس رجسٹریشن اور وینڈر حوالگی:\n\nفائل مالک کے حوالے کرنے سے پہلے:\n• کمپیوٹر CRM میں اندراج\n• مینول رجسٹر میں اندراج\n• اگر ٹی سی ایس کرنی تو ٹی سی ایس سلپ فائل میں لگائیں\n• نوٹ کریں کہ کیس کس وینڈر کے پاس جا رہا ہے\n• فائل مالک کے حوالے کریں\n\n⚡ ڈبل انٹری سسٹم ڈیٹا کی حفاظت یقینی بناتا ہے!"
      },
      vendorPayment: {
        en: "💸 Stage 8 - Vendor Payment & Visa Processing:\n\n• Owner handles all vendor payments (online)\n• Payment record given to Computer Operator\n• Computer Operator confirms EVERY entry with Owner\n• Daily vendor payment log maintained\n• Vendor processes visa → sends WhatsApp copy → Owner → Computer Operator\n\n🔑 Rule: No payment entry without Owner confirmation!",
        ur: "💸 مرحلہ 8 - وینڈر ادائیگی اور ویزا پراسیسنگ:\n\nوینڈر کو جتنی آن لائن ادائیگی کرنی ہو مالک خود کرتا ہے۔\n\n• ادائیگی کا مکمل ریکارڈ کمپیوٹر آپریٹر کو دیتا ہے\n• کمپیوٹر آپریٹر مالک سے کنفرم کرے: رقم کا لین دین کیا ہے، کس کے ساتھ، کس مد میں\n• ہر کلائنٹ کی ادائیگی کا الگ ریکارڈ رکھے\n• روزانہ کی بنیاد پر وینڈرز کو کی گئی ادائیگی درج کرے\n• وینڈر ویزا لگوا کر واٹس ایپ پر کاپی بھیجتا ہے\n\n🔑 اصول: مالک کی تصدیق کے بغیر کوئی ادائیگی اندراج نہیں!"
      },
      visaApproval: {
        en: "🎉 Stage 9 - Visa Approval & Remaining Payment:\n\n1. Staff congratulates client (WhatsApp/call)\n2. Next day: Client called for remaining payment\n3. Payment → Owner confirmation (transferred to accounts?)\n4. Cash → Issue receipt + inform Owner\n5. Remind Owner: \"Deal was at X rate, Y amount paid\"\n\n📌 Then collect for Protector: Nominee details + any account number",
        ur: "🎉 مرحلہ 9 - ویزا منظوری اور باقی رقم وصولی:\n\nوینڈر ویزا لگوا کر واٹس ایپ پر کاپی بھیجتا ہے۔\n\n1. سٹاف کی طرف سے کلائنٹ کو ویزا کی مبارکباد\n2. اگلے ہی دن باقی رقم وصولی کے لیے بلائیں\n3. رقم وصول → مالک سے کنفرمیشن: اکاؤنٹس میں ٹرانسفر ہوئی؟\n4. کیش دے تو ادائیگی رسید دیں + مالک کو انفارم کریں\n5. مالک کو یاد کروائیں: اس کلائنٹ سے اتنے ریٹ پر ڈیل تھی، یہ رقم ادا ہو گئی\n\n📌 پھر پروٹیکٹر کے لیے: نومینی + اکاؤنٹ نمبر منگوائیں"
      },
      protectorProcess: {
        en: "🛡️ Stage 10 - Protector Process:\n\n1. Collect from client: Nominee details + Account number → save + send to Owner\n2. Owner gets Protector Paper from Vendor\n3. Client sent to Protector Office at 8 AM sharp\n4. Client gets stamp on paper → submits original + 200 PKR guarantee stamp to office\n5. Client signs + thumbprint on OC Protector paper\n6. Paper scanned → sent to Owner → Owner sends to Vendor\n7. Vendor completes Protector online\n\n⏰ Protector appointment: 8 AM - No delays!",
        ur: "🛡️ مرحلہ 10 - پروٹیکٹر پراسیس:\n\nکلائنٹ سے نومینی + کوئی سا بھی اکاؤنٹ نمبر منگوائیں، سیو کریں اور مالک کو سینڈ کریں۔\n\n1. مالک وینڈر سے پروٹیکٹر پیپر نکلوا کر دیتا ہے\n2. سٹاف کلائنٹ کو صبح 8 بجے پروٹیکٹر آفس بھجوائے\n3. کلائنٹ سٹمپ لگوا کر اوریجنل پیپر آفس جمع کروائے\n4. آفس میں کلائنٹ سے 200 والا گارنٹی اسٹامپ بھی لیں\n5. OC پروٹیکٹر پیپر پر کلائنٹ کا سائن + انگوٹھا لگوائیں\n6. پیپر سکین کر کے مالک کو دیں\n7. مالک وینڈر کو سینڈ کرے → وینڈر پروٹیکٹر آن لائن کر دے\n\n⏰ پروٹیکٹر اپائنٹمنٹ: صبح 8 بجے - تاخیر نہیں!"
      },
      ticketBooking: {
        en: "🎫 Stage 11 - Ticket Booking & Final Handover:\n\nIf full payment complete:\n1. Ticket date finalized\n2. Final payment to vendor completed\n3. Complete file retrieved from vendor\n4. Client video statement recorded\n5. File handed over to client\n\n📹 Video statement is MANDATORY before departure!",
        ur: "🎫 مرحلہ 11 - ٹکٹ بکنگ اور فائنل حوالگی:\n\nاگر مکمل پیمنٹ ہو چکی ہو:\n1. ٹکٹ کی تاریخ فائنل کروائیں\n2. وینڈر کو فائنل ادائیگی مکمل کریں\n3. مکمل فائل وینڈر سے منگوائیں\n4. کلائنٹ کی ویڈیو اسٹیٹمنٹ لیں\n5. فائل ہینڈ اوور کریں\n\n📹 روانگی سے پہلے ویڈیو اسٹیٹمنٹ لازمی ہے!"
      },
      departure: {
        en: "✈️ Stage 12 - Departure:\n\nClient flies! Alhamdulillah! 🎉\n\nCase marked as COMPLETED in CRM.\nAll records archived for audit trail.\n\nMay Allah grant success to every client! 🤲",
        ur: "✈️ مرحلہ 12 - روانگی:\n\nکلائنٹ فلائی کرتا ہے! الحمداللہ! 🎉\n\nکیس CRM میں مکمل نشان زد۔\nتمام ریکارڈز آڈٹ ٹریل کے لیے محفوظ۔\n\nاللہ ہر کلائنٹ کو کامیابی عطا فرمائے! 🤲"
      },
      businessRules: {
        en: "🔑 Key Business Rules:\n\n1. No document missing → Embassy won't grant visa\n2. Owner confirmation required for EVERY payment entry\n3. Dual entry: Computer CRM + Manual Register\n4. Passport stock location: Imran's house (tracked)\n5. Medical result deadline: 36 hours\n6. Protector appointment: 8 AM sharp\n7. Video statement mandatory before departure\n8. Every action logged for audit trail\n9. Sales Rep target: 5 mature clients/day\n10. Professional conduct at all times - clients are watching!",
        ur: "🔑 اہم کاروباری اصول:\n\n1. ایک بھی دستاویز غائب → ایمبیسی ویزا نہیں دے گی\n2. ہر ادائیگی اندراج کے لیے مالک کی تصدیق لازمی\n3. ڈبل انٹری: کمپیوٹر CRM + مینول رجسٹر\n4. پاسپورٹ سٹاک: عمران کے گھر (ٹریک شدہ)\n5. میڈیکل نتیجہ: 36 گھنٹے کے اندر\n6. پروٹیکٹر اپائنٹمنٹ: صبح 8 بجے\n7. روانگی سے پہلے ویڈیو اسٹیٹمنٹ لازمی\n8. ہر عمل آڈٹ ٹریل کے لیے درج\n9. سیلز ریپ ٹارگٹ: روزانہ 5 میچور کلائنٹس\n10. ہر وقت پیشہ ورانہ رویہ - کلائنٹ دیکھ رہے ہیں!"
      },
      roleResponsibilities: {
        en: "👥 Role Responsibilities:\n\n📱 Sales Rep:\n• Lead qualification, WhatsApp follow-up\n• Office visit scheduling\n• Target: 5 mature clients/day\n\n💻 Computer Operator:\n• Document scanning, PDF preparation\n• CRM + manual register entry\n• Payment logging (Owner confirmation required)\n\n👔 Owner:\n• Payment confirmations\n• Vendor communication\n• E-Number/Visa/Protector handling\n• Final approvals\n\n🤝 Expert/Main Person:\n• Client consultation\n• Answering questions professionally\n• Closing deals",
        ur: "👥 رول ذمہ داریاں:\n\n📱 سیلز ریپریزنٹیٹو:\n• لیڈ کوالیفکیشن، واٹس ایپ فالو اپ\n• آفس وزٹ شیڈولنگ\n• ٹارگٹ: روزانہ 5 میچور کلائنٹس\n\n💻 کمپیوٹر آپریٹر:\n• دستاویزات سکیننگ، PDF تیاری\n• CRM + مینول رجسٹر میں اندراج\n• ادائیگی لاگنگ (مالک کی تصدیق لازمی)\n\n👔 مالک (سر عاطف/وسی):\n• ادائیگی کی تصدیقات\n• وینڈر سے بات چیت\n• ای نمبر/ویزا/پروٹیکٹر ہینڈلنگ\n• فائنل منظوریاں\n\n🤝 ایکسپرٹ/مین شخص:\n• کلائنٹ مشاورت\n• سوالات کا پیشہ ورانہ جواب\n• ڈیل کلوز کرنا"
      },
      passportStock: {
        en: "📦 Passport Stock Management:\n\n• Location: Imran's house (secure storage)\n• Passports received after medical → sent to stock\n• Retrieved when E-Number issued (before client visit)\n• Computer Operator requests from stock as needed\n• All movements tracked in system\n\n⚠️ Never leave passports untracked!",
        ur: "📦 پاسپورٹ سٹاک کا انتظام:\n\n• مقام: عمران کے گھر (محفوظ ذخیرہ)\n• میڈیکل کے بعد پاسپورٹ → سٹاک میں بھجوائیں\n• ای نمبر جاری ہونے پر منگوائیں (کلائنٹ آنے سے پہلے)\n• کمپیوٹر آپریٹر ضرورت کے مطابق سٹاک سے طلب کرے\n• تمام نقل و حرکت سسٹم میں ٹریک\n\n⚠️ پاسپورٹ کبھی بے نشان نہ چھوڑیں!"
      },
      login: {
        en: "🔐 Login & Access Guide:\n\n**Agent Login:**\n1. Open CRM login page\n2. Enter your 6-digit access code (received via WhatsApp from Admin)\n3. Click \"Activate Session\"\n4. Session valid for 6 hours → Work until auto-logout\n\n**Admin Login:**\n1. Go to: /admin/login\n2. Enter Admin Email + Password\n3. Click \"Login\"\n\n💡 Code not received? Click \"Request via WhatsApp\" or call Admin: 03186986259\n⏰ Sessions expire after 6 hours for security",
        ur: "🔐 لاگ ان اور رسائی گائیڈ:\n\n**ایجنٹ لاگ ان:**\n1. CRM لاگ ان پیج کھولیں\n2. اپنا 6 ہندسوں کا ایکسیس کوڈ درج کریں (ایڈمن سے واٹس ایپ پر موصول ہوا)\n3. \"ایکٹیویٹ سیشن\" پر کلک کریں\n4. سیشن 6 گھنٹے کے لیے فعال رہے گا\n\n**ایڈمن لاگ ان:**\n1. جائیں: /admin/login\n2. ایڈمن ای میل + پاس ورڈ درج کریں\n3. \"لاگ ان\" پر کلک کریں\n\n💡 کوڈ نہیں ملا؟ \"واٹس ایپ کے ذریعے کوڈ مانگیں\" یا ایڈمن کو کال کریں: 03186986259"
      },
      dashboard: {
        en: "📊 Dashboard & Today's Tasks:\n\n• Agent Dashboard → \"Today's Tasks\" widget (top section)\n• Shows: Follow-ups | Document uploads | Payment reminders | Appointments\n• Click any task → Opens related case directly\n• Priority order: 🔴 Overdue → 🟡 Due Today → 🔵 Upcoming\n\n💡 Navigate: Dashboard → Tasks widget for quick access to daily work items.",
        ur: "📊 ڈیش بورڈ اور آج کے کام:\n\n• ایجنٹ ڈیش بورڈ → \"آج کے کام\" ویجٹ (اوپر والے حصے میں)\n• دکھاتا ہے: فالو اپس | دستاویز اپ لوڈز | ادائیگی کی یاد دہانیاں | اپائنٹمنٹس\n• کسی بھی کام پر کلک کریں → متعلقہ کیس کھل جائے گا\n• ترجیحی ترتیب: 🔴 اوورڈیو → 🟡 آج واجب → 🔵 آنے والے"
      },
      searchClient: {
        en: "🔍 How to Find a Client:\n\n**Method 1: Search Bar (Fastest)**\n• Top navigation → Search icon 🔍\n• Type: Name / Phone / Case ID / Passport #\n• Results appear instantly → Click to open case\n\n**Method 2: Cases List + Filter**\n• Navigate: Cases → All Cases\n• Apply filters: Status | Country | Agent | Date Range\n\n💡 Tip: Use Case ID (EMR-2024-XXX) for fastest results!",
        ur: "🔍 کلائنٹ کیسے ڈھونڈیں:\n\n**طریقہ 1: سرچ بار (سب سے تیز)**\n• ٹاپ نیویگیشن → سرچ آئیکن 🔍\n• ٹائپ کریں: نام / فون / کیس آئی ڈی / پاسپورٹ نمبر\n• نتائج فوراً ظاہر ہوں گے\n\n**طریقہ 2: کیسز لسٹ + فلٹر**\n• نیویگیٹ: Cases → All Cases\n• فلٹرز: سٹیٹس | ملک | ایجنٹ | تاریخ\n\n💡 تیز ترین نتائج کے لیے کیس آئی ڈی استعمال کریں!"
      },
      timeline: {
        en: "📊 Timeline View:\n\nThe timeline shows your client's 12-stage visa journey:\n📱 Lead → 🏢 Office → 📄 Docs → 🏥 Medical → 📤 E-Num → 💰 Payment →\n📝 Register → 💸 Vendor → 🎉 Approved → 🛡️ Protector → 🎫 Ticket → ✈️ Departure\n\n• 🟢 Green = Completed on time\n• 🟡 Yellow = In progress (with countdown)\n• 🔴 Red = Overdue (requires delay reason)\n• Click any stage → See checklist + deadline + responsible person",
        ur: "📊 ٹائم لائن ویو:\n\nٹائم لائن 12 مرحلے والا ویزا سفر دکھاتی ہے:\n📱 لیڈ → 🏢 آفس → 📄 دستاویزات → 🏥 میڈیکل → 📤 ای نمبر → 💰 ادائیگی →\n📝 رجسٹر → 💸 وینڈر → 🎉 منظور → 🛡️ پروٹیکٹر → 🎫 ٹکٹ → ✈️ روانگی\n\n• 🟢 سبز = وقت پر مکمل\n• 🟡 پیلا = جاری کام\n• 🔴 سرخ = ڈیڈ لائن گزر گئی\n• کسی مرحلے پر کلک → چیک لسٹ + ڈیڈ لائن دیکھیں"
      },
      caseCreate: {
        en: "📋 How to Create a New Case:\n\n1. Click \"+ New Case\" button (Dashboard or Cases page)\n2. Fill 6-step form:\n   • Step 1: Customer Info (Name*, Phone*, CNIC*, Passport*)\n   • Step 2: Job Details (Country*, Job Type*, Salary, Experience)\n   • Step 3: Emergency Contact (Name*, Relation*, Phone*)\n   • Step 4: Documents Checklist\n   • Step 5: Payment Info (Fee, Method, Receipt)\n   • Step 6: Review & Submit\n3. Auto-assigned to YOU (logged-in agent)\n4. Success: \"Case EMR-2024-XXX created!\"\n\n💡 * marked fields are mandatory. Save as Draft anytime!",
        ur: "📋 نیا کیس کیسے بنائیں:\n\n1. \"+ New Case\" بٹن پر کلک کریں\n2. 6 مرحلے کا فارم بھریں:\n   • مرحلہ 1: کلائنٹ معلومات (نام*، فون*، سی این آئی سی*، پاسپورٹ*)\n   • مرحلہ 2: جاب کی تفصیلات (ملک*، جاب ٹائپ*)\n   • مرحلہ 3: ایمرجنسی رابطہ\n   • مرحلہ 4: دستاویزات چیک لسٹ\n   • مرحلہ 5: ادائیگی کی معلومات\n   • مرحلہ 6: جائزہ لیں اور جمع کروائیں\n3. خودکار آپ کو اسائن ہو جائے گا\n4. کامیابی: \"کیس EMR-2024-XXX بن گیا!\"\n\n💡 * والی فیلڈز لازمی ہیں۔"
      },
      caseStatus: {
        en: "🔄 How to Change Case Status:\n\n1. Open Case Detail page\n2. Click current Status Badge (e.g., \"🟡 Medical\")\n3. Select new stage from dropdown\n4. ⚠️ If overdue: System requires Delay Reason (mandatory)\n5. Click \"Update Status\"\n6. Result: Badge color changes + Admin notified + audit trail logged\n\n💡 Update status BEFORE deadline to avoid delay flags!",
        ur: "🔄 کیس سٹیٹس کیسے تبدیل کریں:\n\n1. کیس ڈیٹیل پیج کھولیں\n2. موجودہ سٹیٹس بیج پر کلک کریں\n3. ڈراپ ڈاؤن سے نیا مرحلہ منتخب کریں\n4. ⚠️ ڈیڈ لائن گزری تو تاخیر کی وجہ لازمی\n5. \"اپ ڈیٹ سٹیٹس\" پر کلک کریں\n6. نتیجہ: بیج بدلتا ہے + ایڈمن نوٹیفکیشن + آڈٹ ٹریل لاگ\n\n💡 ڈیڈ لائن سے پہلے ہمیشہ اپ ڈیٹ کریں!"
      },
      caseOverdue: {
        en: "⚠️ Handling Overdue Cases:\n\n**System Behavior:**\n• Status badge turns 🔴 Red + \"⚠️ Overdue\"\n• \"Next\" button disabled until delay reason provided\n\n**Your Action:**\n1. Click \"Add Delay Reason\" (mandatory modal)\n2. Select reason: Client unavailable | Document issue | Medical delay | Embassy delay | Payment pending | Other\n3. Click \"Submit\"\n4. Result: Case \"Delayed\" + Admin notified\n\n💡 Proactive communication prevents overdue status!",
        ur: "⚠️ تاخیر والے کیسز:\n\n**سسٹم:**\n• سٹیٹس بیج 🔴 سرخ + \"⚠️ اوورڈیو\"\n• تاخیر کی وجہ کے بغیر \"اگلا\" بٹن غیر فعال\n\n**آپ کا عمل:**\n1. \"تاخیر کی وجہ\" پر کلک کریں\n2. وجہ منتخب کریں: کلائنٹ دستیاب نہیں | دستاویز مسئلہ | میڈیکل تاخیر | ایمبیسی تاخیر | ادائیگی زیر التواء\n3. \"جمع\" پر کلک کریں\n4. نتیجہ: کیس \"تاخیر\" + ایڈمن مطلع\n\n💡 پہلے سے بات چیت کریں تاکہ تاخیر نہ ہو!"
      },
      documentUpload: {
        en: "📤 How to Upload a Document:\n\n1. Open Case Detail → Click \"Documents\" tab\n2. Find document type in checklist\n3. Click [📤 Upload] button next to it\n4. Select file (PDF/JPG/PNG, max 5MB)\n5. Wait for progress bar ✓\n6. Preview → Verify quality → \"Save\"\n7. Status: ⏳ Pending → ✅ Verified (after Admin approval)\n\n📱 Mobile: Use \"AR Scan\" for auto-edge detection!",
        ur: "📤 دستاویز اپ لوڈ کیسے کریں:\n\n1. کیس ڈیٹیل → \"دستاویزات\" ٹیب\n2. چیک لسٹ میں قسم ڈھونڈیں\n3. [📤 اپ لوڈ] بٹن پر کلک\n4. فائل منتخب کریں (PDF/JPG/PNG، 5MB تک)\n5. پروگریس بار مکمل ہونے تک انتظار ✓\n6. پیش نظر → معیار تصدیق → \"سیو\"\n7. سٹیٹس: ⏳ زیر التواء → ✅ تصدیق شدہ\n\n📱 موبائل: \"AR اسکین\" استعمال کریں!"
      },
      companyInfo: {
        en: "🏢 Emerald Tech Partner:\n\n📍 Office: Registered Office Address, City Name, Country\n📞 Contact: 03186986259\n📧 Email: info@example.com\n💼 Licensed recruitment agency for Pakistani workers → Gulf countries (Saudi, UAE, Qatar, Kuwait, Oman)\n📱 WhatsApp: 03186986259",
        ur: "🏢 ایمرالڈ ٹیک پارٹنر کنسلٹنسی سروس:\n\n📍 آفس: Registered Office Address, City Name\n📞 رابطہ: 03186986259\n📧 ای میل: info@example.com\n💼 پاکستانی کارکنوں کے لیے لائسنس یافتہ ایجنسی → خلیجی ممالک\n📱 واٹس ایپ: 03186986259"
      },
      troubleshoot: {
        en: "🔧 Troubleshooting Guide:\n\n1. 🔄 Refresh page (F5 or Ctrl+R)\n2. 🌐 Check internet connection\n3. 🧹 Clear browser cache\n4. 📱 Try mobile app if web fails\n\n**If still broken:**\n📸 Take screenshot of error\n📝 Note what you were doing + error message\n📞 Contact Admin: 03186986259\n📧 Email: info@emeraldvisaconsultancy.com",
        ur: "🔧 مسائل حل:\n\n1. 🔄 پیج ریفریش کریں (F5)\n2. 🌐 انٹرنیٹ چیک کریں\n3. 🧹 براؤزر کیشے صاف کریں\n4. 📱 موبائل ایپ آزمائیں\n\n**اگر پھر بھی خراب:**\n📸 اسکرین شاٹ لیں\n📝 کیا کر رہے تھے + غلطی نوٹ کریں\n📞 ایڈمن: 03186986259\n📧 ای میل: info@emeraldvisaconsultancy.com"
      },
      escalation: {
        en: "🚨 Emergency Escalation:\n\n• **System bug** → Screenshot + contact Admin: 03186986259\n• **Payment dispute** → Owner confirmation required. Contact Admin.\n• **Document lost** → Log in Activity Log + notify Admin + recover\n• **Client complaint** → Escalate to Expert + log sentiment\n• **Client angry** → De-escalation script + offer Expert call\n\n📞 Emergency: 03186986259\n⚠️ Never bypass Owner confirmation for payments!",
        ur: "🚨 ایمرجنسی ایسکلیشن:\n\n• **سسٹم بگ** → اسکرین شاٹ + ایڈمن: 03186986259\n• **ادائیگی تنازعہ** → مالک تصدیق لازمی۔ فوراً ایڈمن رابطہ۔\n• **دستاویز گم** → ایکٹیوٹی لاگ + ایڈمن مطلع + ریکوری\n• **شکایت** → ایکسپرٹ کو ایسکلیٹ + جذبات لاگ\n• **ناراض کلائنٹ** → ڈی ایسکلیشن + ایکسپرٹ کال\n\n📞 ایمرجنسی: 03186986259\n⚠️ مالک تصدیق کبھی نہ چھوڑیں!"
      },
      default: {
        en: "I can help you with:\n• Team & agent management\n• System analytics & reports\n• Approval queue & audits\n• Financial overview\n• Data backup & sync\n• 📋 Complete 12-stage visa process\n• 🔑 Business rules & SOPs\n• 👥 Role responsibilities\n• 📦 Passport stock tracking\n• 🔐 Login & access help\n• 🔍 Search & find clients\n• 📤 Document upload guide\n• 🔧 Troubleshooting\n• 🚨 Emergency escalation\n\nWhat would you like to know? 🤖",
        ur: "میں آپ کی مدد کر سکتا ہوں:\n• ٹیم اور ایجنٹ انتظام\n• سسٹم تجزیات اور رپورٹس\n• منظوری کی قطار اور آڈٹ\n• مالیاتی جائزہ\n• ڈیٹا بیک اپ اور سنک\n• 📋 مکمل 12 مراحل ویزا پراسیس\n• 🔑 کاروباری اصول\n• 👥 رول ذمہ داریاں\n• 📦 پاسپورٹ سٹاک\n• 🔐 لاگ ان مدد\n• 🔍 کلائنٹ تلاش\n• 📤 دستاویز اپ لوڈ\n• 🔧 مسائل حل\n• 🚨 ایمرجنسی\n\nآپ کیا جاننا چاہتے ہیں؟ 🤖"
      }
    }
  },
  agent: {
    greetings: {
      en: "Assalam o Alaikum! I'm your Agent AI Assistant. Ask about your cases, next steps, medical, payments, or documents. Ready to help! 💪",
      ur: "السلام علیکم! میں آپ کا ایجنٹ AI ہوں۔ کیسز، اگلا قدم، میڈیکل، پیمنٹ، کاغذات — جو پوچھنا ہو پوچھیں۔ بولیں کیا کرنا ہے؟ 💪"
    },
    quickActions: [
      { label: "My Cases", labelUrdu: "میرے کیسز", icon: "📋", prompt: "میرے تمام کیسز دکھاؤ" },
      { label: "Create Case", labelUrdu: "نیا کیس", icon: "➕", prompt: "نیا کیس بنانا ہے" },
      { label: "Overdue", labelUrdu: "تاخیر والے", icon: "⚠️", prompt: "تاخیر والے کیسز دکھاؤ" },
      { label: "Visa Process", labelUrdu: "ویزا پراسیس", icon: "🔄" },
      { label: "Documents", labelUrdu: "دستاویزات", icon: "📄" },
    ],
    responses: {
      cases: {
        en: "Your Active Cases:\n📌 Ahmed Khan - Medical pending\n📌 Sara Ali - Document collection\n📌 Usman Tariq - Payment confirmation\n\nTotal: 8 cases | Priority: 2 urgent ⚠️",
        ur: "آپ کے فعال کیسز:\n📌 احمد خان - میڈیکل زیر التواء\n📌 سارہ علی - دستاویزات جمع\n📌 عثمان طارق - ادائیگی کی تصدیق\n\nکل: 8 کیسز | ترجیح: 2 فوری ⚠️"
      },
      next: {
        en: "Next Steps for Your Cases:\n\n1️⃣ Ahmed Khan → Upload medical report (Due: Today)\n2️⃣ Sara Ali → Call for passport copy (Due: Tomorrow)\n3️⃣ Usman Tariq → Send payment reminder (Overdue)\n\nStart with overdue case? 🎯",
        ur: "آپ کے کیسز کے لیے اگلے قدم:\n\n1️⃣ احمد خان → میڈیکل رپورٹ اپلوڈ کریں (آخری تاریخ: آج)\n2️⃣ سارہ علی → پاسپورٹ کاپی کے لیے کال کریں (آخری تاریخ: کل)\n3️⃣ عثمان طارق → ادائیگی کی یاد دہانی بھیجیں (تاخیر)\n\nتاخیر والے کیس سے شروع کریں؟ 🎯"
      },
      medical: {
        en: "🏥 Medical/GAMCA Process (Agent Guide):\n\n1. Book GAMCA token online (Fee: 4,500 PKR - client pays)\n2. Guide client via WhatsApp: Lab address + route\n3. Client brings: Passport copy + photos to lab\n4. Medical center fee: 25,000-35,000 PKR (client pays directly)\n5. Result in 36 hours\n6. After medical: Collect passport + medical receipt\n7. Receipt → file, Passport → stock (Imran's house)\n\n❌ Unfit = Case cancel + return passport\n✅ Fit = Start visa processing immediately!",
        ur: "🏥 میڈیکل/گامکا پراسیس (ایجنٹ گائیڈ):\n\nگیمکا میڈیکل ٹوکن آن لائن بک کروائیں (فیس: 4,500 روپے - کلائنٹ دیتا ہے)۔\n\n1. کلائنٹ کو واٹس ایپ پر گائیڈ کریں: لیب کا ایڈریس اور راستہ\n2. کلائنٹ ساتھ لے جائے: پاسپورٹ کی کاپی اور تصاویر\n3. میڈیکل سینٹر کی فیس: 25,000 سے 35,000 روپے (کلائنٹ براہ راست ادا کرے)\n4. 36 گھنٹوں میں نتیجہ آتا ہے\n5. میڈیکل کے بعد: اصل پاسپورٹ + میڈیکل سینٹر کی رسید وصول کریں\n6. رسید فائل میں لگائیں، پاسپورٹ سٹاک (عمران کے گھر) بھجوائیں\n\n❌ انفٹ = کیس کینسل + پاسپورٹ واپسی\n✅ فٹ = فوری طور پر ویزا پراسیسنگ شروع!"
      },
      payment: {
        en: "💰 Payment Collection Guide:\n\nTemplate (WhatsApp):\n'السلام علیکم! This is Emerald Tech Partner. Your payment of PKR [amount] is pending. Please pay via:\n• EasyPaisa: 03186986259\n• JazzCash: 03186986259\n• Bank Transfer\nContact: 03186986259'\n\n📌 Cash → Give receipt + register entry\n📌 Online → Screenshot → Owner confirmation → entry\n📌 Always remind Owner about deal rate & amount paid\n⚠️ No entry without Owner confirmation!",
        ur: "💰 ادائیگی وصولی گائیڈ:\n\nٹیمپلیٹ (واٹس ایپ):\n'السلام علیکم! یہ ایمرالڈ ٹیک پارٹنر ہے۔ آپ کی [رقم] روپے کی ادائیگی باقی ہے۔ براہ کرم ادا کریں:\n• ایزی پیسہ: 03186986259\n• جاز کیش: 03186986259\n• بینک ٹرانسفر\nرابطہ: 03186986259'\n\n📌 کیش → رسید دیں + رجسٹر میں اندراج\n📌 آن لائن → سکرین شاٹ → مالک سے کنفرمیشن → اندراج\n📌 مالک کو ہمیشہ ڈیل ریٹ اور ادا شدہ رقم یاد کروائیں\n⚠️ مالک کی تصدیق کے بغیر کوئی اندراج نہیں!"
      },
      documents: {
        en: "📄 Required Documents (Complete Checklist):\n\n✅ Passport (valid 6+ months) - all pages scanned\n✅ CNIC copy (front & back)\n✅ 4 passport-size photos + full body photo\n✅ FRC (Family Registration Certificate) - ORIGINAL\n✅ PCC (Police Clearance Certificate) - ORIGINAL\n✅ 2 Biometric slips - ORIGINAL\n✅ Medical Report - ORIGINAL\n✅ License (if Driver/Operator) - ORIGINAL\n\n⚠️ ALL originals required! One missing = Embassy rejects!\n📌 Scan everything + save properly with client name + date",
        ur: "📄 ضروری دستاویزات (مکمل فہرست):\n\n✅ پاسپورٹ (6+ ماہ درست) - تمام صفحات سکین\n✅ شناختی کارڈ کی کاپی (آگے اور پیچھے)\n✅ 4 پاسپورٹ سائز تصاویر + فل باڈی پکچر\n✅ FRC (فیملی رجسٹریشن سرٹیفکیٹ) - اصل\n✅ PCC (پولیس کلیئرنس سرٹیفکیٹ) - اصل\n✅ بائیومیٹرک کی 2 سلپس - اصل\n✅ میڈیکل رپورٹ - اصل\n✅ لائسنس (اگر ڈرائیور/آپریٹرز ہو) - اصل\n\n⚠️ تمام اصل دستاویزات لازمی! ایک بھی مس ہو تو ایمبیسی ریجیکٹ!\n📌 سب کچھ سکین کریں + کلائنٹ کا نام + تاریخ کے ساتھ محفوظ کریں"
      },
      performance: {
        en: "Your Performance (This Month):\n🏆 Cases completed: 12\n⭐ Success rate: 95%\n🎯 Target: 15 cases\n💰 Commission earned: PKR 36,000\n\nYou're #1 on the leaderboard! Keep it up! 🔥",
        ur: "آپ کی کارکردگی (اس ماہ):\n🏆 مکمل کیسز: 12\n⭐ کامیابی کی شرح: 95%\n🎯 ہدف: 15 کیسز\n💰 کمیشن حاصل: 36،000 روپے\n\nآپ لیڈر بورڈ پر #1 ہیں! جاری رکھیں! 🔥"
      },
      visaProcess: {
        en: "📋 Complete 12-Stage Visa Process:\n\n1️⃣ Lead Generation - Chatbot + Sales Rep\n2️⃣ Office Visit - Professional impression\n3️⃣ Document Collection - Scan all\n4️⃣ Medical/GAMCA - Token 4,500 PKR\n5️⃣ E-Number - PDF to Vendor\n6️⃣ Payment (2 Lakh) - Cash/Online\n7️⃣ Case Registration - CRM + Register\n8️⃣ Vendor Payment - Owner confirms\n9️⃣ Visa Approval - Congratulations!\n🔟 Protector - 8 AM appointment\n1️⃣1️⃣ Ticket - Video statement\n1️⃣2️⃣ Departure - Fly! ✈️\n\nAsk about any specific stage!",
        ur: "📋 مکمل 12 مراحل ویزا پراسیس:\n\n1️⃣ لیڈ جنریشن - چیٹ بوٹ + سیلز ریپ\n2️⃣ آفس وزٹ - پروفیشنل تاثر\n3️⃣ دستاویزات جمع - سب سکین\n4️⃣ میڈیکل/گامکا - ٹوکن 4,500 روپے\n5️⃣ ای نمبر - PDF وینڈر کو\n6️⃣ ادائیگی (2 لاکھ) - کیش/آن لائن\n7️⃣ کیس رجسٹریشن - CRM + رجسٹر\n8️⃣ وینڈر ادائیگی - مالک کی تصدیق\n9️⃣ ویزا منظوری - مبارکباد!\n🔟 پروٹیکٹر - صبح 8 بجے\n1️⃣1️⃣ ٹکٹ - ویڈیو اسٹیٹمنٹ\n1️⃣2️⃣ روانگی - فلائی! ✈️\n\nکسی بھی مرحلے کی تفصیل پوچھیں!"
      },
      clientHandling: {
        en: "🤝 Client Handling Tips:\n\n• First impression matters - office cleanliness & discipline\n• Answer every question confidently & professionally\n• Show other clients are also present (trust building)\n• Professional paperwork & bio-data forms\n• Guide client through every step via WhatsApp\n• Daily target: 5 mature clients for Sales Rep\n• Close deals same day if possible!\n\n💡 Make client feel: \"This is a professional organization\"",
        ur: "🤝 کلائنٹ ہینڈلنگ ٹپس:\n\nجب کلائنٹ آفس آتا ہے تو سب سے پہلے صفائی دیکھتا ہے، سٹاف کی آبزرویشن کرتا ہے۔ اپنے علاوہ بھی کلائنٹس دیکھنا چاہتا ہے۔\n\n• ہر سوال کا مؤثر جواب دیں - کلائنٹ کو لاجواب کر دیں\n• پیپر ورک پروفیشنل انداز سے کریں\n• واٹس ایپ پر ہر قدم پر گائیڈ کریں\n• روزانہ ٹارگٹ: 5 میچور کلائنٹس\n• جیسے میچور ہوں ڈیل کلوز کریں!\n\n💡 کلائنٹ کو محسوس کروائیں: \"یہ ایک پیشہ ور ادارہ ہے\""
      },
      protectorGuide: {
        en: "🛡️ Protector Process (Agent Guide):\n\n1. Collect from client: Nominee name + Account number\n2. Save details + send to Owner\n3. Owner provides Protector Paper (from Vendor)\n4. Send client to Protector Office at 8 AM\n5. Client gets stamp → brings original paper + 200 PKR stamp to office\n6. Get client's signature + thumbprint on paper\n7. Scan paper → give to Owner → Vendor completes online\n\n⏰ Always schedule at 8 AM sharp!",
        ur: "🛡️ پروٹیکٹر پراسیس (ایجنٹ گائیڈ):\n\nکلائنٹ سے نومینی کی تفصیلات + اکاؤنٹ نمبر منگوائیں۔\n\n1. تفصیلات سیو کریں + مالک کو سینڈ کریں\n2. مالک وینڈر سے پروٹیکٹر پیپر نکلوا کر دے گا\n3. کلائنٹ کو صبح 8 بجے پروٹیکٹر آفس بھجوائیں\n4. کلائنٹ سٹمپ لگوا کر اوریجنل پیپر + 200 روپے گارنٹی اسٹامپ آفس جمع کروائے\n5. پروٹیکٹر پیپر پر کلائنٹ کا سائن + انگوٹھا لگوائیں\n6. پیپر سکین کر کے مالک کو دیں\n7. مالک وینڈر کو بھیجے → وینڈر آن لائن پروٹیکٹر کر دے\n\n⏰ ہمیشہ صبح 8 بجے شیڈول کریں!"
      },
      agreementGuide: {
        en: "📝 Agreement/Iqrarnama Guide:\n\n• The agreement is between Client & Emerald Tech Partners\n• It's a written agreement that primarily benefits the client\n• Must be signed BEFORE starting any process\n• Ensures transparency and protects both parties\n• Keep signed copy in client file\n\n⚠️ Never skip the agreement step!",
        ur: "📝 اقرار نامہ گائیڈ:\n\nکلائنٹ سے آفس کا اقرار نامہ سائن کروانا ضروری ہے جو کلائنٹ اور ایمرالڈ ٹیک پارٹنر کنسلٹنسی سروسیز کے مابین ایک تحریری معاہدہ ہے۔\n\n• اس کا زیادہ فائدہ کلائنٹ کو ہے\n• کوئی بھی عمل شروع کرنے سے پہلے سائن کروائیں\n• شفافیت یقینی بناتا ہے اور دونوں فریقوں کی حفاظت کرتا ہے\n• سائن شدہ کاپی کلائنٹ فائل میں رکھیں\n\n⚠️ اقرار نامے کا مرحلہ کبھی نہ چھوڑیں!"
      },
      login: {
        en: "🔐 Agent Login Guide:\n\n1. Open CRM login page\n2. Enter your 6-digit access code (received via WhatsApp from Admin)\n3. Click \"Activate Session\"\n4. Session valid for 6 hours → Auto-logout after that\n\n**Session expired?**\n• Request new code: Login page → \"Request Code via WhatsApp\"\n• Or contact Admin: 03186986259\n\n💡 Tip: Code not received? Call Admin directly!",
        ur: "🔐 ایجنٹ لاگ ان گائیڈ:\n\n1. CRM لاگ ان پیج کھولیں\n2. 6 ہندسوں کا ایکسیس کوڈ درج کریں (ایڈمن سے واٹس ایپ پر ملا)\n3. \"ایکٹیویٹ سیشن\" پر کلک کریں\n4. سیشن 6 گھنٹے فعال → خودکار لاگ آؤٹ\n\n**سیشن ختم؟**\n• نیا کوڈ مانگیں: لاگ ان → \"واٹس ایپ سے کوڈ مانگیں\"\n• یا ایڈمن: 03186986259\n\n💡 کوڈ نہیں ملا؟ ایڈمن کو براہ راست کال کریں!"
      },
      dashboard: {
        en: "📊 Your Dashboard & Tasks:\n\n• Dashboard → \"Today's Tasks\" widget (top)\n• Shows: Follow-ups | Document uploads | Payment reminders | Appointments\n• Click any task → Opens related case\n• Priority: 🔴 Overdue → 🟡 Due Today → 🔵 Upcoming\n\n💡 Start with overdue items first!",
        ur: "📊 آپ کا ڈیش بورڈ اور کام:\n\n• ڈیش بورڈ → \"آج کے کام\" ویجٹ\n• دکھاتا ہے: فالو اپس | اپ لوڈز | ادائیگی یاد دہانیاں | اپائنٹمنٹس\n• کام پر کلک → متعلقہ کیس کھلے گا\n• ترجیح: 🔴 اوورڈیو → 🟡 آج واجب → 🔵 آنے والے\n\n💡 پہلے تاخیر والے آئٹمز سے شروع کریں!"
      },
      searchClient: {
        en: "🔍 Finding a Client:\n\n**Quick Search:**\n• Top navigation → Search 🔍\n• Type: Name / Phone / Case ID / Passport #\n• Results instant → Click to open\n\n**Cases List:**\n• Cases → All Cases → Apply filters\n\n💡 Case ID (EMR-2024-XXX) gives fastest results!",
        ur: "🔍 کلائنٹ ڈھونڈنا:\n\n**فوری تلاش:**\n• ٹاپ نیویگیشن → سرچ 🔍\n• ٹائپ: نام / فون / کیس آئی ڈی / پاسپورٹ #\n• فوری نتائج → کلک سے کھلے\n\n**کیسز لسٹ:**\n• Cases → All Cases → فلٹرز لگائیں\n\n💡 کیس آئی ڈی سب سے تیز!"
      },
      caseCreate: {
        en: "📋 Creating a New Case:\n\n1. Click \"+ New Case\" (Dashboard or Cases)\n2. 6-step form:\n   • Customer Info (Name*, Phone*, CNIC*, Passport*)\n   • Job Details (Country*, Job Type*)\n   • Emergency Contact\n   • Documents Checklist\n   • Payment Info\n   • Review & Submit\n3. Auto-assigned to you!\n\n💡 * = mandatory. Save as Draft anytime!",
        ur: "📋 نیا کیس بنانا:\n\n1. \"+ New Case\" پر کلک کریں\n2. 6 مرحلے کا فارم:\n   • کلائنٹ معلومات (نام*، فون*، CNIC*، پاسپورٹ*)\n   • جاب تفصیلات (ملک*، جاب ٹائپ*)\n   • ایمرجنسی رابطہ\n   • دستاویزات چیک لسٹ\n   • ادائیگی معلومات\n   • جائزہ اور جمع\n3. خودکار آپ کو اسائن!\n\n💡 * = لازمی۔ ڈرافٹ سیو ممکن!"
      },
      caseOverdue: {
        en: "⚠️ Overdue Cases:\n\n• Badge turns 🔴 Red + \"Overdue\"\n• Must add Delay Reason to proceed\n• Reasons: Client unavailable | Doc issue | Medical delay | Embassy delay | Payment pending\n• Admin gets notified automatically\n\n💡 Update status BEFORE deadline!",
        ur: "⚠️ تاخیر والے کیسز:\n\n• بیج 🔴 سرخ + \"اوورڈیو\"\n• آگے بڑھنے کے لیے تاخیر کی وجہ لازمی\n• وجوہات: کلائنٹ دستیاب نہیں | دستاویز مسئلہ | میڈیکل تاخیر | ایمبیسی تاخیر | ادائیگی زیر التواء\n• ایڈمن خودکار مطلع\n\n💡 ڈیڈ لائن سے پہلے اپ ڈیٹ کریں!"
      },
      companyInfo: {
        en: "🏢 Emerald Tech Partner\n📍 Registered Office Address, City Name\n📞 03186986259\n📧 info@example.com\n💼 Gulf country recruitment (Saudi, UAE, Qatar, Kuwait, Oman)",
        ur: "🏢 ایمرالڈ ٹیک پارٹنر کنسلٹنسی سروس\n📍 رجسٹرڈ آفس، سٹی نیم\n📞 03186986259\n📧 info@example.com\n💼 خلیجی ممالک ریکروٹمنٹ"
      },
      troubleshoot: {
        en: "🔧 Quick Fixes:\n1. 🔄 Refresh (F5)\n2. 🌐 Check internet\n3. 🧹 Clear cache\n4. 📱 Try mobile\n\nStill broken? 📞 Admin: 03186986259",
        ur: "🔧 فوری حل:\n1. 🔄 ریفریش (F5)\n2. 🌐 انٹرنیٹ چیک\n3. 🧹 کیشے صاف\n4. 📱 موبائل آزمائیں\n\nپھر بھی خراب؟ 📞 ایڈمن: 03186986259"
      },
      escalation: {
        en: "🚨 Emergency:\n• Bug → Screenshot + call Admin: 03186986259\n• Payment issue → Owner confirmation required\n• Document lost → Log + notify Admin + recover\n• Angry client → De-escalation + Expert call\n\n⚠️ Never bypass Owner confirmation!",
        ur: "🚨 ایمرجنسی:\n• بگ → اسکرین شاٹ + ایڈمن: 03186986259\n• ادائیگی مسئلہ → مالک تصدیق لازمی\n• دستاویز گم → لاگ + ایڈمن مطلع + ریکوری\n• ناراض کلائنٹ → ڈی ایسکلیشن + ایکسپرٹ کال\n\n⚠️ مالک تصدیق کبھی نہ چھوڑیں!"
      },
      default: {
        en: "I can help you with:\n• Your active cases & next steps\n• Medical & GAMCA process\n• Payment collection & reminders\n• Document checklist\n• Performance tracking\n• 📋 12-stage visa process\n• 🤝 Client handling tips\n• 🛡️ Protector guide\n• 📝 Agreement guide\n• 🔐 Login help\n• 🔍 Search clients\n• 📤 Upload docs\n• 🔧 Troubleshooting\n\nWhat do you need? 🚀",
        ur: "میں آپ کی مدد کر سکتا ہوں:\n• فعال کیسز اور اگلے قدم\n• میڈیکل/گامکا پراسیس\n• ادائیگی وصولی اور یاد دہانی\n• دستاویزات فہرست\n• کارکردگی ٹریکنگ\n• 📋 12 مراحل ویزا پراسیس\n• 🤝 کلائنٹ ہینڈلنگ ٹپس\n• 🛡️ پروٹیکٹر گائیڈ\n• 📝 اقرار نامہ گائیڈ\n• 🔐 لاگ ان مدد\n• 🔍 کلائنٹ تلاش\n• 📤 دستاویز اپ لوڈ\n• 🔧 مسائل حل\n\nآپ کو کیا چاہیے؟ 🚀"
      }
    }
  },
  customer: {
    greetings: {
      en: "Assalam o Alaikum! Welcome to Emerald Tech Partner! Ask me about your visa status, documents, payments, or any step. I'm here to help! 🌍",
      ur: "السلام علیکم! ایمرالڈ ٹیک پارٹنر میں خوش آمدید! ویزا سٹیٹس، کاغذات، پیمنٹ، یا کوئی بھی سوال — بے فکر پوچھیں۔ میں حاضر ہوں! 🌍"
    },
    quickActions: [
      { label: "Track Status", labelUrdu: "میرا سٹیٹس", icon: "📍", prompt: "میرا ویزا سٹیٹس کیا ہے؟" },
      { label: "Documents", labelUrdu: "دستاویزات", icon: "📄", prompt: "میڈیکل کے لیے کیا لے کر جاؤں؟" },
      { label: "Payment", labelUrdu: "ادائیگی", icon: "💳", prompt: "ادائیگی کیسے کروں؟" },
      { label: "Visa Stages", labelUrdu: "ویزا مراحل", icon: "🔄" },
      { label: "Agent Contact", labelUrdu: "ایجنٹ رابطہ", icon: "📞", prompt: "ایجنٹ سے بات کرنی ہے" },
    ],
    responses: {
      status: {
        en: "Your Case Status:\n📋 Current Stage: Medical Examination\n✅ Completed: Document Collection, Payment\n⏳ Next: Medical Result Upload\n🎯 Progress: 60%\n\nEstimated completion: 15 days 📅",
        ur: "آپ کے کیس کی حیثیت:\n📋 موجودہ مرحلہ: میڈیکل معائنہ\n✅ مکمل: دستاویزات جمع، ادائیگی\n⏳ اگلا: میڈیکل نتیجہ اپلوڈ\n🎯 پیش رفت: 60%\n\nتخمینی تکمیل: 15 دن 📅"
      },
      documents: {
        en: "📄 Your Documents Status:\n✅ Passport - Verified\n✅ CNIC - Verified\n✅ Photos - Verified\n⏳ Medical Report - Pending\n\nRequired Originals at Payment Stage:\n• Old + New Passport\n• CNIC, Photos, FRC, PCC\n• 2 Biometric Slips\n• Medical Report\n• License (if Driver/Operator)\n\n⚠️ All originals needed! Contact: 03186986259",
        ur: "📄 آپ کی دستاویزات کی حیثیت:\n✅ پاسپورٹ - تصدیق شدہ\n✅ شناختی کارڈ - تصدیق شدہ\n✅ تصاویر - تصدیق شدہ\n⏳ میڈیکل رپورٹ - زیر التواء\n\nادائیگی کے مرحلے پر اصل دستاویزات درکار:\n• پرانا + نیا پاسپورٹ\n• شناختی کارڈ، تصاویر، FRC، PCC\n• بائیومیٹرک کی 2 سلپس\n• میڈیکل رپورٹ\n• لائسنس (اگر ڈرائیور/آپریٹرز ہو)\n\n⚠️ تمام اصل دستاویزات لازمی! رابطہ: 03186986259"
      },
      payment: {
        en: "💰 Payment Information:\n\nPayment Methods:\n• Cash (receipt provided)\n• EasyPaisa: 03186986259\n• JazzCash: 03186986259\n• Bank Transfer (company account)\n\nFee Structure:\n• Medical Token: PKR 4,500\n• Medical Center: PKR 25,000-35,000\n• Visa Processing: As per agreement\n• Protector Stamp: PKR 200\n\n📞 Contact for payment queries: 03186986259",
        ur: "💰 ادائیگی کی معلومات:\n\nادائیگی کے طریقے:\n• کیش (رسید دی جائے گی)\n• ایزی پیسہ: 03186986259\n• جاز کیش: 03186986259\n• بینک ٹرانسفر (کمپنی اکاؤنٹ)\n\nفیس کی تفصیل:\n• میڈیکل ٹوکن: 4,500 روپے\n• میڈیکل سینٹر: 25,000 سے 35,000 روپے\n• ویزا پراسیسنگ: معاہدے کے مطابق\n• پروٹیکٹر اسٹامپ: 200 روپے\n\n📞 ادائیگی کے سوالات کے لیے رابطہ: 03186986259"
      },
      medical: {
        en: "🏥 Medical Examination Guide:\n\n📅 Appointment: Your agent will book GAMCA token\n💰 Token Fee: PKR 4,500 (pay at office)\n💰 Medical Center Fee: PKR 25,000-35,000 (pay at center)\n\n📦 What to bring:\n• Original Passport\n• Passport copy\n• Your photos\n• Token receipt\n\n⏰ Result: Within 36 hours\n✅ Fit → Visa processing starts\n❌ Unfit → Case reviewed\n\n📍 Centers: Lahore, Islamabad, Karachi\n📞 Contact: 03186986259",
        ur: "🏥 میڈیکل معائنہ گائیڈ:\n\nآپ کا ایجنٹ گامکا ٹوکن آن لائن بک کرے گا۔\n\n💰 ٹوکن فیس: 4,500 روپے (آفس میں ادا کریں)\n💰 میڈیکل سینٹر فیس: 25,000 سے 35,000 روپے (سینٹر میں ادا کریں)\n\n📦 ساتھ لے جائیں:\n• اصل پاسپورٹ\n• پاسپورٹ کی کاپی\n• آپ کی تصاویر\n• ٹوکن رسید\n\n⏰ نتیجہ: 36 گھنٹوں کے اندر\n✅ فٹ → ویزا پراسیسنگ شروع\n❌ انفٹ → کیس کا جائزہ\n\n📍 سینٹرز: لاہور، اسلام آباد، کراچی\n📞 رابطہ: 03186986259"
      },
      visaStages: {
        en: "🔄 Your Visa Journey - 12 Stages:\n\n1️⃣ ✅ Initial Contact & Qualification\n2️⃣ ✅ Office Visit & Agreement\n3️⃣ ✅ Document Collection\n4️⃣ ⏳ Medical Examination ← You are here\n5️⃣ ⬜ E-Number Processing\n6️⃣ ⬜ Biometric & Payment (2 Lakh)\n7️⃣ ⬜ Case Registration\n8️⃣ ⬜ Visa Processing\n9️⃣ ⬜ Visa Approval 🎉\n🔟 ⬜ Protector Process\n1️⃣1️⃣ ⬜ Ticket Booking\n1️⃣2️⃣ ⬜ Departure ✈️\n\nEach stage is tracked in real-time!",
        ur: "🔄 آپ کا ویزا سفر - 12 مراحل:\n\n1️⃣ ✅ ابتدائی رابطہ اور کوالیفکیشن\n2️⃣ ✅ آفس وزٹ اور معاہدہ\n3️⃣ ✅ دستاویزات جمع\n4️⃣ ⏳ میڈیکل معائنہ ← آپ یہاں ہیں\n5️⃣ ⬜ ای نمبر پراسیسنگ\n6️⃣ ⬜ بائیومیٹرک اور ادائیگی (2 لاکھ)\n7️⃣ ⬜ کیس رجسٹریشن\n8️⃣ ⬜ ویزا پراسیسنگ\n9️⃣ ⬜ ویزا منظوری 🎉\n🔟 ⬜ پروٹیکٹر پراسیس\n1️⃣1️⃣ ⬜ ٹکٹ بکنگ\n1️⃣2️⃣ ⬜ روانگی ✈️\n\nہر مرحلہ ریئل ٹائم ٹریک ہوتا ہے!"
      },
      protector: {
        en: "🛡️ Protector Process (What You Need):\n\nAfter visa approval, you'll need:\n• Nominee name (someone you trust)\n• Any bank account number\n\nWhat happens:\n1. You visit Protector Office at 8 AM\n2. Get stamp on protector paper\n3. Submit original paper + PKR 200 stamp at our office\n4. Sign + thumbprint on the paper\n5. We handle the rest online!\n\n📞 Questions? Call: 03186986259",
        ur: "🛡️ پروٹیکٹر پراسیس (آپ کو کیا چاہیے):\n\nویزا منظوری کے بعد آپ کو درکار ہوگا:\n• نومینی کا نام (کوئی بھروسے مند شخص)\n• کوئی سا بھی بینک اکاؤنٹ نمبر\n\nکیا ہوگا:\n1. صبح 8 بجے پروٹیکٹر آفس جائیں\n2. پروٹیکٹر پیپر پر سٹمپ لگوائیں\n3. اوریجنل پیپر + 200 روپے اسٹامپ ہمارے آفس جمع کروائیں\n4. پیپر پر سائن + انگوٹھا لگائیں\n5. باقی کام ہم آن لائن کر دیں گے!\n\n📞 سوالات؟ کال کریں: 03186986259"
      },
      agreement: {
        en: "📝 About Your Agreement:\n\nThe Retainer Agreement is between you and Emerald Tech Partners:\n• It's a written agreement primarily for YOUR benefit\n• Outlines services, fees, and responsibilities\n• Protects your rights as a client\n• Must be signed before process starts\n\nYou can request a copy anytime!\n📞 Contact: 03186986259",
        ur: "📝 آپ کے معاہدے کے بارے میں:\n\nاقرار نامہ آپ اور ایمرالڈ ٹیک پارٹنر کنسلٹنسی سروسیز کے مابین ایک تحریری معاہدہ ہے:\n• اس کا زیادہ فائدہ آپ کو ہے\n• خدمات، فیس اور ذمہ داریاں واضح کرتا ہے\n• بطور کلائنٹ آپ کے حقوق کی حفاظت کرتا ہے\n• عمل شروع کرنے سے پہلے سائن ہونا ضروری ہے\n\nآپ کسی بھی وقت کاپی کی درخواست کر سکتے ہیں!\n📞 رابطہ: 03186986259"
      },
      login: {
        en: "🔐 Customer Portal Access:\n\nYour visa journey is tracked through our portal. To check status:\n• Visit the customer portal\n• Or contact your agent directly: 03186986259\n• WhatsApp updates sent automatically at each stage\n\n📱 Preferred: WhatsApp for real-time updates!",
        ur: "🔐 کسٹمر پورٹل:\n\nآپ کا ویزا سفر ہمارے پورٹل سے ٹریک ہوتا ہے۔ حیثیت چیک کرنے کے لیے:\n• کسٹمر پورٹل وزٹ کریں\n• یا ایجنٹ سے براہ راست رابطہ: 03186986259\n• ہر مرحلے پر واٹس ایپ اپ ڈیٹس خودکار\n\n📱 ترجیحی: ریئل ٹائم اپ ڈیٹس کے لیے واٹس ایپ!"
      },
      companyInfo: {
        en: "🏢 Emerald Tech Partner\n\n📍 Office: Registered Office Address, City Name\n📞 Contact: 03186986259\n📧 Email: info@example.com\n💼 We help Pakistani workers get jobs in Gulf countries\n📱 WhatsApp: 03186986259\n\nVisit us during office hours for consultation!",
        ur: "🏢 ایمرالڈ ٹیک پارٹنر کنسلٹنسی سروس\n\n📍 آفس: Registered Office Address, City Name\n📞 رابطہ: 03186986259\n📧 ای میل: info@example.com\n💼 ہم پاکستانی کارکنوں کو خلیجی ملازمت دلاتے ہیں\n📱 واٹس ایپ: 03186986259\n\nمشاورت کے لیے آفس اوقات میں تشریف لائیں!"
      },
      troubleshoot: {
        en: "🔧 Having Issues?\n\n1. 🔄 Refresh your page\n2. 🌐 Check internet\n3. 📱 Try on mobile\n\nStill having problems?\n📞 Call: 03186986259\n📧 Email: info@emeraldvisaconsultancy.com\n\nWe're here to help! 😊",
        ur: "🔧 مسئلہ ہے؟\n\n1. 🔄 پیج ریفریش کریں\n2. 🌐 انٹرنیٹ چیک کریں\n3. 📱 موبائل پر آزمائیں\n\nپھر بھی مسئلہ؟\n📞 کال: 03186986259\n📧 ای میل: info@emeraldvisaconsultancy.com\n\nہم مدد کے لیے حاضر ہیں! 😊"
      },
      default: {
        en: "I can help you:\n• Check case status & progress\n• View document requirements\n• Payment information & methods\n• Medical appointment details\n• 🔄 Track your 12-stage visa journey\n• 🛡️ Protector process info\n• 📝 Agreement details\n• 🏢 Company info & location\n• 🔧 Troubleshooting help\n• Contact agent: 03186986259\n\nHow can I assist you? 😊",
        ur: "میں آپ کی مدد کر سکتا ہوں:\n• کیس حیثیت اور پیش رفت\n• دستاویزات کی ضروریات\n• ادائیگی معلومات اور طریقے\n• میڈیکل اپائنٹمنٹ\n• 🔄 12 مراحل ویزا سفر ٹریک\n• 🛡️ پروٹیکٹر پراسیس\n• 📝 معاہدے کی تفصیلات\n• 🏢 کمپنی معلومات اور پتہ\n• 🔧 مسائل حل\n• ایجنٹ رابطہ: 03186986259\n\nمیں کیسے مدد کروں؟ 😊"
      }
    }
  }
};

// Map NLP intent keys to ROLE_KNOWLEDGE response keys (they differ per role)
function mapIntentToResponseKey(intentKey: string, role: string): string {
  const mappings: Record<string, Record<string, string>> = {
    agent: {
      medicalProcess: "medical",
      protectorProcess: "protectorGuide",
    },
    customer: {
      medicalProcess: "medical",
      protectorProcess: "protector",
    },
  };
  return mappings[role]?.[intentKey] || intentKey;
}

// Smart response resolver using NLP engine
function getSmartResponse(
  input: string,
  role: UserRole,
  context: ConversationContext,
  knowledge: typeof ROLE_KNOWLEDGE["admin"]
): { response: string; updatedContext: ConversationContext } {
  const effectiveRole = role === "master_admin" ? "admin" : role;
  const nlpResult = processMessage(input, effectiveRole as UserRole, context);
  const lang = nlpResult.language;

  // Update context
  const updatedContext: ConversationContext = {
    ...context,
    messageCount: context.messageCount + 1,
    language: lang,
  };

  // Handle greeting
  if (nlpResult.isGreeting) {
    return {
      response: getGreetingResponse(role, lang),
      updatedContext,
    };
  }

  // Handle thank you
  if (nlpResult.isThankYou) {
    return {
      response: getThankYouResponse(lang),
      updatedContext,
    };
  }

  // Get response for primary intent (map intent key to response key)
  const rawIntentKey = nlpResult.primaryIntent;
  const intentKey = rawIntentKey ? mapIntentToResponseKey(rawIntentKey, effectiveRole) : null;
  if (intentKey && (knowledge.responses as any)[intentKey]) {
    const responseData = (knowledge.responses as any)[intentKey];
    let responseText = responseData[lang] || responseData.en;

    // If follow-up, add intro
    if (nlpResult.isFollowUp) {
      responseText = getFollowUpIntro(lang) + responseText;
    }

    // If there's a strong secondary intent, append a hint
    if (nlpResult.secondaryIntent && nlpResult.secondaryIntent !== rawIntentKey) {
      const secondaryMapped = mapIntentToResponseKey(nlpResult.secondaryIntent, effectiveRole);
      const secondaryData = (knowledge.responses as any)[secondaryMapped];
      if (secondaryData) {
        const secondaryLabel = nlpResult.secondaryIntent.replace(/([A-Z])/g, ' $1').trim();
        const hint = lang === "ur"
          ? `\n\n💡 آپ نے "${secondaryLabel}" کے بارے میں بھی پوچھا - "مزید بتاؤ" کہیں اس کی تفصیل کے لیے!`
          : `\n\n💡 I also noticed you might be asking about "${secondaryLabel}" - say "tell me more" to learn about that too!`;
        responseText += hint;
      }
    }

    updatedContext.lastIntent = rawIntentKey;
    updatedContext.lastTopics = [rawIntentKey!, ...(nlpResult.secondaryIntent ? [nlpResult.secondaryIntent] : [])];

    return { response: responseText, updatedContext };
  }

  // Smart fallback
  return {
    response: getSmartFallback(nlpResult.suggestedTopics, lang),
    updatedContext,
  };
}

export function RoleBasedChatbot({ role }: RoleBasedChatbotProps) {
  const { isUrdu, fontClass } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const effectiveRole = (role === "master_admin" ? "admin" : role) as "admin" | "agent" | "customer";
  const knowledge = ROLE_KNOWLEDGE[effectiveRole];
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, text: getGreetingResponse(role, isUrdu ? "ur" : "en"), isBot: true, avatar: "wave" },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isGeminiThinking, setIsGeminiThinking] = useState(false);
  const [botAnimation, setBotAnimation] = useState<"wave" | "think" | "celebrate">("wave");
  const [streamingMsgId, setStreamingMsgId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef<ConversationContext>(createContext());

  // Voice features state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Check Web Speech API support
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // Text-to-Speech
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u2022\*\n#]+/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = isUrdu ? "ur-PK" : "en-US";
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Speech-to-Text toggle
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = isUrdu ? 'ur-PK' : 'en-US';
      recognition.maxAlternatives = 3;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let finalT = '', interimT = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalT += event.results[i][0].transcript;
          else interimT += event.results[i][0].transcript;
        }
        setInput(finalT || interimT);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch { /* no speech support */ }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;

    const userMsg: Message = { id: Date.now(), text: msg, isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setBotAnimation("think");

    const history: ChatMessage[] = messages
      .filter(m => m.id !== 0)
      .map(m => ({ text: m.text, isBot: m.isBot }));
    const crmCtx = (await buildCRMContext(msg)) + "\n" + CRM_ACTION_INSTRUCTIONS;

    // Create a streaming placeholder message
    const botMsgId = Date.now() + 1;
    setStreamingMsgId(botMsgId);
    setIsGeminiThinking(true);
    setMessages(prev => [...prev, { id: botMsgId, text: "", isBot: true, avatar: "arcee" }]);

    const finalize = async (fullText: string) => {
      const { actions, cleanText } = parseActions(fullText);
      let actionResultText = "";
      if (actions.length > 0) {
        const results = await executeAllActions(actions);
        actionResultText = results.map(r =>
          r.success ? `\u2705 ${r.message}` : `\u274c ${r.message}`
        ).join("\n\n");
      }
      const finalText = actionResultText ? `${actionResultText}\n\n${cleanText}` : (cleanText || fullText);
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: finalText } : m));
      setStreamingMsgId(null);
      setIsTyping(false);
      setIsGeminiThinking(false);
      setBotAnimation(actions.length > 0 ? "celebrate" : "celebrate");
    };

    const fallback = async () => {
      try {
        const geminiResult = await callGeminiAI(msg, role, "ur", history, crmCtx);
        if (geminiResult.success && geminiResult.response) { finalize(geminiResult.response); return; }
      } catch { /* ignore */ }
      // SmartNLP offline fallback
      const { response, updatedContext } = getSmartResponse(msg, role, contextRef.current, knowledge);
      contextRef.current = updatedContext;
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: response } : m));
      setStreamingMsgId(null);
      setIsTyping(false);
      setIsGeminiThinking(false);
      setBotAnimation("wave");
    };

    try {
      const full = await streamQwenAI(
        msg, role, "ur", history, crmCtx,
        (token) => {
          setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: m.text + token } : m));
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        },
        finalize,
        fallback,
      );
      // If stream returned empty (error path handled by callbacks), full string is empty
      if (!full && !streamingMsgId) { /* callbacks already handled it */ }
    } catch (err: any) {
      await fallback();
    }
  }, [input, role, knowledge, messages, isUrdu]);

  const handleQuickAction = (label: string, prompt?: string) => {
    handleSend(prompt || label);
  };

  const avatarEmoji = botAnimation === "wave" ? "👋" : botAnimation === "think" ? "🤔" : "🎉";
  const roleIcon = role === "master_admin" ? <Crown className="w-3 h-3" /> : role === "admin" ? <Shield className="w-3 h-3" /> : role === "agent" ? <Briefcase className="w-3 h-3" /> : <Bot className="w-3 h-3" />;
  const roleColor = role === "master_admin" ? "from-purple-600 to-amber-500" : role === "admin" ? "from-blue-500 to-indigo-600" : role === "agent" ? "from-emerald-500 to-teal-600" : "from-purple-500 to-pink-600";
  const roleLabel = role === "master_admin" ? (isUrdu ? "ماسٹر ایڈمن" : "Master Admin") : role === "admin" ? (isUrdu ? "ایڈمن" : "Admin") : role === "agent" ? (isUrdu ? "ایجنٹ" : "Agent") : (isUrdu ? "کسٹمر" : "Customer");

  return (
    <>
      {/* Floating chat button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className={`fixed bottom-20 lg:bottom-6 ${isUrdu ? "right-4" : "left-4"} z-[100] w-14 h-14 rounded-full bg-gradient-to-br ${roleColor} text-white shadow-2xl flex items-center justify-center`}
          >
            <MessageCircle className="w-6 h-6" />
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`absolute -top-1 ${isUrdu ? "-left-1" : "-right-1"} w-4 h-4 rounded-full bg-green-400 border-2 border-white`}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25 }}
            className={`${isUrdu ? fontClass : ""} fixed z-[150]
              inset-2 sm:inset-auto sm:bottom-20 ${isUrdu ? "sm:right-4" : "sm:left-4"} lg:bottom-6
              sm:w-[420px] sm:h-[600px]
              bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
              border border-gray-200 dark:border-gray-700
              flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className={`p-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r ${roleColor} text-white rounded-t-2xl`}>
              <motion.div
                animate={botAnimation === "wave" ? { rotate: [0, 15, -15, 0] } : botAnimation === "think" ? { y: [0, -3, 0] } : { scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-3xl"
              >
                {avatarEmoji}
              </motion.div>
              <div className="flex-1">
                <p className="font-bold text-sm flex items-center gap-2">
                  Emerald AI {roleIcon}
                </p>
                <p className="text-xs text-white/80">
                  {isGeminiThinking ? (isUrdu ? "✨ StepFun AI سے جواب آ رہا ہے..." : "✨ Streaming from StepFun AI...") : isTyping ? (isUrdu ? "ٹائپ کر رہا ہے..." : "Typing...") : (isUrdu ? "آن لائن" : "Online")} • {roleLabel}
                </p>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.isBot ? "justify-start" : "justify-end"}`}
                >
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-line ${
                    msg.isBot
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md"
                      : "bg-gradient-to-br " + roleColor + " text-white rounded-br-md"
                  }`} dir={msg.isBot ? "rtl" : "auto"}>
                    {msg.text}
                    {/* Streaming cursor — pulses while this message is being streamed */}
                    {msg.id === streamingMsgId && (
                      <span className="inline-block w-0.5 h-4 bg-emerald-500 ml-0.5 animate-pulse align-middle" />
                    )}
                    {msg.isBot && msg.avatar === "arcee" && msg.id !== streamingMsgId && (
                      <span className="block mt-1.5 text-[10px] text-emerald-500 dark:text-emerald-400 font-medium opacity-70" dir="rtl">
                        ✨ StepFun AI سے تیار کردہ
                      </span>
                    )}
                    {msg.isBot && (
                      <button
                        onClick={() => isSpeaking ? stopSpeaking() : speakText(msg.text)}
                        className={`inline-flex items-center gap-1 mt-1.5 text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                          isSpeaking
                            ? "text-orange-500 bg-orange-50 dark:bg-orange-900/20"
                            : "text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        }`}
                        title={isUrdu ? "سنیں" : "Listen"}
                      >
                        <Volume2 className={`w-3 h-3 ${isSpeaking ? 'animate-pulse' : ''}`} />
                        {isUrdu ? "سنیں" : "Listen"}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className={`${isGeminiThinking ? 'bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/30 dark:to-blue-900/30 border border-emerald-200 dark:border-emerald-800' : 'bg-gray-100 dark:bg-gray-800'} p-3 rounded-2xl rounded-bl-md flex items-center gap-2`}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -5, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                          className={`w-2 h-2 ${isGeminiThinking ? 'bg-emerald-400' : 'bg-gray-400 dark:bg-gray-500'} rounded-full`}
                        />
                      ))}
                    </div>
                    {isGeminiThinking && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                        ✨ StepFun AI
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick actions */}
            <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {knowledge.quickActions.map((action: any) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(isUrdu ? action.labelUrdu : action.label, action.prompt)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium
                    bg-gradient-to-br ${roleColor} bg-opacity-10 text-gray-700 dark:text-gray-300
                    border border-gray-200 dark:border-gray-700
                    hover:opacity-80 transition-opacity
                    min-h-[36px] whitespace-nowrap`}
                >
                  <span>{action.icon}</span>
                  <span>{isUrdu ? action.labelUrdu : action.label}</span>
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              {isListening && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                    {isUrdu ? "سن رہا ہے... بولیں" : "Listening... speak now"}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {speechSupported && (
                  <button
                    onClick={toggleListening}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                      isListening
                        ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    }`}
                    title={isUrdu ? "بولیں" : "Voice input"}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder={isUrdu ? "پیغام ٹائپ کریں یا بولیں..." : "Type or speak a message..."}
                  className={`${isUrdu ? "text-right " + fontClass : ""} flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm
                    text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500
                    border-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                    min-h-[48px]`}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shrink-0
                    ${input.trim()
                      ? "bg-gradient-to-br " + roleColor + " text-white hover:opacity-90"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                    }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[10px] text-center text-gray-400 mt-2">
                {speechSupported
                  ? (isUrdu ? "🎤 آواز + ٹائپ • ایمرالڈ ٹیک پارٹنر • 03186986259" : "🎤 Voice + Type · Emerald Tech Partner · 03186986259")
                  : (isUrdu ? "ایمرالڈ ٹیک پارٹنر • 03186986259" : "Emerald Tech Partner · 03186986259")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
