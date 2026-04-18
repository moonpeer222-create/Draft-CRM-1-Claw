/**
 * SmartNLP - Intelligent Natural Language Processing Engine
 * for Emerald Tech Partner AI Tools
 * 
 * Features:
 * - Intent scoring (not first-match-wins)
 * - Fuzzy matching with typo tolerance
 * - Conversation memory & follow-ups
 * - Compound query detection
 * - Natural language understanding (how to, tell me about, what is, explain)
 * - Roman Urdu support
 * - Smart fallback with closest topic suggestions
 */

export type UserRole = "admin" | "agent" | "customer" | "master_admin" | "operator";

export type IntentKey = string;

interface IntentDefinition {
  key: IntentKey;
  keywords: string[];        // exact keywords
  phrases: string[];         // multi-word phrases (higher weight)
  urduKeywords: string[];    // Urdu script keywords
  romanUrdu: string[];       // Roman Urdu (Latin script)
  weight: number;            // base weight for this intent
  label: { en: string; ur: string }; // human-readable label for suggestions
}

// ─── Intent Definitions by Role ───────────────────────────────────────

const SHARED_INTENTS: IntentDefinition[] = [
  {
    key: "visaProcess",
    keywords: ["visa", "process", "stages", "workflow", "12", "twelve", "step", "procedure", "lifecycle"],
    phrases: ["visa process", "12 stage", "twelve stage", "all stages", "complete process", "how does it work", "entire process", "full process", "start to finish", "beginning to end"],
    urduKeywords: ["ویزا", "پراسیس", "مراحل", "طریقہ", "عمل"],
    romanUrdu: ["visa process", "poora process", "saray marahil", "kaise hota hai", "pura tarika"],
    weight: 1.0,
    label: { en: "12-Stage Visa Process", ur: "12 مراحل ویزا پراسیس" }
  },
  {
    key: "medicalProcess",
    keywords: ["medical", "gamca", "doctor", "hospital", "lab", "laboratory", "health", "checkup", "examination", "unfit", "fit", "token"],
    phrases: ["medical process", "gamca token", "medical exam", "medical test", "health check", "medical center", "medical report", "medical result", "36 hours", "4500", "medical batao", "medical kaise"],
    urduKeywords: ["میڈیکل", "گامکا", "ڈاکٹر", "ہسپتال", "لیب", "ٹوکن", "معائنہ", "صحت"],
    romanUrdu: ["medical", "gamca", "doctor", "hospital", "token", "checkup", "medical ka process", "medical kaise hota", "gamca token", "medical batao", "medical process batao"],
    weight: 1.0,
    label: { en: "Medical/GAMCA Process", ur: "میڈیکل/گامکا پراسیس" }
  },
  {
    key: "protectorProcess",
    keywords: ["protector", "nominee", "thumbprint", "stamp", "guarantee"],
    phrases: ["protector process", "protector office", "8 am", "nominee details", "protector paper", "guarantee stamp", "200 rupees"],
    urduKeywords: ["پروٹیکٹر", "نومینی", "انگوٹھا", "اسٹامپ", "گارنٹی"],
    romanUrdu: ["protector", "nominee", "angootha", "stamp", "protector ka process", "subah 8 bajay"],
    weight: 1.0,
    label: { en: "Protector Process", ur: "پروٹیکٹر پراسیس" }
  },
  {
    key: "login",
    keywords: ["login", "signin", "sign-in", "access", "code", "activate", "session", "log-in", "enter"],
    phrases: ["how to login", "how do i login", "login as agent", "login as admin", "access code", "activate session", "6 digit", "session expired", "login again", "login kaise", "sign in"],
    urduKeywords: ["لاگ ان", "سائن ان", "ایکسیس", "کوڈ", "سیشن", "ایکٹیویٹ"],
    romanUrdu: ["login kaise", "login karun", "log in", "access code", "session khatam", "dubara login", "code nahi aaya", "session expired"],
    weight: 1.0,
    label: { en: "Login & Access", ur: "لاگ ان اور رسائی" }
  },
  {
    key: "dashboard",
    keywords: ["dashboard", "home", "main", "overview", "widget", "tasks", "today"],
    phrases: ["my dashboard", "go to dashboard", "open dashboard", "today tasks", "today's tasks", "what to do today", "my tasks", "show tasks", "aaj ke kaam"],
    urduKeywords: ["ڈیش بورڈ", "آج", "کام", "ہوم"],
    romanUrdu: ["dashboard", "aaj ke kaam", "mere kaam", "dashboard dikhao", "tasks dikhao", "aaj kya karna hai"],
    weight: 1.0,
    label: { en: "Dashboard & Tasks", ur: "ڈیش بورڈ اور کام" }
  },
  {
    key: "searchClient",
    keywords: ["search", "find", "look", "locate", "specific", "particular"],
    phrases: ["find client", "search client", "find case", "search for", "look for", "how to find", "search bar", "find a specific"],
    urduKeywords: ["تلاش", "ڈھونڈ", "خاص", "سرچ"],
    romanUrdu: ["search", "dhoondo", "client dhoondo", "case dhoondo", "kaise dhundun", "search kaise"],
    weight: 0.9,
    label: { en: "Search & Find Client", ur: "کلائنٹ تلاش" }
  },
  {
    key: "timeline",
    keywords: ["timeline", "journey", "tracker", "progress", "stage"],
    phrases: ["timeline show", "case timeline", "client journey", "visa journey", "stage tracker", "what does timeline show", "progress tracker"],
    urduKeywords: ["ٹائم لائن", "سفر", "پیشرفت", "ٹریکر"],
    romanUrdu: ["timeline", "journey", "progress", "tracker", "timeline kya dikhati"],
    weight: 0.9,
    label: { en: "Timeline & Journey", ur: "ٹائم لائن اور سفر" }
  },
  {
    key: "caseCreate",
    keywords: ["create", "new", "add", "start", "open", "begin", "wizard", "form"],
    phrases: ["create case", "new case", "add case", "start case", "create new case", "open new case", "how to create", "naya case", "case banao", "6 step"],
    urduKeywords: ["نیا کیس", "بنائیں", "شروع", "کیس بنائیں"],
    romanUrdu: ["naya case", "case banao", "case kaise banaun", "new case kaise", "case create", "naya case banao"],
    weight: 1.0,
    label: { en: "Create New Case", ur: "نیا کیس بنائیں" }
  },
  {
    key: "caseStatus",
    keywords: ["change", "update", "modify", "badge", "advance", "move"],
    phrases: ["change status", "update status", "case status change", "move stage", "advance case", "status badge", "how to change status", "status update"],
    urduKeywords: ["تبدیل", "اپ ڈیٹ", "سٹیٹس تبدیل", "مرحلہ آگے"],
    romanUrdu: ["status change", "status update", "status kaise badlun", "status tabdeel", "case aage"],
    weight: 0.9,
    label: { en: "Change Case Status", ur: "کیس سٹیٹس تبدیل" }
  },
  {
    key: "caseOverdue",
    keywords: ["overdue", "late", "delay", "delayed", "deadline", "expired", "missed"],
    phrases: ["case overdue", "overdue case", "delay reason", "deadline missed", "what if overdue", "case late", "add delay reason"],
    urduKeywords: ["تاخیر", "ڈیڈ لائن", "لیٹ", "تاخیر کی وجہ"],
    romanUrdu: ["overdue", "late", "delay", "deadline", "takheer", "delay reason", "deadline guzar gayi"],
    weight: 0.9,
    label: { en: "Overdue & Delays", ur: "تاخیر اور ڈیڈ لائنز" }
  },
  {
    key: "documentUpload",
    keywords: ["upload", "scan", "scanning", "attach", "file"],
    phrases: ["upload document", "how to upload", "scan document", "attach file", "upload file", "document upload", "scan kaise"],
    urduKeywords: ["اپ لوڈ", "سکین", "منسلک", "فائل"],
    romanUrdu: ["upload", "scan", "upload kaise", "document upload", "file attach", "scan kaise karun"],
    weight: 0.9,
    label: { en: "Upload Documents", ur: "دستاویزات اپ لوڈ" }
  },
  {
    key: "companyInfo",
    keywords: ["company", "emerald", "office", "address", "location", "contact", "phone", "email", "whatsapp", "number"],
    phrases: ["company info", "office address", "contact number", "phone number", "whatsapp number", "where is office", "company details", "emerald visa"],
    urduKeywords: ["کمپنی", "ایمرالڈ", "آفس", "پتہ", "نمبر", "رابطہ"],
    romanUrdu: ["company", "office kahan", "address", "contact", "phone number", "whatsapp number", "emerald visa"],
    weight: 0.8,
    label: { en: "Company Info", ur: "کمپنی کی معلومات" }
  },
  {
    key: "troubleshoot",
    keywords: ["error", "bug", "problem", "issue", "broken", "crash", "fix", "stuck", "working", "help"],
    phrases: ["not working", "system error", "report bug", "system crash", "something wrong", "need help", "how to fix", "kaam nahi", "problem hai"],
    urduKeywords: ["مسئلہ", "غلطی", "خراب", "کام نہیں", "مدد"],
    romanUrdu: ["error", "bug", "problem", "kaam nahi", "kharab", "fix", "stuck", "masla", "issue"],
    weight: 0.9,
    label: { en: "Troubleshooting", ur: "مسائل حل" }
  },
  {
    key: "escalation",
    keywords: ["escalate", "urgent", "emergency", "angry", "complaint", "dispute", "lost"],
    phrases: ["escalate case", "client angry", "document lost", "payment dispute", "emergency", "urgent help", "complaint"],
    urduKeywords: ["فوری", "ایمرجنسی", "شکایت", "ناراض", "گم"],
    romanUrdu: ["escalate", "urgent", "emergency", "angry client", "complaint", "dispute", "document gum"],
    weight: 1.0,
    label: { en: "Escalation & Emergency", ur: "ایسکلیشن اور ایمرجنسی" }
  },
];

