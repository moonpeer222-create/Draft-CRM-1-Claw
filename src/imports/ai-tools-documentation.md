# Emerald Visa CRM - AI Tools Documentation
## Version 2.0 - Enhanced with Visa Consultancy Process Training

---

## Overview

The AI Tools system provides role-based intelligent assistants for the Emerald Visa CRM, consisting of two components:

1. **RoleBasedChatbot** (`/src/app/components/visaverse/RoleBasedChatbot.tsx`) - Text-based conversational AI
2. **RoleBasedVoiceAssistant** (`/src/app/components/visaverse/RoleBasedVoiceAssistant.tsx`) - Voice-activated AI assistant

Both components are bilingual (English + Urdu) with automatic language detection, trained on the comprehensive 12-stage visa consultancy process documented in `/src/imports/visa-consultancy-process.md`.

---

## Architecture

### Component Structure
```
/src/app/components/visaverse/
  RoleBasedChatbot.tsx        # Text chatbot with role-based knowledge
  RoleBasedVoiceAssistant.tsx  # Voice assistant with role-based commands

/src/app/pages/admin/
  AdminAIChatbot.tsx           # Admin chatbot page wrapper
  AdminVoiceAssistant.tsx      # Admin voice assistant page wrapper

/src/app/pages/agent/
  AgentAIChatbot.tsx           # Agent chatbot page wrapper
  AgentVoiceAssistant.tsx      # Agent voice assistant page wrapper
```

### Role System
- **admin** - Full system visibility, team management, financials, all 12 stages
- **agent** - Case management, client handling, document checklists, process guides
- **customer** - Case tracking, document status, payment info, journey visualization

---

## Knowledge Base Structure

### Admin Knowledge (17 response categories)
| Category | Keywords (EN) | Keywords (UR) | Description |
|----------|--------------|---------------|-------------|
| team | team, agent | ٹیم، ایجنٹ | Team overview with 4 agents |
| stats | stat, overview | جائزہ، اعداد | System statistics |
| performance | performance, leaderboard | کارکردگی | Agent performance rankings |
| approval | approval, pending | منظوری | Pending approvals queue |
| agents | manage, code | انتظام | Agent management guide |
| backup | backup, sync | بیک اپ | Data backup status |
| financials | financial, revenue | مالی، آمدنی | Financial summary |
| visaProcess | visa process, stages | ویزا پراسیس، مراحل | Complete 12-stage overview |
| leadGeneration | lead, facebook, chatbot, filter | لیڈ، فیس بک، چیٹ بوٹ، فلٹر | Stage 1 details |
| officeVisit | office visit, first impression, discipline | آفس وزٹ، پہلا تاثر، ڈسیپلن | Stage 2 details |
| documentCollection | scan, document collection | سکین، دستاویزات جمع | Stage 3 details |
| medicalProcess | medical, gamca, token | میڈیکل، گامکا، ٹوکن | Stage 4 details |
| eNumber | e-number, pdf, vendor submission | ای نمبر | Stage 5 details |
| paymentCollection | 2 lakh, biometric, original document | رقم وصولی، بائیومیٹرک، اصل دستاویز | Stage 6 details |
| caseRegistration | case registration, tcs, dual entry | کیس رجسٹریشن، ٹی سی ایس، ڈبل انٹری | Stage 7 details |
| vendorPayment | vendor payment, vendor | وینڈر ادائیگی، وینڈر | Stage 8 details |
| visaApproval | visa approval, mubarakbad, remaining payment | ویزا منظوری، مبارکباد، باقی رقم | Stage 9 details |
| protectorProcess | protector, nominee, stamp | پروٹیکٹر، نومینی، اسٹامپ | Stage 10 details |
| ticketBooking | ticket, video, final | ٹکٹ، ویڈیو، فائنل | Stage 11 details |
| departure | depart, fly, alhamdulillah | فلائی، روانگی، الحمداللہ | Stage 12 details |
| businessRules | rule, sop, business | اصول، کاروبار | 10 key business rules |
| roleResponsibilities | role, responsib, sales rep, operator, owner | رول، ذمہ، سیلز، کمپیوٹر آپریٹر، مالک | 4 role descriptions |
| passportStock | passport stock, imran | پاسپورٹ سٹاک، عمران | Passport storage management |

### Agent Knowledge (12 response categories)
| Category | Keywords (EN) | Keywords (UR) | Description |
|----------|--------------|---------------|-------------|
| cases | case, my | کیس | Active cases list |
| next | next, step | اگلا | Next steps per case |
| medical | medical, gamca, token | میڈیکل، گامکا، ٹوکن | Full GAMCA process guide |
| payment | payment, reminder, easypais, jazzcash | ادائیگی، رقم | Payment collection + template |
| documents | document, paper, frc, pcc, checklist | دستاویز، کاغذ، فہرست | Complete original docs list |
| performance | performance, commission | کارکردگی، کمیشن | Personal stats |
| visaProcess | visa process, stages | ویزا پراسیس | 12-stage overview |
| clientHandling | client, handling, impression, deal | کلائنٹ، تاثر، ڈیل | Client tips from process doc |
| protectorGuide | protector, nominee, stamp, 8 am | پروٹیکٹر، نومینی، اسٹامپ | Protector step-by-step |
| agreementGuide | agreement, iqrarnama, contract | اقرار، معاہد | Iqrarnama/agreement guide |

