// Breadcrumb Navigation — shows current location in the app hierarchy
import { useLocation, Link } from "react-router";
import { ChevronRight, Home } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";

// Map route segments to labels
const LABELS: Record<string, { en: string; ur: string }> = {
  admin: { en: "Admin", ur: "ایڈمن" },
  agent: { en: "Agent", ur: "ایجنٹ" },
  customer: { en: "Customer", ur: "کسٹمر" },
  master: { en: "Master Admin", ur: "ماسٹر ایڈمن" },
  operator: { en: "Operator", ur: "آپریٹر" },
  cases: { en: "Cases", ur: "کیسز" },
  reports: { en: "Reports", ur: "رپورٹیں" },
  team: { en: "Team", ur: "ٹیم" },
  attendance: { en: "Attendance", ur: "حاضری" },
  financials: { en: "Financials", ur: "مالیات" },
  settings: { en: "Settings", ur: "ترتیبات" },
  documents: { en: "Documents", ur: "دستاویزات" },
  analytics: { en: "Analytics", ur: "تجزیات" },
  leaderboard: { en: "Leaderboard", ur: "لیڈر بورڈ" },
  profile: { en: "Profile", ur: "پروفائل" },
  calendar: { en: "Calendar", ur: "کیلنڈر" },
  performance: { en: "Performance", ur: "کارکردگی" },
  payments: { en: "Payments", ur: "ادائیگی" },
  "ai-chatbot": { en: "AI Chatbot", ur: "اے آئی چیٹ بوٹ" },
  "voice-assistant": { en: "Voice Assistant", ur: "وائس اسسٹنٹ" },
  "ai-tools": { en: "AI Tools", ur: "اے آئی ٹولز" },
  "business-intelligence": { en: "Business Intelligence", ur: "بزنس انٹیلیجنس" },
  "user-management": { en: "User Management", ur: "صارف مینجمنٹ" },
  "overdue-cases": { en: "Overdue Cases", ur: "تاخیر شدہ کیسز" },
  "agent-codes": { en: "Agent Codes", ur: "ایجنٹ کوڈز" },
  "passport-tracker": { en: "Passport Tracker", ur: "پاسپورٹ ٹریکر" },
  "approval-queue": { en: "Approval Queue", ur: "منظوری قطار" },
  "audit-log": { en: "Audit Log", ur: "آڈٹ لاگ" },
  backup: { en: "Backup", ur: "بیک اپ" },
  "sync-history": { en: "Sync History", ur: "سنک ہسٹری" },
  operations: { en: "Operations", ur: "آپریشنز" },
  "panic-test": { en: "Panic Mode", ur: "پینک موڈ" },
};

export function Breadcrumbs() {
  const location = useLocation();
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;

  const segments = location.pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return null; // Don't show for root portal pages

  const crumbs = segments.map((segment, idx) => {
    const path = "/" + segments.slice(0, idx + 1).join("/");
    const labelObj = LABELS[segment];
    const isCaseId = /^EMR-\d{4}-\d{4}$/.test(segment);
    const label = isCaseId ? segment : (labelObj ? (isUrdu ? labelObj.ur : labelObj.en) : segment);
    const isLast = idx === segments.length - 1;
    return { path, label, isLast };
  });

  return (
    <nav className={`flex items-center gap-1 text-xs font-medium overflow-x-auto scrollbar-hide ${dc ? "text-gray-500" : "text-gray-400"}`} aria-label="Breadcrumb">
      <Link
        to={`/${segments[0]}`}
        className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-colors whitespace-nowrap ${
          dc ? "hover:text-gray-300 hover:bg-gray-800" : "hover:text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Home className="w-3 h-3" />
      </Link>
      {crumbs.slice(1).map((crumb, idx) => (
        <span key={idx} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
          {crumb.isLast ? (
            <span className={`px-1.5 py-1 whitespace-nowrap ${dc ? "text-gray-300" : "text-gray-700"}`}>
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className={`px-1.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                dc ? "hover:text-gray-300 hover:bg-gray-800" : "hover:text-gray-600 hover:bg-gray-100"
              }`}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