const ADMIN_INTENTS: IntentDefinition[] = [
  {
    key: "team",
    keywords: ["team", "agents", "staff", "members", "workforce", "faizan", "imran", "safeer", "aynee", "employees", "people"],
    phrases: ["team overview", "show team", "my team", "all agents", "how many agents", "who is on the team", "team members", "agent list", "staff list", "team status"],
    urduKeywords: ["ٹیم", "ایجنٹس", "سٹاف", "ملازمین", "فیضان", "عمران", "صفیر", "عائنی"],
    romanUrdu: ["team", "agents", "staff", "log kitne hain", "kitne agent hain", "team kaisi hai", "team dikhao"],
    weight: 1.0,
    label: { en: "Team Overview", ur: "ٹیم کا جائزہ" }
  },
  {
    key: "stats",
    keywords: ["statistics", "stats", "overview", "summary", "numbers", "data", "analytics", "health", "dashboard", "metrics"],
    phrases: ["system stats", "show statistics", "system overview", "give me numbers", "how is the system", "overall status", "crm status", "system health", "dashboard overview"],
    urduKeywords: ["اعداد", "شمار", "جائزہ", "خلاصہ", "ڈیٹا", "اعدادوشمار"],
    romanUrdu: ["stats", "overview", "numbers", "data", "system kaisa hai", "kitne cases hain", "aaj ka jaiza"],
    weight: 1.0,
    label: { en: "System Statistics", ur: "سسٹم کے اعداد و شمار" }
  },
  {
    key: "performance",
    keywords: ["performance", "leaderboard", "ranking", "best", "top", "score", "success", "rate", "comparison"],
    phrases: ["agent performance", "who is best", "top performer", "performance report", "success rate", "show leaderboard", "compare agents", "best agent", "performance ranking"],
    urduKeywords: ["کارکردگی", "لیڈربورڈ", "درجہ بندی", "بہترین", "سکور"],
    romanUrdu: ["performance", "leaderboard", "ranking", "best agent", "sabse acha", "kon acha kar raha hai"],
    weight: 1.0,
    label: { en: "Agent Performance", ur: "ایجنٹ کارکردگی" }
  },
  {
    key: "approval",
    keywords: ["approval", "pending", "review", "approve", "reject", "queue", "waiting", "confirm", "overdue"],
    phrases: ["pending approvals", "what needs approval", "approval queue", "things to approve", "review pending", "how many pending", "overdue approvals", "waiting for me"],
    urduKeywords: ["منظوری", "زیرالتواء", "تصدیق", "قطار", "انتظار"],
    romanUrdu: ["approval", "pending", "approve", "review", "kitne pending hain", "kya approve karna hai", "kia check karna hai"],
    weight: 1.0,
    label: { en: "Pending Approvals", ur: "زیر التواء منظوریاں" }
  },
  {
    key: "agents",
    keywords: ["manage", "code", "create", "add", "remove", "kpi", "target", "attendance", "monitor"],
    phrases: ["agent management", "manage agents", "create agent", "add new agent", "agent codes", "set targets", "monitor agents", "agent attendance"],
    urduKeywords: ["انتظام", "کوڈ", "بنائیں", "شامل", "نگرانی", "حاضری"],
    romanUrdu: ["manage", "agent banao", "code banao", "naya agent", "agent add karo", "target set karo"],
    weight: 0.9,
    label: { en: "Agent Management", ur: "ایجنٹ کا انتظام" }
  },
  {
    key: "backup",
    keywords: ["backup", "sync", "data", "security", "restore", "export", "save"],
    phrases: ["data backup", "sync status", "backup data", "last backup", "auto backup", "data security", "restore data"],
    urduKeywords: ["بیکاپ", "سنک", "ڈیٹا", "سیکیورٹی", "محفوظ"],
    romanUrdu: ["backup", "sync", "data safe", "data backup", "last backup kab hua"],
    weight: 0.9,
    label: { en: "Data Backup & Security", ur: "ڈیٹا بیک اپ" }
  },
  {
    key: "financials",
    keywords: ["financial", "revenue", "money", "income", "earnings", "profit", "commission", "growth", "expense"],
    phrases: ["financial summary", "how much revenue", "show revenue", "monthly income", "financial report", "money earned", "total earnings", "commission paid", "financial overview"],
    urduKeywords: ["مالی", "آمدنی", "پیسے", "کمیشن", "منافع", "اخراجات", "مالیاتی"],
    romanUrdu: ["financial", "revenue", "paisa", "kitna kamaya", "income", "commission", "profit", "kamai"],
    weight: 1.0,
    label: { en: "Financial Summary", ur: "مالیاتی خلاصہ" }
  },
  {
    key: "leadGeneration",
    keywords: ["lead", "leads", "facebook", "chatbot", "filter", "qualification", "prospect", "client", "new"],
    phrases: ["lead generation", "new leads", "facebook leads", "how to get clients", "client acquisition", "chatbot filtering", "qualify leads", "mature clients"],
    urduKeywords: ["لیڈ", "فیسبک", "چیٹبوٹ", "فلٹر", "کلائنٹس"],
    romanUrdu: ["lead", "leads", "facebook", "chatbot", "filter", "naye client", "client kaise aate hain", "lead kaise generate"],
    weight: 1.0,
    label: { en: "Lead Generation", ur: "لیڈ جنریشن" }
  },
  {
    key: "officeVisit",
    keywords: ["office", "visit", "impression", "cleanliness", "discipline", "consultation"],
    phrases: ["office visit", "first impression", "client visits office", "office cleanliness", "how to impress client", "professional impression"],
    urduKeywords: ["آفس", "وزٹ", "تاثر", "صفائی", "ڈسیپلن"],
    romanUrdu: ["office visit", "pehla taseer", "safai", "discipline", "client aaye to"],
    weight: 0.9,
    label: { en: "Office Visit", ur: "آفس وزٹ" }
  },
  {
    key: "documentCollection",
    keywords: ["scan", "scanning", "collect", "collection"],
    phrases: ["document collection", "scan documents", "collect documents", "document scanning", "scanning process"],
    urduKeywords: ["سکین", "جمع", "دستاویزات جمع"],
    romanUrdu: ["scan", "documents collect", "kagzaat jama", "scan kaise"],
    weight: 0.8,
    label: { en: "Document Collection", ur: "دستاویزات جمع" }
  },
  {
    key: "eNumber",
    keywords: ["enumber", "e-number", "biometric", "pdf", "vendor"],
    phrases: ["e number", "e-number process", "pdf file", "vendor submission", "biometric slip", "36 hours before"],
    urduKeywords: ["ای نمبر", "بائیومیٹرک", "وینڈر"],
    romanUrdu: ["e number", "enumber", "biometric", "pdf", "vendor ko bhejo"],
    weight: 0.9,
    label: { en: "E-Number & Vendor", ur: "ای نمبر" }
  },
  {
    key: "paymentCollection",
    keywords: ["2lakh", "lakh", "biometric", "original", "receipt", "cash", "online", "easypais", "jazzcash", "easypaisa"],
    phrases: ["payment collection", "2 lakh", "collect payment", "original documents", "payment receipt", "cash payment", "online payment", "payment methods"],
    urduKeywords: ["لاکھ", "رقم وصولی", "رسید", "کیش", "اصل دستاویز"],
    romanUrdu: ["2 lakh", "payment", "raqam", "cash", "online", "easypaisa", "jazzcash", "payment kaise collect"],
    weight: 1.0,
    label: { en: "Payment Collection", ur: "رقم وصولی" }
  },
  {
    key: "caseRegistration",
    keywords: ["registration", "register", "tcs", "handover", "dual", "entry", "crm"],
    phrases: ["case registration", "register case", "tcs slip", "dual entry", "handover file", "manual register", "crm entry"],
    urduKeywords: ["رجسٹریشن", "رجسٹر", "ٹی سی ایس", "حوالگی", "ڈبل انٹری"],
    romanUrdu: ["registration", "register", "tcs", "handover", "double entry", "case register karo"],
    weight: 0.9,
    label: { en: "Case Registration", ur: "کیس رجسٹریشن" }
  },
  {
    key: "vendorPayment",
    keywords: ["vendor"],
    phrases: ["vendor payment", "pay vendor", "vendor communication", "vendor processing"],
    urduKeywords: ["وینڈر ادائیگی", "وینڈر"],
    romanUrdu: ["vendor payment", "vendor ko pay", "vendor ka kaam"],
    weight: 0.8,
    label: { en: "Vendor Payment", ur: "وینڈر ادائیگی" }
  },
  {
    key: "visaApproval",
    keywords: ["congratulations", "mubarakbad", "remaining", "granted", "approved"],
    phrases: ["visa approval", "visa approved", "visa granted", "remaining payment", "congratulations", "mubarakbad call"],
    urduKeywords: ["ویزا منظوری", "مبارکباد", "باقی رقم"],
    romanUrdu: ["visa approved", "mubarakbad", "baqi raqam", "visa lag gaya"],
    weight: 1.0,
    label: { en: "Visa Approval", ur: "ویزا منظوری" }
  },
  {
    key: "ticketBooking",
    keywords: ["ticket", "booking", "video", "statement", "flight", "airline"],
    phrases: ["ticket booking", "book ticket", "video statement", "final handover", "flight booking"],
    urduKeywords: ["ٹکٹ", "بکنگ", "ویڈیو", "فلائٹ"],
    romanUrdu: ["ticket", "booking", "video statement", "flight", "ticket book"],
    weight: 0.9,
    label: { en: "Ticket Booking", ur: "ٹکٹ بکنگ" }
  },
  {
    key: "departure",
    keywords: ["departure", "fly", "airport", "alhamdulillah", "completed", "done"],
    phrases: ["departure day", "client flies", "case completed", "final departure"],
    urduKeywords: ["روانگی", "فلائی", "الحمداللہ", "مکمل"],
    romanUrdu: ["departure", "fly", "alhamdulillah", "case complete", "client chala gaya", "rowaangi"],
    weight: 0.9,
    label: { en: "Departure", ur: "روانگی" }
  },
  {
    key: "businessRules",
    keywords: ["rules", "rule", "sop", "policy", "policies", "guidelines", "important", "critical"],
    phrases: ["business rules", "important rules", "key rules", "sop document", "what are the rules", "company policy", "office rules"],
    urduKeywords: ["اصول", "پالیسی", "اہم", "قوانین"],
    romanUrdu: ["rules", "sop", "policy", "important rules", "kya rules hain", "zaroori baatein"],
    weight: 1.0,
    label: { en: "Business Rules", ur: "کاروباری اصول" }
  },
  {
    key: "roleResponsibilities",
    keywords: ["role", "responsibility", "responsibilities", "duty", "duties", "job", "operator", "sales"],
    phrases: ["role responsibilities", "who does what", "my responsibilities", "sales rep duties", "computer operator duties", "owner responsibilities", "job duties", "what is my job"],
    urduKeywords: ["رول", "ذمہ", "ذمہ داری", "فرائض", "آپریٹر", "سیلز"],
    romanUrdu: ["role", "duty", "responsibilities", "kiska kaam kya", "mera kaam kya hai", "kisne kya karna hai"],
    weight: 1.0,
    label: { en: "Role Responsibilities", ur: "رول ذمہ داریاں" }
  },
  {
    key: "passportStock",
    keywords: ["passport", "stock", "storage", "imran", "track", "retrieve"],
    phrases: ["passport stock", "where are passports", "passport storage", "imran house", "track passport", "retrieve passport", "passport location"],
    urduKeywords: ["پاسپورٹ سٹاک", "پاسپورٹ", "عمران", "ذخیرہ"],
    romanUrdu: ["passport stock", "passport kahan", "imran ke ghar", "passport track", "passport location"],
    weight: 0.9,
    label: { en: "Passport Stock", ur: "پاسپورٹ سٹاک" }
  },
];