### Customer Knowledge (9 response categories)
| Category | Keywords (EN) | Keywords (UR) | Description |
|----------|--------------|---------------|-------------|
| status | status, track, progress | اسٹیٹس، ٹریک، حیثیت، پیش رفت | Case status with % |
| documents | document, paper | دستاویز، کاغذ | Document status + required list |
| payment | pay, fee | ادائیگی، فیس، رقم | Payment methods + fee structure |
| medical | medical, gamca, lab, exam | میڈیکل، گامکا، معائن | Medical guide for clients |
| visaStages | stage, journey, where | سفر، کہاں | Visual 12-stage journey tracker |
| protector | protector, nominee | پروٹیکٹر، نومینی | Client-facing protector info |
| agreement | agreement, contract | اقرار، معاہد | Agreement explanation |

---

## 12-Stage Visa Process (from visa-consultancy-process.md)

### Stage 1: Lead Generation & Qualification
- Client contacts via Facebook post
- Chatbot filters non-serious clients automatically
- Sales Rep target: 5 mature clients/day
- Mature clients invited to office visit

### Stage 2: Office Visit & First Impression
- Client observes: cleanliness, discipline, other clients present
- Expert person handles consultation, answers all questions
- Professional paperwork & bio-data forms
- Retainer Agreement (Iqrarnama) signed

### Stage 3: Document Collection & Scanning
- CNIC, Passport (all pages), Photos (passport-size + full body)
- Driver's License if applicable
- All data saved properly with client name + date

