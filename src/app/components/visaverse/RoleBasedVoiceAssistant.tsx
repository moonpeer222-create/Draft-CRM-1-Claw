import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, X, Volume2, Shield, Briefcase, Bot, Keyboard, Crown } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import {
  processMessage, createContext,
  getGreetingResponse,
  type ConversationContext, type UserRole,
} from "./SmartNLP";
import { callGeminiAI } from "../../lib/geminiApi";
import { buildCRMContext, CRM_ACTION_INSTRUCTIONS, parseActions, executeAllActions } from "../../lib/crmTools";

interface RoleBasedVoiceAssistantProps {
  role: UserRole;
}

// Comprehensive voice commands and responses by role — trained on visa-consultancy-process.md
const VOICE_COMMANDS = {
  admin: {
    commands: [
      "Show team overview",
      "System statistics",
      "Pending approvals",
      "Financial summary",
      "Agent performance",
      "Visa process stages",
      "Business rules",
      "Lead generation",
      "Medical process",
      "Protector process",
      "Passport stock",
      "Role responsibilities",
      "ٹیم کا جائزہ دکھائیں",
      "سسٹم کے اعداد و شمار",
      "زیر التواء منظوریاں",
      "مالیاتی خلاصہ",
      "ایجنٹ کی کارکردگی",
      "ویزا پراسیس کے مراحل",
      "کاروباری اصول",
      "لیڈ جنریشن",
      "میڈیکل پراسیس",
      "پروٹیکٹر پراسیس",
      "پاسپورٹ سٹاک",
      "رول ذمہ داریاں"
    ],
    responses: {
      team: {
        en: "Team overview: 4 active agents. Faizan leads with 12 cases this month. All agents are currently online. Total cases: 45 active.",
        ur: "ٹیم کا جائزہ: 4 فعال ایجنٹس۔ فیضان اس ماہ 12 کیسز کے ساتھ آگے ہیں۔ تمام ایجنٹس فی الوقت آن لائن ہیں۔ کل کیسز: 45 فعال۔"
      },
      stats: {
        en: "System statistics: 45 active cases, 12 pending approvals, 8 overdue payments. Revenue this month: 2.4 million rupees. Overall health score: 92 percent.",
        ur: "سسٹم کے اعداد و شمار: 45 فعال کیسز، 12 زیر التواء منظوریاں، 8 واجب الادا ادائیگیاں۔ اس ماہ آمدنی: 24 لاکھ روپے۔ مجموعی صحت کا اسکور: 92 فیصد۔"
      },
      approvals: {
        en: "You have 12 pending approvals. 5 payment confirmations, 4 document verifications, 3 case stage advances. 2 cases are overdue more than 48 hours.",
        ur: "آپ کے پاس 12 زیر التواء منظوریاں ہیں۔ 5 ادائیگی کی تصدیقات، 4 دستاویزات کی تصدیق، 3 کیس مرحلہ پیش رفت۔ 2 کیسز 48 گھنٹے سے زیادہ تاخیر ہیں۔"
      },
      financials: {
        en: "Financial summary for this month: Total revenue 2.4 million rupees. Pending payments: 450 thousand rupees. Commission paid: 180 thousand rupees. Growth: 15 percent compared to last month.",
        ur: "اس ماہ کا مالیاتی خلاصہ: کل آمدنی 24 لاکھ روپے۔ باقی ادائیگیاں: 4 لاکھ 50 ہزار روپے۔ کمیشن ادا: 1 لاکھ 80 ہزار روپے۔ ترقی: گزشتہ ماہ کے مقابلے میں 15 فیصد۔"
      },
      performance: {
        en: "Agent performance: Number 1 - Faizan, 12 cases, 95 percent success. Number 2 - Imran, 10 cases, 90 percent success. Number 3 - Safeer, 8 cases, 88 percent success.",
        ur: "ایجنٹ کی کارکردگی: نمبر 1 - فیضان، 12 کیسز، 95 فیصد کامیابی۔ نمبر 2 - عمران، 10 کیسز، 90 فیصد کامیابی۔ نمبر 3 - صفیر، 8 کیسز، 88 فیصد کامیابی۔"
      },
      visaProcess: {
        en: "Complete 12 stage visa process: Stage 1 Lead Generation via chatbot. Stage 2 Office Visit. Stage 3 Document Collection. Stage 4 Medical and GAMCA. Stage 5 E-Number. Stage 6 Payment of 2 lakh. Stage 7 Case Registration. Stage 8 Vendor Payment. Stage 9 Visa Approval. Stage 10 Protector. Stage 11 Ticket Booking. Stage 12 Departure. Alhamdulillah!",
        ur: "مکمل 12 مراحل ویزا پراسیس: مرحلہ 1 چیٹ بوٹ سے لیڈ جنریشن۔ مرحلہ 2 آفس وزٹ۔ مرحلہ 3 دستاویزات جمع۔ مرحلہ 4 میڈیکل اور گامکا۔ مرحلہ 5 ای نمبر۔ مرحلہ 6 ادائیگی 2 لاکھ۔ مرحلہ 7 کیس رجسٹریشن۔ مرحلہ 8 وینڈر ادائیگی۔ مرحلہ 9 ویزا منظوری۔ مرحلہ 10 پروٹیکٹر۔ مرحلہ 11 ٹکٹ بکنگ۔ مرحلہ 12 روانگی۔ الحمداللہ!"
      },
      businessRules: {
        en: "Key business rules: Rule 1, no document can be missing or embassy rejects visa. Rule 2, owner confirmation required for every payment entry. Rule 3, dual entry system in computer CRM and manual register. Rule 4, passport stock at Imran's house tracked. Rule 5, medical result within 36 hours. Rule 6, protector appointment at 8 AM sharp. Rule 7, video statement mandatory before departure. Rule 8, sales rep target 5 mature clients per day.",
        ur: "اہم کاروباری اصول: اصول 1، ایک بھی دستاویز غائب تو ایمبیسی ویزا نہیں دے گی۔ اصول 2، ہر ادائیگی اندراج کے لیے مالک کی تصدیق لازمی۔ اصول 3، ڈبل انٹری سسٹم کمپیوٹر CRM اور مینول رجسٹر دونوں میں۔ اصول 4، پاسپورٹ سٹاک عمران کے گھر ٹریک شدہ۔ اصول 5، میڈیکل نتیجہ 36 گھنٹے کے اندر۔ اصول 6، پروٹیکٹر اپائنٹمنٹ صبح 8 بجے۔ اصول 7، روانگی سے پہلے ویڈیو اسٹیٹمنٹ لازمی۔ اصول 8، سیلز ریپ ٹارگٹ روزانہ 5 میچور کلائنٹس۔"
      },
      leadGeneration: {
        en: "Lead generation process: Client contacts through Facebook post. Chatbot automatically filters non-serious clients and collects basic information. Sales representative target is 5 mature clients per day. As clients mature, representative invites them to office and closes deals. Chatbot saves time by handling initial screening.",
        ur: "لیڈ جنریشن کا عمل: کلائنٹ فیس بک پوسٹ پڑھ کر رابطہ کرتا ہے۔ چیٹ بوٹ خود ہی غیر سنجیدہ کلائنٹس فلٹر کر دیتی ہے اور مکمل بنیادی معلومات لے لیتی ہے۔ سیلز ریپریزنٹیٹو کا ٹارگٹ روزانہ 5 کلائنٹ میچور ہونے چاہیے۔ جیسے جیسے کلائنٹس میچور ہوں آفس بلائیں اور ڈیل کلوز کریں۔"
      },
      medicalProcess: {
        en: "Medical process: GAMCA medical token costs 4500 rupees, client pays us and we book online. Medical center fee is 25000 to 35000 rupees, client pays directly. Guide client via WhatsApp with lab address and route. Client brings passport copy and photos. Result comes within 36 hours. If unfit, case is cancelled and passport returned. If fit, visa processing starts immediately. After medical, passport goes to stock at Imran's house.",
        ur: "میڈیکل کا عمل: گامکا میڈیکل ٹوکن کی قیمت 4500 روپے ہے جو کلائنٹ ہمیں دیتا ہے اور ہم آن لائن بک کرواتے ہیں۔ میڈیکل سینٹر کی فیس 25000 سے 35000 روپے ہے جو کلائنٹ براہ راست ادا کرتا ہے۔ کلائنٹ کو واٹس ایپ پر لیب کا ایڈریس اور راستہ گائیڈ کریں۔ 36 گھنٹوں میں رزلٹ آتا ہے۔ اگر انفٹ تو کیس کینسل اور پاسپورٹ واپسی۔ اگر فٹ تو ویزا پراسیسنگ فوراً شروع۔ میڈیکل کے بعد پاسپورٹ سٹاک عمران کے گھر بھجوائیں۔"
      },
      protectorProcess: {
        en: "Protector process: Collect nominee details and account number from client, save and send to owner. Owner gets protector paper from vendor. Send client to protector office at 8 AM sharp. Client gets stamp, submits original paper plus 200 rupee guarantee stamp at office. Get client signature and thumbprint. Scan paper and give to owner. Owner sends to vendor who completes protector online.",
        ur: "پروٹیکٹر کا عمل: کلائنٹ سے نومینی کی تفصیلات اور اکاؤنٹ نمبر لیں، سیو کریں اور مالک کو سینڈ کریں۔ مالک وینڈر سے پروٹیکٹر پیپر نکلوا کر دیتا ہے۔ کلائنٹ کو صبح 8 بجے پروٹیکٹر آفس بھجوائیں۔ کلائنٹ سٹمپ لگوائے، اوریجنل پیپر اور 200 روپے گارنٹی اسٹامپ آفس جمع کروائے۔ سائن اور انگوٹھا لگوائیں۔ پیپر سکین کر کے مالک کو دیں۔ مالک وینڈر کو بھیجے جو آن لائن پروٹیکٹر کر دے۔"
      },
      passportStock: {
        en: "Passport stock management: Location is Imran's house for secure storage. Passports received after medical are sent to stock. Retrieved when E-Number is issued before client's next visit. Computer operator requests from stock as needed. All movements tracked in system. Never leave passports untracked.",
        ur: "پاسپورٹ سٹاک کا انتظام: مقام عمران کے گھر محفوظ ذخیرہ ہے۔ میڈیکل کے بعد پاسپورٹ سٹاک میں بھجوائیں۔ ای نمبر جاری ہونے پر کلائنٹ آنے سے پہلے منگوائیں۔ کمپیوٹر آپریٹر ضرورت کے مطابق سٹاک سے طلب کرے۔ تمام نقل و حرکت سسٹم میں ٹریک ہو۔ پاسپورٹ کبھی بے نشان نہ چھوڑیں۔"
      },
      roleResponsibilities: {
        en: "Role responsibilities: Sales representative handles lead qualification, WhatsApp follow-up, office visit scheduling, target 5 mature clients per day. Computer operator handles document scanning, PDF preparation, CRM plus manual register entry, payment logging with owner confirmation. Owner handles payment confirmations, vendor communication, E-Number visa protector handling, and final approvals. Expert or main person handles client consultation, answering questions professionally, and closing deals.",
        ur: "رول ذمہ داریاں: سیلز ریپریزنٹیٹو لیڈ کوالیفکیشن، واٹس ایپ فالو اپ، آفس وزٹ شیڈولنگ، ٹارگٹ روزانہ 5 میچور کلائنٹس۔ کمپیوٹر آپریٹر دستاویزات سکیننگ، PDF تیاری، CRM اور مینول رجسٹر میں اندراج، ادائیگی لاگنگ مالک کی تصدیق سے۔ مالک سر عاطف یا وسی ادائیگی کی تصدیقات، وینڈر سے بات چیت، ای نمبر ویزا پروٹیکٹر ہینڈلنگ، اور فائنل منظوریاں۔ ایکسپرٹ شخص کلائنٹ مشاورت، سوالات کا پیشہ ورانہ جواب، اور ڈیل کلوز کرنا۔"
      },
      login: {
        en: "Login guide: Agents enter their 6 digit access code from WhatsApp and click Activate Session. Valid for 6 hours. Admin goes to admin login with email and password. Session expired? Request new code via WhatsApp or call Admin at zero three one eight six nine eight six two five nine.",
        ur: "لاگ ان گائیڈ: ایجنٹ اپنا 6 ہندسوں کا ایکسیس کوڈ واٹس ایپ سے درج کریں اور ایکٹیویٹ سیشن دبائیں۔ 6 گھنٹے فعال رہتا ہے۔ ایڈمن ای میل اور پاس ورڈ سے لاگ ان کرے۔ سیشن ختم؟ واٹس ایپ سے نیا کوڈ مانگیں یا ایڈمن کو کال کریں۔"
      },
      dashboard: {
        en: "Dashboard shows Today's Tasks widget at the top. It includes follow-ups, document uploads, payment reminders, and appointments. Click any task to open the related case. Priority order: red for overdue, yellow for due today, blue for upcoming.",
        ur: "ڈیش بورڈ اوپر آج کے کام کا ویجٹ دکھاتا ہے۔ اس میں فالو اپس، دستاویز اپ لوڈز، ادائیگی یاد دہانیاں، اور اپائنٹمنٹس شامل ہیں۔ کام پر کلک کریں تو متعلقہ کیس کھل جائے گا۔ سرخ تاخیر والے، پیلا آج واجب، نیلا آنے والے۔"
      },
      searchClient: {
        en: "To find a client, use the search bar in top navigation. Type client name, phone number, case ID, or passport number. Results appear instantly. You can also go to Cases then All Cases and apply filters by status, country, agent, or date range.",
        ur: "کلائنٹ ڈھونڈنے کے لیے ٹاپ نیویگیشن میں سرچ بار استعمال کریں۔ نام، فون نمبر، کیس آئی ڈی، یا پاسپورٹ نمبر ٹائپ کریں۔ نتائج فوراً ظاہر ہوں گے۔ آپ Cases پھر All Cases جا کر فلٹرز بھی لگا سکتے ہیں۔"
      },
      companyInfo: {
        en: "Registered Office Address, City Name. Contact zero three one eight six nine eight six two five nine. Email info at example dot com. Licensed recruitment agency for Gulf countries.",
        ur: "رجسٹرڈ آفس، سٹی نیم۔ رابطہ صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو۔ ای میل info@example.com۔ خلیجی ممالک کے لیے لائسنس یافتہ ریکروٹمنٹ ایجنسی۔"
      },
      troubleshoot: {
        en: "If system is not working: Step 1, refresh the page with F5. Step 2, check internet connection. Step 3, clear browser cache. Step 4, try mobile app. If still broken, take screenshot, note what you were doing, and contact Admin immediately at zero three one eight six nine eight six two five nine.",
        ur: "اگر سسٹم کام نہیں کر رہا: مرحلہ 1، F5 سے پیج ریفریش کریں۔ مرحلہ 2، انٹرنیٹ چیک کریں۔ مرحلہ 3، براؤزر کیشے صاف کریں۔ مرحلہ 4، موبائل ایپ آزمائیں۔ پھر بھی خراب ہو تو اسکرین شاٹ لیں اور فوراً ایڈمن سے رابطہ کریں۔"
      },
      escalation: {
        en: "Emergency escalation: For system bugs, take screenshot and contact Admin at zero three one eight six nine eight six two five nine. For payment disputes, owner confirmation is required, contact Admin immediately. For lost documents, log in activity log, notify Admin, and initiate recovery. For angry clients, use de-escalation script and offer Expert call.",
        ur: "ایمرجنسی ایسکلیشن: سسٹم بگ کے لیے اسکرین شاٹ لیں اور ایڈمن سے رابطہ کریں۔ ادائیگی تنازعہ میں مالک کی تصدیق لازمی ہے، فوراً ایڈمن سے رابطہ۔ دستاویز گم ہونے پر لاگ کریں، ایڈمن کو مطلع کریں، ریکوری شروع کریں۔ ناراض کلائنٹ کے لیے ڈی ایسکلیشن اور ایکسپرٹ کال۔"
      },
      caseCreate: {
        en: "To create a new case: Click plus New Case button on Dashboard or Cases page. Fill the 6 step form: customer info, job details, emergency contact, documents checklist, payment info, then review and submit. The case is auto-assigned to the logged-in agent. Star marked fields are mandatory.",
        ur: "نیا کیس بنانے کے لیے: ڈیش بورڈ یا کیسز پیج پر نیا کیس بٹن ��ر کلک کریں۔ 6 مرحلے کا فارم بھریں: کلائنٹ معلومات، جاب تفصیلات، ایمرجنسی رابطہ، دستاویزات چیک لسٹ، ادائیگی معلومات، پھر جائزہ لیں اور جمع کروائیں۔ کیس خودکار لاگ ان ایجنٹ کو اسائن ہوتا ہے۔"
      },
      default: {
        en: "I can help you check team overview, system statistics, pending approvals, financial summary, agent performance, visa process stages, business rules, medical process, protector process, passport stock, role responsibilities, login help, search clients, troubleshooting, or emergency escalation. What would you like to know?",
        ur: "میں آپ کی ٹیم کا جائزہ، سسٹم کے اعداد و شمار، زیر التواء منظوریاں، مالیاتی خلاصہ، ایجنٹ کی کارکردگی، ویزا پراسیس، کاروباری اصول، میڈیکل پراسیس، پروٹیکٹر، پاسپورٹ سٹاک، رول ذمہ داریاں، لاگ ان مدد، کلائنٹ تلاش، مسائل حل، یا ایمرجنسی میں مدد کر سکتا ہوں۔"
      }
    }
  },
  agent: {
    commands: [
      "Show my cases",
      "What's next",
      "Medical process",
      "Send payment reminder",
      "My performance",
      "Visa process stages",
      "Document checklist",
      "Client handling tips",
      "Protector guide",
      "Agreement guide",
      "میرے کیسز دکھائیں",
      "اگلا کیا ہے",
      "میڈیکل کا عمل",
      "ادائیگی کی یاد دہانی بھیجیں",
      "میری کارکردگی",
      "ویزا پراسیس کے مراحل",
      "دستاویزات کی فہرست",
      "کلائنٹ ہینڈلنگ ٹپس",
      "پروٹیکٹر گائیڈ",
      "اقرار نامہ گائیڈ"
    ],
    responses: {
      cases: {
        en: "Your active cases: Ahmed Khan at medical pending stage. Sara Ali at document collection. Usman Tariq at payment confirmation. Total: 8 cases with 2 urgent priorities.",
        ur: "آپ کے فعال کیسز: احمد خان میڈیکل زیر التواء مرحلے پر۔ سارہ علی دستاویزات جمع پر۔ عثمان طارق ادائیگی کی تصدیق پر۔ کل: 8 کیسز جن میں 2 فوری ترجیحات ہیں۔"
      },
      next: {
        en: "Next steps: Number 1, Ahmed Khan - upload medical report, due today. Number 2, Sara Ali - call for passport copy, due tomorrow. Number 3, Usman Tariq - send payment reminder, overdue.",
        ur: "اگلے قدم: نمبر 1، احمد خان - میڈیکل رپورٹ اپلوڈ کریں، آخری تاریخ آج۔ نمبر 2، سارہ علی - پاسپورٹ کاپی کے لیے کال کریں، آخری تاریخ کل۔ نمبر 3، عثمان طارق - ادائیگی کی یاد دہانی بھیجیں، تاخیر۔"
      },
      medical: {
        en: "Medical GAMCA process for agents: Book GAMCA token online, fee 4500 rupees client pays. Guide client via WhatsApp with lab address and route. Client brings passport copy and photos. Medical center fee 25000 to 35000 rupees client pays directly. Result in 36 hours. After medical, collect passport and receipt. Receipt goes in file, passport to stock at Imran's house. If unfit, case cancel. If fit, start visa processing immediately.",
        ur: "ایجنٹ کے لیے میڈیکل گامکا پراسیس: گامکا ٹوکن آن لائن بک کروائیں، فیس 4500 روپے کلائنٹ دیتا ہے۔ کلائنٹ کو واٹس ایپ پر لیب کا ایڈریس اور راستہ گائیڈ کریں۔ کلائنٹ پاسپورٹ کی کاپی اور تصاویر ساتھ لے جائے۔ میڈیکل سینٹر فیس 25000 سے 35000 روپے کلائنٹ براہ راست ادا کرے۔ 36 گھنٹوں میں نتیجہ۔ میڈیکل کے بعد پاسپورٹ اور رسید وصول کریں۔ رسید فائل میں، پاسپورٹ سٹاک عمران کے گھر بھجوائیں۔ انفٹ تو کیس کینسل۔ فٹ تو فوراً ویزا پراسیسنگ شروع۔"
      },
      payment: {
        en: "Payment reminder sent to client via WhatsApp. Template: Assalamu Alaikum, this is Emerald Tech Partner. Your payment of amount is pending. Pay via EasyPaisa zero three one eight six nine eight six two five nine, JazzCash, or Bank Transfer. Cash payment gets receipt. Online payment needs screenshot then owner confirmation before entry. Remember, no entry without owner confirmation.",
        ur: "ادائیگی کی یاد دہانی کلائنٹ کو واٹس ایپ سے بھیجیں۔ ٹیمپلیٹ: السلام علیکم، یہ ایمرالڈ ٹیک پارٹنر ہے۔ آپ کی رقم کی ادائیگی باقی ہے۔ ایزی پیسہ صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو، جاز کیش، یا بینک ٹرانسفر سے ادا کریں۔ کیش ادائیگی پر رسید دیں۔ آن لائن ادائیگی پر سکرین شاٹ لیں پھر مالک سے کنفرمیشن پھر اندراج۔ یاد رکھیں، مالک کی تصدیق کے بغیر کوئی اندراج نہیں۔"
      },
      performance: {
        en: "Your performance this month: Cases completed: 12. Success rate: 95 percent. Target: 15 cases. Commission earned: 36 thousand rupees. You are number 1 on the leaderboard.",
        ur: "اس ماہ آپ کی کارکردگی: مکمل کیسز: 12۔ کامیابی کی شرح: 95 فیصد۔ ہدف: 15 کیسز۔ کمیشن حاصل: 36 ہزار روپے۔ آپ لیڈر بورڈ پر نمبر 1 ہیں۔"
      },
      visaProcess: {
        en: "Complete 12 stage visa process: Stage 1 Lead Generation. Stage 2 Office Visit. Stage 3 Document Collection. Stage 4 Medical GAMCA. Stage 5 E-Number. Stage 6 Payment 2 lakh. Stage 7 Case Registration in CRM and register. Stage 8 Vendor Payment with owner confirmation. Stage 9 Visa Approval and congratulations. Stage 10 Protector at 8 AM. Stage 11 Ticket booking with video statement. Stage 12 Departure, Alhamdulillah!",
        ur: "مکمل 12 مراحل ویزا پراسیس: مرحلہ 1 لیڈ جنریشن۔ مرحلہ 2 آفس وزٹ۔ مرحلہ 3 دستاویزات جمع۔ مرحلہ 4 میڈیکل گامکا۔ مرحلہ 5 ای نمبر۔ مرحلہ 6 ادائیگی 2 لاکھ۔ مرحلہ 7 کیس رجسٹریشن CRM اور رجسٹر میں۔ مرحلہ 8 وینڈر ادائیگی مالک کی تصدیق سے۔ مرحلہ 9 ویزا منظوری اور مبارکباد۔ مرحلہ 10 پروٹیکٹر صبح 8 بجے۔ مرحلہ 11 ٹکٹ بکنگ ویڈیو اسٹیٹمنٹ کے ساتھ۔ مرحلہ 12 روانگی، الحمداللہ!"
      },
      documents: {
        en: "Complete document checklist: Passport valid 6 plus months all pages scanned. CNIC copy front and back. 4 passport size photos plus full body photo. FRC Family Registration Certificate original. PCC Police Clearance Certificate original. 2 biometric slips original. Medical report original. License if driver or operator original. Warning: all originals required, one missing means embassy rejects visa. Scan everything and save with client name and date.",
        ur: "مکمل دستاویزات کی فہرست: پاسپورٹ 6 ماہ سے زیادہ درست تمام صفحات سکین۔ شناختی کارڈ کی کاپی آگے اور پیچھے۔ 4 پاسپورٹ سائز تصاویر اور فل باڈی پکچر۔ FRC فیملی رجسٹریشن سرٹیفکیٹ اصل۔ PCC پولیس کلیئرنس سرٹیفکیٹ اصل۔ بائیومیٹرک کی 2 سلپس اصل۔ میڈیکل رپورٹ اصل۔ لائسنس اگر ڈرائیور یا آپریٹرز ہو اصل۔ انتباہ: تمام اصل لازمی، ایک بھی مس تو ایمبیسی ریجیکٹ۔ سب سکین کریں اور کلائنٹ کا نام اور تاریخ کے ساتھ محفوظ کریں۔"
      },
      clientHandling: {
        en: "Client handling tips: First impression matters, office cleanliness and staff discipline. Client checks if other clients are present for trust building. Expert person must answer every question confidently, leave client impressed. Professional paperwork and bio-data forms. Guide via WhatsApp. Daily target 5 mature clients for sales rep. Close deals same day. Make client feel this is a professional organization.",
        ur: "کلائنٹ ہینڈلنگ ٹپس: جب کلائنٹ آفس آتا ہے تو سب سے پہلے صفائی دیکھتا ہے، سٹاف کی آبزرویشن کرتا ہے۔ اپنے علاوہ بھی کلائنٹس دیکھنا چاہتا ہے۔ ایکسپرٹ شخص ہر سوال کا مؤثر جواب دے، کلائنٹ کو لاجواب کر دے۔ پیپر ورک پروفیشنل انداز سے۔ واٹس ایپ پر گائیڈ کریں۔ روزانہ ٹارگٹ 5 میچور کلائنٹس۔ جیسے میچور ہوں ڈیل کلوز کریں۔ کلائنٹ کو محسوس کروائیں یہ ایک پیشہ ور ادارہ ہے۔"
      },
      protectorGuide: {
        en: "Protector process for agents: Collect nominee name and account number from client. Save details and send to owner. Owner provides protector paper from vendor. Send client to protector office at 8 AM. Client gets stamp, submits original paper plus 200 rupee stamp. Get signature and thumbprint. Scan and give to owner. Vendor completes online. Always schedule at 8 AM sharp.",
        ur: "ایجنٹ کے لیے پروٹیکٹر گائیڈ: کلائنٹ سے نومینی کا نام اور اکاؤنٹ نمبر لیں۔ تفصیلات سیو کریں اور مالک کو بھیجیں۔ مالک وینڈر سے پروٹیکٹر پیپر دے گا۔ کلائنٹ کو صبح 8 بجے پروٹیکٹر آفس بھجوائیں۔ سٹمپ لگوائے، اوریجنل پیپر اور 200 روپے اسٹامپ جمع کروائے۔ سائن اور انگوٹھا لگوائیں۔ سکین کر کے مالک کو دیں۔ وینڈر آن لائن مکمل کرے۔ ہمیشہ صبح 8 بجے شیڈول کریں۔"
      },
      agreementGuide: {
        en: "Agreement guide: The retainer agreement is between client and Emerald Tech Partners. It is a written agreement that primarily benefits the client. Must be signed before starting any process. Ensures transparency and protects both parties. Keep signed copy in client file. Never skip the agreement step.",
        ur: "اقرار نامہ گائیڈ: اقرار نامہ کلائنٹ اور ایمرالڈ ٹیک پارٹنر کنسلٹنسی سروسیز کے مابین ایک تحریری معاہدہ ہے۔ اس کا زیادہ فائدہ کلائنٹ کو ہے۔ کوئی بھی عمل شروع کرنے سے پہلے سائن کروائیں۔ شفافیت یقینی بناتا ہے اور دونوں فریقوں کی حفاظت کرتا ہے۔ سائن شدہ کاپی فائل میں رکھیں۔ اقرار نامے کا مرحلہ کبھی نہ چھوڑیں۔"
      },
      login: {
        en: "Agent login: Open CRM login page. Enter your 6 digit access code from WhatsApp. Click Activate Session. Session valid for 6 hours, then auto-logout. Code not received? Call Admin at zero three one eight six nine eight six two five nine.",
        ur: "ایجنٹ لاگ ان: CRM لاگ ان پیج کھولیں۔ واٹس ایپ سے ملا 6 ہندسوں کا ایکسیس کوڈ درج کریں۔ ایکٹیویٹ سیشن دبائیں۔ سیشن 6 گھنٹے فعال رہتا ہے۔ کوڈ نہیں ملا؟ ایڈمن کو کال کریں۔"
      },
      dashboard: {
        en: "Your dashboard shows Today's Tasks widget. Includes follow-ups, document uploads, payment reminders, and appointments. Click any task to open the case. Start with overdue items first.",
        ur: "آپ کا ڈیش بورڈ آج کے کام دکھاتا ہے۔ فالو اپس، اپ لوڈز، ادائیگی یاد دہانیاں اور اپائنٹمنٹس شامل ہیں۔ کام پر کلک کریں تو کیس کھلے گا۔ پہلے تاخیر والے آئٹمز سے شروع کریں۔"
      },
      companyInfo: {
        en: "Registered Office Address, City Name. Contact zero three one eight six nine eight six two five nine.",
        ur: "ایمرالڈ ٹیک پارٹنر کنسلٹنسی سروس۔ آفس 25، فیصل شاپنگ مال، صدر، لاہور۔ رابطہ صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو۔"
      },
      troubleshoot: {
        en: "Quick fixes: Refresh page with F5, check internet, clear cache, try mobile. Still broken? Call Admin at zero three one eight six nine eight six two five nine.",
        ur: "فوری حل: F5 سے ریفریش، انٹرنیٹ چیک، کیشے صاف، موبائل آزمائیں۔ پھر بھی خراب؟ ایڈمن کو کال کریں۔"
      },
      escalation: {
        en: "Emergency: Bug, take screenshot and call Admin. Payment dispute, owner confirmation required. Document lost, log and notify Admin. Angry client, use de-escalation script. Contact zero three one eight six nine eight six two five nine.",
        ur: "ایمرجنسی: بگ ہو تو اسکرین شاٹ لیں اور ایڈمن کو کال کریں۔ ادائیگی تنازعہ میں مالک تصدیق لازمی۔ دستاویز گم تو لاگ اور ایڈمن مطلع کریں۔ ناراض کلائنٹ کے لیے ڈی ایسکلیشن۔"
      },
      default: {
        en: "I can help you view your cases, check next steps, explain medical process, send payment reminders, track performance, visa process stages, document checklist, client handling tips, protector guide, agreement guide, login help, or troubleshooting. What do you need?",
        ur: "میں آپ کے کیسز دیکھنے، اگلے قدم، میڈیکل پراسیس، ادائیگی یاد دہانی، کارکردگی، ویزا پراسیس، دستاویزات فہرست، کلائنٹ ہینڈلنگ، پروٹیکٹر گائیڈ، اقرار نامہ، لاگ ان مدد، یا مسائل حل میں مدد کر سکتا ہوں۔"
      }
    }
  },
  customer: {
    commands: [
      "Check my status",
      "Document requirements",
      "Payment details",
      "Medical appointment",
      "Contact agent",
      "Visa journey stages",
      "Protector information",
      "Agreement details",
      "میری حیثیت چیک کریں",
      "دستاویزات کی ضروریات",
      "ادائیگی کی تفصیلات",
      "میڈیکل اپائنٹمنٹ",
      "ایجنٹ سے رابطہ",
      "ویزا سفر کے مراحل",
      "پروٹیکٹر کی معلومات",
      "معاہدے کی تفصیلات"
    ],
    responses: {
      status: {
        en: "Your case status: Current stage - Medical Examination. Completed stages: Document Collection and Payment. Next step: Upload medical result. Progress: 60 percent. Estimated completion: 15 days.",
        ur: "آپ کے کیس کی حیثیت: موجودہ مرحلہ - میڈیکل معائنہ۔ مکمل مراحل: دستاویزات جمع اور ادائیگی۔ اگلا قدم: میڈیکل نتیجہ اپلوڈ کریں۔ پیش رفت: 60 فیصد۔ تخمینی تکمیل: 15 دن۔"
      },
      documents: {
        en: "Your documents: Passport verified. CNIC verified. Photos verified. Medical Report pending. At payment stage you need all originals: old and new passport, CNIC, photos, FRC, PCC, 2 biometric slips, medical report, and license if driver or operator. All originals needed, contact zero three one eight six nine eight six two five nine.",
        ur: "آپ کی دستاویزات: پاسپورٹ تصدیق شدہ۔ شناختی کارڈ تصدیق شدہ۔ تصاویر تصدیق شدہ۔ میڈیکل رپورٹ زیر التواء۔ ادائیگی کے مرحلے پر تمام اصل دستاویزات درکار: پرانا اور نیا پاسپورٹ، شناختی کارڈ، تصاویر، FRC، PCC، بائیومیٹرک کی 2 سلپس، میڈیکل رپورٹ، اور لائسنس اگر ڈرائیور ہو۔ تمام اصل لازمی، رابطہ صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو۔"
      },
      payment: {
        en: "Payment information: Pay via cash with receipt, EasyPaisa zero three one eight six nine eight six two five nine, JazzCash, or bank transfer. Fee structure: Medical token 4500 rupees, medical center 25000 to 35000 rupees, visa processing as per agreement, protector stamp 200 rupees. Contact for queries: zero three one eight six nine eight six two five nine.",
        ur: "ادائیگی کی معلومات: کیش سے ادا کریں رسید کے ساتھ، ایزی پیسہ صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو، جاز کیش، یا بینک ٹرانسفر۔ فیس کی تفصیل: میڈیکل ٹوکن 4500 روپے، میڈیکل سینٹر 25000 سے 35000 روپے، ویزا پراسیسنگ معاہدے کے مطابق، پروٹیکٹر اسٹامپ 200 روپے۔ سوالات کے لیے رابطہ: صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو۔"
      },
      medical: {
        en: "Medical examination guide: Your agent will book GAMCA token. Token fee 4500 rupees pay at office. Medical center fee 25000 to 35000 rupees pay at center. Bring original passport, passport copy, photos, and token receipt. Result within 36 hours. If fit, visa processing starts. Centers available in Lahore, Islamabad, Karachi. Contact zero three one eight six nine eight six two five nine.",
        ur: "میڈیکل معائنہ گائیڈ: آپ کا ایجنٹ گامکا ٹوکن بک کرے گا۔ ٹوکن فیس 4500 روپے آفس میں ادا کریں۔ میڈیکل سینٹر فیس 25000 سے 35000 روپے سینٹر میں ادا کریں۔ ساتھ لائیں اصل پاسپورٹ، پاسپورٹ کی کاپی، تصاویر، اور ٹوکن رسید۔ 36 گھنٹوں میں نتیجہ۔ فٹ ہو تو ویزا پراسیسنگ شروع۔ سینٹرز لاہور، اسلام آباد، کراچی۔ رابطہ صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو۔"
      },
      contact: {
        en: "Connecting you to your agent. You can also call directly at zero three one eight six nine eight six two five nine. Average response time is 2 minutes.",
        ur: "آپ کو آپ کے ایجنٹ سے ملا رہا ہوں۔ آپ براہ راست کال بھی کر سکتے ہیں صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو۔ اوسط جوابی وقت 2 منٹ ہے۔"
      },
      visaStages: {
        en: "Your visa journey has 12 stages: Stages 1 to 3 completed - initial contact, office visit, document collection. Stage 4 current - medical examination. Stages 5 to 12 remaining - E-Number, biometric and payment, case registration, visa processing, visa approval, protector, ticket booking, and departure. Each stage tracked in real-time. You are at 60 percent progress.",
        ur: "آپ کے ویزا سفر کے 12 مراحل ہیں: مرحلہ 1 سے 3 مکمل - ابتدائی رابطہ، آفس وزٹ، دستاویزات جمع۔ مرحلہ 4 موجودہ - میڈیکل معائنہ۔ مرحلہ 5 سے 12 باقی - ای نمبر، بائیومیٹرک اور ادائیگی، کیس رجسٹریشن، ویزا پراسیسنگ، ویزا منظوری، پروٹیکٹر، ٹکٹ بکنگ، اور روانگی۔ ہر مرحلہ ریئل ٹائم ٹریک ہوتا ہے۔ آپ 60 فیصد پیش رفت پر ہیں۔"
      },
      protector: {
        en: "Protector process information: After visa approval you will need a nominee name and any bank account number. You visit protector office at 8 AM, get stamp on paper, submit original plus 200 rupee stamp at our office, sign and thumbprint. We handle the rest online. Questions? Call zero three one eight six nine eight six two five nine.",
        ur: "پروٹیکٹر کی معلومات: ویزا منظوری کے بعد آپ کو ایک نومینی کا نام اور کوئی بینک اکاؤنٹ نمبر چاہیے۔ صبح 8 بجے پروٹیکٹر آفس جائیں، پیپر پر سٹمپ لگوائیں، اوریجنل پیپر اور 200 روپے اسٹامپ ہمارے آفس جمع کروائیں، سائن اور انگوٹھا لگائیں۔ باقی کام ہم آن لائن کر دیں گے۔ سوالات؟ کال کریں صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو۔"
      },
      agreement: {
        en: "Agreement information: The retainer agreement is between you and Emerald Tech Partners. It is primarily for your benefit. It outlines services, fees, and responsibilities. Protects your rights as a client. Must be signed before process starts. You can request a copy anytime.",
        ur: "معاہدے کی معلومات: اقرار نامہ آپ اور ایمرالڈ ٹیک پارٹنر کنسلٹنسی سروسیز کے مابین ہے۔ اس کا زیادہ فائدہ آپ کو ہے۔ خدمات، فیس اور ذمہ داریاں واضح کرتا ہے۔ بطور کلائنٹ آپ کے حقوق کی حفاظت کرتا ہے۔ عمل شروع سے پہلے سائن ہونا ضروری ہے۔ آپ کسی بھی وقت کاپی کی درخواست کر سکتے ہیں۔"
      },
      login: {
        en: "Customer portal access: Your visa journey is tracked through our portal. Contact your agent at zero three one eight six nine eight six two five nine for access. WhatsApp updates are sent automatically at each stage.",
        ur: "کسٹمر پورٹل: آپ کا ویزا سفر ہمارے پورٹل سے ٹریک ہوتا ہے۔ رسائی کے لیے ایجنٹ سے رابطہ کریں صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو۔ ہر مرحلے پر واٹس ایپ اپ ڈیٹ خودکار بھیجی جاتی ہے۔"
      },
      companyInfo: {
        en: "Registered Office Address, City Name. We help Pakistani workers get jobs in Gulf countries including Saudi Arabia, UAE, Qatar, Kuwait and Oman. Contact zero three one eight six nine eight six two five nine.",
        ur: "ایمرالڈ ٹیک پارٹنر کنسلٹنسی سروس۔ آفس 25، فیصل شاپنگ مال، صدر، لاہور۔ ہم پاکستانی کارکنوں کو خلیجی ممالک سعودی عرب، یو اے ای، قطر، کویت اور عمان میں ملازمت دلاتے ہیں۔ رابطہ صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو۔"
      },
      troubleshoot: {
        en: "Having problems? Refresh your page, check internet, or try on mobile. If still having issues, call us at zero three one eight six nine eight six two five nine or email info at emeraldvisaconsultancy dot com.",
        ur: "مسئلہ ہے؟ پیج ریفریش کریں، انٹرنیٹ چیک کریں، یا موبائل پر آزمائیں۔ پھر بھی مسئلہ ہو تو ہمیں کال کریں صفر تین ایک آٹھ چھ نو آٹھ چھ دو پانچ نو یا ای میل کریں۔"
      },
      default: {
        en: "I can help you check your case status, view document requirements, check payment details, get medical information, contact your agent, track your 12-stage visa journey, protector process, agreement details, company info, or troubleshooting. How can I assist you?",
        ur: "میں آپ کے کیس کی حیثیت، دستاویزات، ادائیگی تفصیلات، میڈیکل معلومات، ایجنٹ رابطہ، 12 مراحل ویزا سفر، پروٹیکٹر، معاہدہ، کمپنی معلومات، یا مسائل حل میں مدد کر سکتا ہوں۔ میں کیسے مدد کروں؟"
      }
    }
  }
};