const AGENT_INTENTS: IntentDefinition[] = [
  {
    key: "cases",
    keywords: ["case", "cases", "active", "assigned", "my", "list", "portfolio", "workload"],
    phrases: ["my cases", "show cases", "active cases", "assigned cases", "case list", "how many cases", "what cases do i have", "my workload", "current cases"],
    urduKeywords: ["کیسز", "فعال", "تفویض", "میرے", "فہرست"],
    romanUrdu: ["cases", "mere cases", "active cases", "kitne cases hain", "case list dikhao"],
    weight: 1.0,
    label: { en: "My Cases", ur: "میرے کیسز" }
  },
  {
    key: "next",
    keywords: ["next", "todo", "upcoming", "pending", "due", "urgent", "priority", "overdue", "today"],
    phrases: ["next steps", "what's next", "what to do", "what should i do", "pending tasks", "urgent tasks", "today's tasks", "overdue tasks", "action items", "whats next"],
    urduKeywords: ["اگلا", "کرنا", "آج", "فوری", "ترجیح", "تاخیر"],
    romanUrdu: ["next", "agle steps", "kya karna hai", "aaj kya karna hai", "urgent kya hai", "pending kya hai"],
    weight: 1.0,
    label: { en: "Next Steps", ur: "اگلے قدم" }
  },
  {
    key: "payment",
    keywords: ["payment", "pay", "money", "reminder", "collect", "receipt", "easypais", "jazzcash", "easypaisa", "bank", "transfer", "cash", "online"],
    phrases: ["payment reminder", "send reminder", "collect payment", "payment template", "payment methods", "how to collect", "whatsapp template", "payment guide"],
    urduKeywords: ["ادائیگی", "رقم", "یاددہانی", "وصولی", "رسید"],
    romanUrdu: ["payment", "paisa", "raqam", "reminder bhejo", "payment kaise collect", "cash", "online", "easypaisa"],
    weight: 1.0,
    label: { en: "Payment Collection", ur: "ادائیگی وصولی" }
  },
  {
    key: "documents",
    keywords: ["document", "documents", "paper", "papers", "checklist", "requirement", "frc", "pcc", "cnic", "passport", "photo", "license", "original"],
    phrases: ["document checklist", "required documents", "what documents needed", "document list", "papers needed", "document requirements", "original documents"],
    urduKeywords: ["دستاویز", "دستاویزات", "کاغذ", "فہرست", "ضروری", "اصل"],
    romanUrdu: ["documents", "papers", "kagzaat", "checklist", "kya chahiye", "konse documents", "original chahiye"],
    weight: 1.0,
    label: { en: "Document Checklist", ur: "دستاویزات کی فہرست" }
  },
  {
    key: "performance",
    keywords: ["performance", "commission", "target", "score", "leaderboard", "ranking", "progress", "achievement"],
    phrases: ["my performance", "how am i doing", "commission earned", "my target", "my ranking", "am i on target", "my progress", "performance report"],
    urduKeywords: ["کارکردگی", "کمیشن", "ہدف", "درجہ", "سکور"],
    romanUrdu: ["performance", "commission", "target", "mera ranking", "kitna kamaya", "kaisa kar raha hun"],
    weight: 1.0,
    label: { en: "My Performance", ur: "میری کارکردگی" }
  },
  {
    key: "clientHandling",
    keywords: ["client", "handling", "impression", "deal", "close", "convince", "consultation", "professional"],
    phrases: ["client handling", "how to handle client", "close deal", "first impression", "client tips", "convince client", "professional approach", "deal close"],
    urduKeywords: ["کلائنٹ", "تاثر", "ڈیل", "مشاورت"],
    romanUrdu: ["client", "handling", "deal close", "client kaise handle", "impression", "professional", "deal kaise close"],
    weight: 0.9,
    label: { en: "Client Handling Tips", ur: "کلائنٹ ہینڈلنگ ٹپس" }
  },
  {
    key: "protectorGuide",
    keywords: ["protector", "nominee", "thumbprint", "stamp", "guarantee"],
    phrases: ["protector process", "protector guide", "nominee details", "8 am appointment", "protector paper"],
    urduKeywords: ["پروٹیکٹر", "نومینی", "انگوٹھا", "اسٹامپ"],
    romanUrdu: ["protector", "nominee", "angootha", "stamp", "8 bajay"],
    weight: 1.0,
    label: { en: "Protector Guide", ur: "پروٹیکٹر گائیڈ" }
  },
  {
    key: "agreementGuide",
    keywords: ["agreement", "iqrarnama", "contract", "sign", "retainer"],
    phrases: ["agreement guide", "iqrarnama", "retainer agreement", "sign agreement", "client agreement", "contract details"],
    urduKeywords: ["اقرار", "اقرارنامہ", "معاہدہ", "سائن"],
    romanUrdu: ["agreement", "iqrarnama", "contract", "sign", "agreement ka process"],
    weight: 0.9,
    label: { en: "Agreement Guide", ur: "اقرار نامہ گائیڈ" }
  },
];