### Stage 4: Medical Token & GAMCA Process
- Token Fee: PKR 4,500 (client pays, office books online)
- Medical Center Fee: PKR 25,000-35,000 (client pays directly)
- Client guided via WhatsApp (lab address, route)
- Result within 36 hours
- Unfit = cancel, Fit = proceed immediately
- After medical: passport to stock (Imran's house)

### Stage 5: E-Number & Vendor Submission
- Computer Operator prepares PDF 36hrs before biometric
- PDF → Owner → Vendor
- E-Number via WhatsApp → Computer Operator
- Passport retrieved from stock
- Client called for next-day visit with 2 Lakh PKR

### Stage 6: Payment Collection (2 Lakh PKR)
- Cash: receipt + register entry
- Online: screenshot → Owner confirmation → entry
- Original documents collected: Passport (old+new), CNIC, Photos, FRC, PCC, 2 Biometric Slips, Medical Report, License (if applicable)
- ONE missing original = Embassy won't grant visa

### Stage 7: Case Registration & Vendor Handover
- Dual entry: Computer CRM + Manual Register
- TCS slip if applicable
- Note which vendor receives case
- File handed to Owner

### Stage 8: Vendor Payment & Visa Processing
- Owner handles all vendor payments
- Computer Operator logs with Owner confirmation
- Daily vendor payment log maintained
- Vendor sends visa copy via WhatsApp

### Stage 9: Visa Approval & Remaining Payment
- Staff congratulates client
- Next day: remaining payment collection
- Owner confirmation for all payments
- Nominee details + account number collected for Protector

### Stage 10: Protector Process
- Nominee + account number → save → Owner
- Owner gets Protector Paper from Vendor
- Client to Protector Office at 8 AM sharp
- Stamp + 200 PKR guarantee stamp
- Signature + thumbprint
- Scan → Owner → Vendor completes online

### Stage 11: Ticket Booking & Final Handover
- Full payment must be complete
- Ticket date finalized
- Final vendor payment
- Complete file retrieved
- Video statement recorded (MANDATORY)
- File handover

### Stage 12: Departure
- Client flies! Alhamdulillah!
- Case marked COMPLETED in CRM

---

## Key Business Rules Encoded

1. No document missing - Embassy won't grant visa
2. Owner confirmation required for EVERY payment entry
3. Dual entry system: Computer CRM + Manual Register
4. Passport stock location: Imran's house (tracked)
5. Medical result deadline: 36 hours
6. Protector appointment: 8 AM sharp
7. Video statement mandatory before departure
8. Every action logged for audit trail
9. Sales Rep target: 5 mature clients/day
10. Professional conduct at all times

---

## Role Responsibilities Encoded

| Role | Key Responsibilities |
|------|---------------------|
| Sales Representative | Lead qualification, WhatsApp follow-up, office scheduling, 5 clients/day target |
| Computer Operator | Document scanning, PDF prep, CRM + register entry, payment logging (Owner confirmation) |
| Owner (Sir Atif/Wasi) | Payment confirmations, vendor communication, E-Number/Visa/Protector handling, approvals |
| Expert/Main Person | Client consultation, professional Q&A, deal closing |

---

## Language Detection

Both components use automatic language detection:
```typescript
function detectLanguage(text: string): "en" | "ur" {
  const urduRegex = /[\u0600-\u06FF]/;
  return urduRegex.test(text) ? "ur" : "en";
}
```
- Detects Arabic script characters (U+0600 to U+06FF) for Urdu
- Falls back to English for all other input
- Responses are served in the detected language

---

## Urdu Training Data Sources

The Urdu responses are trained on the original Urdu text from the business process document (`visa-consultancy-process.md`), preserving:
- Original business terminology in Urdu
- Natural Urdu phrasing from the Owner's description
- Roman Urdu keywords for matching (e.g., "میچور", "فلٹر", "ڈسیپلن")
- Authentic business flow descriptions

Key Urdu phrases preserved:
- "غیر سنجیدہ کلائنٹس فلٹر" (filter non-serious clients)
- "کلائنٹ کو لاجواب کر دیں" (leave client impressed)
- "پیشہ ورانہ مہارت سے" (with professional expertise)
- "مالک سے کنفرمیشن" (confirmation from owner)
- "الحمداللہ" (completion celebration)

---

## Quick Actions per Role

### Admin (5 quick actions)
1. Team Overview / ٹیم کا جائزہ
2. System Stats / سسٹم اعداد و شمار
3. Agent Performance / ایجنٹ کارکردگی
4. Visa Process / ویزا پراسیس
5. Business Rules / کاروباری اصول

### Agent (5 quick actions)
1. My Cases / میرے کیسز
2. Next Steps / اگلے قدم
3. Quick Update / فوری اپڈیٹ
4. Visa Process / ویزا پراسیس
5. Documents List / دستاویزات

### Customer (5 quick actions)
1. Track Status / اسٹیٹس ٹریک
2. Documents / دستاویزات
3. Payment / ادائیگی
4. Visa Stages / ویزا مراحل
5. Medical Info / میڈیکل معلومات

---

## Voice Assistant Commands

### Admin (24 commands - 12 EN + 12 UR)
- Show team overview / ٹیم کا جائزہ دکھائیں
- System statistics / سسٹم کے اعداد و شمار
- Pending approvals / زیر التواء منظوریاں
- Financial summary / مالیاتی خلاصہ
- Agent performance / ایجنٹ کی کارکردگی
- Visa process stages / ویزا پراسیس کے مراحل
- Business rules / کاروباری اصول
- Lead generation / لیڈ جنریشن
- Medical process / میڈیکل پراسیس
- Protector process / پروٹیکٹر پراسیس
- Passport stock / پاسپورٹ سٹاک
- Role responsibilities / رول ذمہ داریاں

### Agent (20 commands - 10 EN + 10 UR)
- Show my cases / میرے کیسز دکھائیں
- What's next / اگلا کیا ہے
- Medical process / میڈیکل کا عمل
- Send payment reminder / ادائیگی کی یاد دہانی بھیجیں
- My performance / میری کارکردگی
- Visa process stages / ویزا پراسیس کے مراحل
- Document checklist / دستاویزات کی فہرست
- Client handling tips / کلائنٹ ہینڈلنگ ٹپس
- Protector guide / پروٹیکٹر گائیڈ
- Agreement guide / اقرار نامہ گائیڈ

### Customer (16 commands - 8 EN + 8 UR)
- Check my status / میری حیثیت چیک کریں
- Document requirements / دستاویزات کی ضروریات
- Payment details / ادائیگی کی تفصیلات
- Medical appointment / میڈیکل اپائنٹمنٹ
- Contact agent / ایجنٹ سے رابطہ
- Visa journey stages / ویزا سفر کے مراحل
- Protector information / پروٹیکٹر کی معلومات
- Agreement details / معاہدے کی تفصیلات

---

## Fee Structure Encoded

| Fee | Amount | Who Pays |
|-----|--------|----------|
| Medical Token | PKR 4,500 | Client → Office → Online booking |
| Medical Center | PKR 25,000-35,000 | Client → Direct to center |
| Visa Processing (2 Lakh) | PKR 200,000 | Client → Office |
| Protector Stamp | PKR 200 | Client → Office |

---

## Contact Information Encoded
- Phone: 03186986259
- Payment: EasyPaisa / JazzCash / Bank Transfer (same number)
- Passport Stock Location: Imran's house

---

## Technical Notes

- Both components use `motion/react` for animations
- Theme context provides `isUrdu` and `fontClass` for RTL support
- Chat panel is full-screen on mobile (`inset-2`), positioned panel on desktop (`sm:w-[420px]`)
- z-index: 150 for both floating buttons and panels
- Chatbot: bottom-left positioned, Voice: bottom-right positioned
- Voice assistant shows 4 quick commands (up from 3)
- Both show Emerald Visa branding and contact number in footer