// Map NLP intent keys to VOICE_COMMANDS response keys (they differ per role)
function mapVoiceIntentKey(intentKey: string, role: string): string {
  const mappings: Record<string, Record<string, string>> = {
    admin: {
      approval: "approvals",
      // Shared intents map directly for admin
    },
    agent: {
      medicalProcess: "medical",
      protectorProcess: "protectorGuide",
      documents: "documents",
      // Shared intents map directly for agent
    },
    customer: {
      medicalProcess: "medical",
      protectorProcess: "protector",
      // Shared intents map directly for customer
    },
  };
  return mappings[role]?.[intentKey] || intentKey;
}

// Smart voice response using NLP engine
function getSmartVoiceResponse(input: string, role: UserRole, context: ConversationContext): { text: string; lang: "en" | "ur"; updatedContext: ConversationContext; isFallback?: boolean } {
  const effectiveRole = role === "master_admin" ? "admin" : role;
  const nlpResult = processMessage(input, effectiveRole as UserRole, context);
  const lang = nlpResult.language;
  const responses = VOICE_COMMANDS[effectiveRole as "admin" | "agent" | "customer"].responses;
  
  const updatedContext: ConversationContext = {
    ...context,
    messageCount: context.messageCount + 1,
    language: lang,
  };

  if (nlpResult.isGreeting) {
    return { text: getGreetingResponse(role, lang), lang, updatedContext };
  }

  const rawIntentKey = nlpResult.primaryIntent;
  const intentKey = rawIntentKey ? mapVoiceIntentKey(rawIntentKey, effectiveRole) : null;
  if (intentKey && (responses as any)[intentKey]) {
    const responseData = (responses as any)[intentKey];
    updatedContext.lastIntent = rawIntentKey;
    updatedContext.lastTopics = [rawIntentKey!];
    // Voice responses have { en, ur } format
    return { text: responseData[lang] || responseData.en, lang, updatedContext };
  }

  // Fallback
  const defaultResp = responses.default;
  return { text: defaultResp[lang] || defaultResp.en, lang, updatedContext, isFallback: true };
}