const CUSTOMER_INTENTS: IntentDefinition[] = [
  {
    key: "status",
    keywords: ["status", "track", "progress", "where", "current", "update", "stage", "how"],
    phrases: ["my status", "case status", "track case", "where am i", "current stage", "check status", "my progress", "any update", "case update", "how is my case"],
    urduKeywords: ["حیثیت", "ٹریک", "پیشرفت", "کہاں", "موجودہ", "اپڈیٹ"],
    romanUrdu: ["status", "track", "kahan hai", "mera case", "kya update hai", "kaisa chal raha hai", "kitna hua"],
    weight: 1.0,
    label: { en: "Case Status", ur: "کیس کی حیثیت" }
  },
  {
    key: "documents",
    keywords: ["document", "documents", "paper", "papers", "required", "need", "bring", "submit"],
    phrases: ["what documents", "required documents", "what to bring", "document status", "which papers", "what do i need", "documents needed"],
    urduKeywords: ["دستاویز", "کاغذ", "ضروری", "لازمی", "لائیں"],
    romanUrdu: ["documents", "papers", "kya chahiye", "kya lana hai", "konse kagzaat", "document status"],
    weight: 1.0,
    label: { en: "Documents", ur: "دستاویزات" }
  },
  {
    key: "payment",
    keywords: ["payment", "pay", "fee", "fees", "cost", "price", "money", "amount", "how much", "charges"],
    phrases: ["payment info", "how to pay", "payment methods", "how much", "fee structure", "total cost", "what to pay", "where to pay", "payment details"],
    urduKeywords: ["ادائیگی", "فیس", "قیمت", "رقم", "کتنا", "کتنے"],
    romanUrdu: ["payment", "fee", "kitna", "kaise pay", "kitne paise", "total cost", "kahan pay"],
    weight: 1.0,
    label: { en: "Payment Info", ur: "ادائیگی کی معلومات" }
  },
  {
    key: "medical",
    keywords: ["medical", "gamca", "doctor", "hospital", "lab", "health", "checkup", "test", "appointment"],
    phrases: ["medical appointment", "medical exam", "gamca test", "medical info", "where to go for medical", "medical process"],
    urduKeywords: ["میڈیکل", "گامکا", "ڈاکٹر", "معائنہ", "اپائنٹمنٹ"],
    romanUrdu: ["medical", "gamca", "doctor", "medical kahan", "appointment kab", "medical kaise hota"],
    weight: 1.0,
    label: { en: "Medical Info", ur: "میڈیکل معلومات" }
  },
  {
    key: "contact",
    keywords: ["contact", "call", "phone", "reach", "number", "whatsapp", "agent", "talk", "speak", "help"],
    phrases: ["contact agent", "call agent", "phone number", "how to reach", "talk to someone", "need help", "speak to agent", "whatsapp number"],
    urduKeywords: ["رابطہ", "کال", "فون", "نمبر", "واٹسایپ", "مدد"],
    romanUrdu: ["contact", "call", "phone", "number", "whatsapp", "agent se baat", "madad chahiye", "kisi se baat"],
    weight: 0.9,
    label: { en: "Contact Agent", ur: "ایجنٹ سے رابطہ" }
  },
  {
    key: "visaStages",
    keywords: ["stages", "journey", "step", "steps", "how", "long", "timeline", "when", "complete"],
    phrases: ["visa stages", "visa journey", "how long", "when will it complete", "timeline", "visa steps", "all stages", "my journey"],
    urduKeywords: ["مراحل", "سفر", "کتنا وقت", "کب", "مکمل"],
    romanUrdu: ["stages", "journey", "kitna time", "kab tak", "total steps", "visa journey", "kab complete"],
    weight: 1.0,
    label: { en: "Visa Journey", ur: "ویزا سفر" }
  },
  {
    key: "protector",
    keywords: ["protector", "nominee", "stamp"],
    phrases: ["protector process", "what is protector", "protector info", "nominee needed"],
    urduKeywords: ["پروٹیکٹر", "نومینی"],
    romanUrdu: ["protector", "nominee", "protector kya hai", "protector process"],
    weight: 0.9,
    label: { en: "Protector Info", ur: "پروٹیکٹر کی معلومات" }
  },
  {
    key: "agreement",
    keywords: ["agreement", "contract", "iqrarnama", "sign", "rights", "terms"],
    phrases: ["agreement details", "my agreement", "contract terms", "iqrarnama", "my rights", "what did i sign"],
    urduKeywords: ["اقرار", "معاہدہ", "حقوق", "شرائط"],
    romanUrdu: ["agreement", "contract", "iqrarnama", "mera agreement", "rights", "terms"],
    weight: 0.9,
    label: { en: "Agreement Details", ur: "معاہدے کی تفصیلات" }
  },
];

// ─── Natural Language Patterns ───────────────────────────────────────

const NL_PREFIXES = [
  "tell me about", "what is", "what are", "how to", "how do i", "how does",
  "explain", "show me", "show", "help with", "help me with", "i need",
  "i want to know", "can you tell me", "can you show", "can you explain",
  "please tell", "please show", "please explain", "give me", "get me",
  "what about", "how about", "info on", "information about", "details about",
  "details of", "guide me", "guide for", "help me understand",
  "i want", "i need to", "let me see", "display", "check", "view",
  "batao", "dikhao", "samjhao", "bataiye", "dikhaiye", "kya hai",
  "kaise", "kahan", "kitna", "kitne", "kon", "konsa", "mujhe batao",
  "mujhe dikhao", "mujhe chahiye", "maine", "humein", "hamen",
];

const FOLLOW_UP_WORDS = [
  "more", "detail", "details", "elaborate", "explain more", "tell more",
  "go on", "continue", "and", "also", "what else", "anything else",
  "aur", "mazeed", "tafseelat", "aur batao", "aage", "aur kya",
  "مزید", "تفصیلات", "اور بتائیں", "اور کیا",
];

const GREETING_PATTERNS = [
  "hello", "hi", "hey", "assalam", "salam", "aoa", "how are you",
  "good morning", "good afternoon", "good evening",
  "ہیلو", "سلام", "السلام", "کیسے ہو", "کیسے ہیں",
];