export function RoleBasedVoiceAssistant({ role }: RoleBasedVoiceAssistantProps) {
  const { isUrdu, fontClass } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [waveformValues, setWaveformValues] = useState<number[]>(Array(20).fill(0.1));
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const animFrameRef = useRef<number>();
  const voiceContextRef = useRef<ConversationContext>(createContext());
  const recognitionRef = useRef<any>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const effectiveRole = (role === "master_admin" ? "admin" : role) as "admin" | "agent" | "customer";

  const roleIcon = role === "master_admin" ? <Crown className="w-3 h-3" /> : role === "admin" ? <Shield className="w-3 h-3" /> : role === "agent" ? <Briefcase className="w-3 h-3" /> : <Bot className="w-3 h-3" />;
  const roleColor = role === "master_admin" ? "from-purple-600 to-amber-500" : role === "admin" ? "from-blue-500 to-indigo-600" : role === "agent" ? "from-emerald-500 to-teal-600" : "from-purple-500 to-pink-600";
  const roleLabel = role === "master_admin" ? (isUrdu ? "ماسٹر ایڈمن" : "Master Admin") : role === "admin" ? (isUrdu ? "ایڈمن" : "Admin") : role === "agent" ? (isUrdu ? "ایجنٹ" : "Agent") : (isUrdu ? "کسٹمر" : "Customer");

  // Check Web Speech API support
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // Animate waveform
  useEffect(() => {
    if (!isListening) {
      setWaveformValues(Array(20).fill(0.1));
      return;
    }
    const animate = () => {
      setWaveformValues(prev => prev.map(() => Math.random() * 0.7 + 0.3));
      animFrameRef.current = requestAnimationFrame(animate);
    };
    const interval = setInterval(() => {
      animFrameRef.current = requestAnimationFrame(animate);
    }, 100);
    return () => {
      clearInterval(interval);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isListening]);

  // Text-to-speech for responses
  const speakResponse = (text: string, lang: "en" | "ur") => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    // Strip emojis and formatting for cleaner speech
    const cleanText = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}•\*\n#]+/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === "ur" ? "ur-PK" : "en-US";
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      // Fallback: show text input
      setShowTextInput(true);
      setTimeout(() => textInputRef.current?.focus(), 100);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = isUrdu ? 'ur-PK' : 'en-US';
      recognition.maxAlternatives = 3;
      
      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("");
        setResponse("");
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        setTranscript(finalTranscript || interimTranscript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setShowTextInput(true);
          setTimeout(() => textInputRef.current?.focus(), 100);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setShowTextInput(true);
      setTimeout(() => textInputRef.current?.focus(), 100);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
  };

  // Process input through SmartNLP first, then Gemini AI fallback with CRM access
  const processVoiceInput = async (inputText: string) => {
    const { text: responseText, lang, updatedContext, isFallback } = getSmartVoiceResponse(inputText, role, voiceContextRef.current);
    voiceContextRef.current = updatedContext;

    if (isFallback) {
      // Try Gemini AI with CRM context for dynamic response
      try {
        const crmCtx = (await buildCRMContext()) + "\n" + CRM_ACTION_INSTRUCTIONS;
        const geminiResult = await callGeminiAI(inputText, role, "ur", [], crmCtx);
        if (geminiResult.success && geminiResult.response) {
          // Parse and execute CRM actions from voice response
          const { actions, cleanText } = parseActions(geminiResult.response);
          let finalText = cleanText;
          if (actions.length > 0) {
            const results = await executeAllActions(actions);
            const actionSummary = results.map(r =>
              r.success ? `\u2705 ${r.message}` : `\u274c ${r.message}`
            ).join("\n");
            finalText = actionSummary + "\n\n" + cleanText;
          }
          setResponse(finalText);
          speakResponse(finalText, "ur");
          return;
        }
      } catch (err) {
      }
    }

    setResponse(responseText);
    speakResponse(responseText, lang);
  };

  const handleTextSubmit = () => {
    const text = textInput.trim();
    if (!text) return;
    setTranscript(text);
    setTextInput("");
    setShowTextInput(false);
    setTimeout(() => processVoiceInput(text), 300);
  };

  // Generate response after transcript using SmartNLP + Gemini AI fallback
  useEffect(() => {
    if (transcript && !isListening) {
      const timeout = setTimeout(() => processVoiceInput(transcript), 500);
      return () => clearTimeout(timeout);
    }
  }, [transcript, isListening, role]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    };
  }, []);

  return (
    <>
      {/* Floating mic button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 ${isUrdu ? "left-4" : "right-4"} z-[150] w-14 h-14 rounded-full
            bg-gradient-to-br ${roleColor} text-white
            shadow-lg shadow-emerald-500/30 flex items-center justify-center`}
        >
          <Mic className="w-6 h-6" />
          <span className={`absolute -top-1 ${isUrdu ? "-right-1" : "-left-1"} w-5 h-5 bg-white rounded-full flex items-center justify-center`}>
            {roleIcon}
          </span>
          {speechSupported && (
            <span className={`absolute -bottom-0.5 ${isUrdu ? "-left-0.5" : "-right-0.5"} w-3 h-3 bg-green-400 rounded-full border-2 border-white`} title="Live Speech Ready" />
          )}
        </motion.button>
      )}

      {/* Voice assistant panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25 }}
            className={`${isUrdu ? fontClass : ""} fixed bottom-6 ${isUrdu ? "left-4" : "right-4"} z-[150]
              w-[calc(100vw-2rem)] max-w-md
              bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
              border border-gray-200 dark:border-gray-700 overflow-hidden`}
          >
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r ${roleColor} text-white`}>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Volume2 className={`w-5 h-5 ${isSpeaking ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <p className="text-sm font-bold flex items-center gap-2">
                    Hey Emerald! {roleIcon}
                  </p>
                  <p className="text-xs text-white/80">
                    {isSpeaking ? (isUrdu ? "بول رہا ہے..." : "Speaking...") : isListening ? (isUrdu ? "سن رہا ہے..." : "Listening...") : (isUrdu ? "آواز اسسٹنٹ" : "Voice Assistant")} {speechSupported ? "🟢" : "⌨️"} • {roleLabel}
                  </p>
                </div>
              </div>
              <button onClick={() => { setIsOpen(false); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 min-h-[140px] max-h-[300px] overflow-y-auto">
              {/* Waveform visualization */}
              {isListening && (
                <div className="flex items-center justify-center gap-0.5 h-16 mb-3">
                  {waveformValues.map((v, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: `${v * 100}%` }}
                      transition={{ duration: 0.1 }}
                      className={`w-1.5 rounded-full bg-gradient-to-t ${roleColor}`}
                      style={{ minHeight: 4 }}
                    />
                  ))}
                </div>
              )}

              {/* Transcript */}
              {transcript && (
                <div className="mb-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-xs text-gray-500 mb-1">{isUrdu ? "آپ نے کہا:" : "You said:"}</p>
                  <p className={`${isUrdu ? "text-right" : ""} text-sm text-gray-800 dark:text-gray-200`}>{transcript}</p>
                </div>
              )}

              {/* Response */}
              {response && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl bg-gradient-to-br ${roleColor} bg-opacity-10 border border-gray-200 dark:border-gray-700`}
                >
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                    <Volume2 className={`w-3 h-3 ${isSpeaking ? 'animate-pulse' : ''}`} />
                    {isUrdu ? "ایمرالڈ:" : "Emerald:"}
                    {isSpeaking && <span className="text-[10px] text-emerald-500">{isUrdu ? "(بول رہا ہے)" : "(speaking)"}</span>}
                  </p>
                  <p className={`${isUrdu ? "text-right" : ""} text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line`}>{response}</p>
                </motion.div>
              )}

              {!isListening && !transcript && !showTextInput && (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-6">
                  {speechSupported
                    ? (isUrdu ? "مائیک پر ٹیپ کریں اور بولیں" : "Tap the mic and speak")
                    : (isUrdu ? "مائیک پر ٹیپ کریں یا ٹائپ کریں" : "Tap mic or type your question")}
                </p>
              )}

              {/* Text input fallback */}
              {showTextInput && (
                <div className="mt-3 flex gap-2">
                  <input
                    ref={textInputRef}
                    type="text"
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleTextSubmit()}
                    placeholder={isUrdu ? "اپنا سوال ٹائپ کریں..." : "Type your question..."}
                    className={`${isUrdu ? "text-right" : ""} flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm border-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-gray-800 dark:text-gray-200`}
                  />
                  <button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim()}
                    className={`px-3 py-2 rounded-lg text-white text-sm font-medium ${textInput.trim() ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                  >
                    {isUrdu ? "بھیجیں" : "Send"}
                  </button>
                </div>
              )}
            </div>

            {/* Quick commands */}
            <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {VOICE_COMMANDS[effectiveRole].commands.slice(0, 4).map(cmd => (
                <button
                  key={cmd}
                  onClick={() => {
                    setTranscript(cmd);
                    setIsListening(false);
                    setShowTextInput(false);
                    setTimeout(() => {
                      const { text, lang, updatedContext } = getSmartVoiceResponse(cmd, role, voiceContextRef.current);
                      voiceContextRef.current = updatedContext;
                      setResponse(text);
                      speakResponse(text, lang);
                    }, 500);
                  }}
                  className={`shrink-0 px-3 py-2 rounded-full text-xs font-medium
                    bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300
                    hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors
                    min-h-[36px] whitespace-nowrap`}
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Mic button + keyboard toggle */}
            <div className="p-4 flex justify-center items-center gap-4">
              <button
                onClick={() => { setShowTextInput(!showTextInput); if (!showTextInput) setTimeout(() => textInputRef.current?.focus(), 100); }}
                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title={isUrdu ? "ٹائپ کریں" : "Type instead"}
              >
                <Keyboard className="w-5 h-5 text-gray-500" />
              </button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={isListening ? stopListening : startListening}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all
                  ${isListening
                    ? "bg-red-500 shadow-red-500/30 animate-pulse"
                    : "bg-gradient-to-br " + roleColor + " shadow-emerald-500/30"
                  }`}
              >
                {isListening ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
              </motion.button>
              {isSpeaking && (
                <button
                  onClick={() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setIsSpeaking(false); }}
                  className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center hover:bg-orange-200 transition-colors"
                  title={isUrdu ? "بولنا بند کریں" : "Stop speaking"}
                >
                  <Volume2 className="w-5 h-5 text-orange-500 animate-pulse" />
                </button>
              )}
            </div>

            <p className="text-[10px] text-center text-gray-400 pb-3">
              {speechSupported
                ? (isUrdu ? "🎤 لائیو اسپیچ • ایمرالڈ ٹیک پارٹنر • 03186986259" : "🎤 Live Speech · Emerald Tech Partner · 03186986259")
                : (isUrdu ? "⌨️ ٹیکسٹ موڈ • ایمرالڈ ٹیک پارٹنر • 03186986259" : "⌨️ Text Mode · Emerald Tech Partner · 03186986259")}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