const THANK_PATTERNS = [
  "thank", "thanks", "shukriya", "jazakallah", "jazak", "appreciated", "helpful",
  "شکریہ", "جزاکاللہ", "مہربانی",
];

// ─── Fuzzy Matching ──────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

function fuzzyMatch(input: string, target: string, threshold = 0.75): boolean {
  if (input.includes(target) || target.includes(input)) return true;
  if (input.length < 3 || target.length < 3) return input === target;
  
  const dist = levenshtein(input, target);
  const maxLen = Math.max(input.length, target.length);
  const similarity = 1 - dist / maxLen;
  return similarity >= threshold;
}

// ─── Intent Scoring Engine ───────────────────────────────────────────

interface ScoredIntent {
  key: IntentKey;
  score: number;
  label: { en: string; ur: string };
}

function scoreIntent(input: string, intent: IntentDefinition): number {
  const lower = input.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length > 1);
  let score = 0;

  // 1. Exact phrase match (highest score)
  for (const phrase of intent.phrases) {
    if (lower.includes(phrase)) {
      score += 3.0 * intent.weight;
    }
  }

  // 2. Keyword match
  for (const keyword of intent.keywords) {
    if (lower.includes(keyword)) {
      score += 1.5 * intent.weight;
    } else {
      // Fuzzy keyword match
      for (const word of words) {
        if (fuzzyMatch(word, keyword, 0.78)) {
          score += 0.8 * intent.weight;
        }
      }
    }
  }

  // 3. Urdu keyword match
  for (const keyword of intent.urduKeywords) {
    if (lower.includes(keyword)) {
      score += 2.0 * intent.weight;
    }
  }

  // 4. Roman Urdu match
  for (const phrase of intent.romanUrdu) {
    if (lower.includes(phrase)) {
      score += 2.5 * intent.weight;
    } else {
      // Check individual words in Roman Urdu phrases
      const phraseWords = phrase.split(/\s+/);
      let matchedWords = 0;
      for (const pw of phraseWords) {
        if (words.some(w => fuzzyMatch(w, pw, 0.78))) matchedWords++;
      }
      if (matchedWords > 0 && phraseWords.length > 0) {
        score += (matchedWords / phraseWords.length) * 1.5 * intent.weight;
      }
    }
  }

  return score;
}

function getIntentsForRole(role: UserRole): IntentDefinition[] {
  const shared = [...SHARED_INTENTS];
  switch (role) {
    case "admin":
    case "master_admin":
      return [...shared, ...ADMIN_INTENTS];
    case "agent":
      return [...shared, ...AGENT_INTENTS];
    case "customer":
      return [...shared, ...CUSTOMER_INTENTS];
    default:
      return shared;
  }
}

function stripNLPrefixes(input: string): string {
  let cleaned = input.toLowerCase().trim();
  for (const prefix of NL_PREFIXES) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length).trim();
      break;
    }
  }
  // Remove trailing question marks, exclamation marks
  cleaned = cleaned.replace(/[?!.]+$/, "").trim();
  return cleaned;
}

// ─── Conversation Context ────────────────────────────────────────────

export interface ConversationContext {
  lastIntent: IntentKey | null;
  lastTopics: IntentKey[];
  messageCount: number;
  language: "en" | "ur";
}

export function createContext(): ConversationContext {
  return { lastIntent: null, lastTopics: [], messageCount: 0, language: "en" };
}

// ─── Main Processing Function ────────────────────────────────────────

export function detectLanguage(text: string): "en" | "ur" {
  const urduRegex = /[\u0600-\u06FF]/;
  return urduRegex.test(text) ? "ur" : "en";
}

export interface NLPResult {
  primaryIntent: IntentKey | null;
  secondaryIntent: IntentKey | null;
  isGreeting: boolean;
  isThankYou: boolean;
  isFollowUp: boolean;
  language: "en" | "ur";
  confidence: number;
  suggestedTopics: { key: IntentKey; label: { en: string; ur: string } }[];
}

export function processMessage(
  rawInput: string,
  role: UserRole,
  context: ConversationContext
): NLPResult {
  const lang = detectLanguage(rawInput);
  const input = rawInput.trim();
  const lower = input.toLowerCase();

  // Check greeting
  const isGreeting = GREETING_PATTERNS.some(g => lower.includes(g));
  
  // Check thank you
  const isThankYou = THANK_PATTERNS.some(t => lower.includes(t));

  // Check follow-up
  const isFollowUp = FOLLOW_UP_WORDS.some(f => lower.includes(f)) && lower.split(/\s+/).length <= 4;

  if (isGreeting && lower.split(/\s+/).length <= 5) {
    return {
      primaryIntent: null, secondaryIntent: null,
      isGreeting: true, isThankYou: false, isFollowUp: false,
      language: lang, confidence: 1.0, suggestedTopics: []
    };
  }

  if (isThankYou && lower.split(/\s+/).length <= 5) {
    return {
      primaryIntent: null, secondaryIntent: null,
      isGreeting: false, isThankYou: true, isFollowUp: false,
      language: lang, confidence: 1.0, suggestedTopics: []
    };
  }

  // If follow-up and we have context, return last intent
  if (isFollowUp && context.lastIntent) {
    return {
      primaryIntent: context.lastIntent, secondaryIntent: null,
      isGreeting: false, isThankYou: false, isFollowUp: true,
      language: lang, confidence: 0.8, suggestedTopics: []
    };
  }

  // Strip NL prefixes for cleaner matching
  const cleaned = stripNLPrefixes(input);
  
  // Score all intents
  const intents = getIntentsForRole(role);
  const scored: ScoredIntent[] = intents.map(intent => ({
    key: intent.key,
    score: Math.max(scoreIntent(lower, intent), scoreIntent(cleaned, intent)),
    label: intent.label,
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const primaryScore = scored[0]?.score || 0;
  const secondaryScore = scored[1]?.score || 0;

  // Determine confidence
  const confidence = primaryScore > 0 ? Math.min(primaryScore / 5, 1.0) : 0;

  // Get suggested topics for fallback (top 3 scoring > 0 or all if nothing matched)
  let suggestedTopics: { key: IntentKey; label: { en: string; ur: string } }[] = [];
  if (primaryScore < 1.0) {
    // Nothing confident - suggest top topics
    suggestedTopics = scored
      .filter(s => s.score > 0)
      .slice(0, 3)
      .map(s => ({ key: s.key, label: s.label }));
    
    if (suggestedTopics.length === 0) {
      // Suggest random popular topics for the role
      suggestedTopics = intents.slice(0, 4).map(i => ({ key: i.key, label: i.label }));
    }
  }

  return {
    primaryIntent: primaryScore >= 1.0 ? scored[0].key : null,
    secondaryIntent: secondaryScore >= 1.5 && secondaryScore >= primaryScore * 0.6 ? scored[1].key : null,
    isGreeting: false,
    isThankYou: false,
    isFollowUp: false,
    language: lang,
    confidence,
    suggestedTopics,
  };
}

// ─── Response Formatting ─────────────────────────────────────────────

export function getGreetingResponse(role: UserRole, lang: "en" | "ur"): string {
  const greetings: Record<string, { en: string; ur: string }> = {
    admin: {
      en: "Assalam o Alaikum! I'm your Admin AI Assistant. Ask me anything about cases, team, payments, or approvals. How can I help? 🎯",
      ur: "السلام علیکم! میں آپ کا ایڈمن AI ہوں۔ کیسز، ٹیم، پیسے، یا منظوری — جو بھی پوچھنا ہو پوچھیں۔ بتائیں کیا کروں؟ 🎯"
    },
    agent: {
      en: "Assalam o Alaikum! I'm your Agent AI Assistant. Ask about your cases, next steps, medical, payments, or documents. Ready to help! 💪",
      ur: "السلام علیکم! میں آپ کا ایجنٹ AI ہوں۔ کیسز، اگلا قدم، میڈیکل، پیمنٹ، کاغذات — جو پوچھنا ہو پوچھیں۔ بولیں کیا کرنا ہے؟ 💪"
    },
    customer: {
      en: "Assalam o Alaikum! Welcome to Emerald Tech Partner! Ask me about your service status, documents, payments, or any step. I'm here to help! 🌍",
      ur: "السلام علیکم! ایمرالڈ ویزا میں خوش آمدید! ویزا سٹیٹس، کاغذات، پیمنٹ، یا کوئی بھی سوال — بے فکر پوچھیں۔ میں حاضر ہوں! 🌍"
    },
    master_admin: {
      en: "Assalam o Alaikum! I'm your Master Admin AI. System monitoring, team oversight, all processes, financials — ask away! 👑",
      ur: "السلام علیکم! میں آپ کا ماسٹر ایڈمن AI ہوں۔ سسٹم، ٹیم، سارے پراسیس، پیسوں کا حساب — جو چاہیں پوچھیں! 👑"
    }
  };
  return greetings[role]?.[lang] || greetings.admin[lang];
}

export function getThankYouResponse(lang: "en" | "ur"): string {
  const responses = {
    en: [
      "You're welcome! Feel free to ask anything else. I'm here to help! 😊",
      "Happy to help! If you need anything else, just ask. 🤝",
      "Anytime! Don't hesitate to ask more questions. 💚",
    ],
    ur: [
      "کوئی بات نہیں! اور کچھ پوچھنا ہو تو بتائیں۔ 😊",
      "خوشی ہوئی! اور کچھ چاہیے تو بولیں۔ 🤝",
      "جی بلکل! کوئی اور سوال ہو تو پوچھیں۔ 💚",
    ]
  };
  const arr = responses[lang];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getFollowUpIntro(lang: "en" | "ur"): string {
  const intros = {
    en: [
      "Sure, here's more detail on that:\n\n",
      "Of course! Let me elaborate:\n\n",
      "Here's additional information:\n\n",
    ],
    ur: [
      "جی بلکل، مزید بتاتا ہوں:\n\n",
      "ضرور! سنیں:\n\n",
      "اور بتاتا ہوں:\n\n",
    ]
  };
  const arr = intros[lang];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getSmartFallback(
  suggestedTopics: { key: IntentKey; label: { en: string; ur: string } }[],
  lang: "en" | "ur"
): string {
  if (suggestedTopics.length > 0) {
    if (lang === "ur") {
      const topics = suggestedTopics.map(t => `  • ${t.label.ur}`).join("\n");
      return `سمجھ نہیں آیا۔ 🤔\n\nکیا آپ یہ پوچھنا چاہتے ہیں:\n${topics}\n\nدوبارہ پوچھیں یا اوپر سے کوئی ٹاپک چنیں! 💡`;
    }
    const topics = suggestedTopics.map(t => `  • ${t.label.en}`).join("\n");
    return `I'm not quite sure what you're asking about. 🤔\n\nDid you mean one of these?\n${topics}\n\nTry rephrasing or pick a topic above! 💡`;
  }
  
  if (lang === "ur") {
    return "سمجھ نہیں آیا۔ 🤔\n\nآپ مجھ سے ویزا پراسیس، پیمنٹ، کاغذات، میڈیکل، ٹیم، یا کاروبار کے بارے میں پوچھ سکتے ہیں۔\n\nآسان الفاظ میں دوبارہ بولیں! 💬";
  }
  return "I'm not sure I understand. 🤔\n\nYou can ask me about visa processes, payments, documents, medical, team management, performance, or business rules.\n\nTry asking in a simpler way! 💬";
}