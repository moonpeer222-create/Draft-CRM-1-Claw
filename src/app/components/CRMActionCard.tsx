/**
 * CRMActionCard — renders AI CRM action results with role-appropriate visual cards.
 * Each action type gets its own icon, color scheme and layout.
 */
import { useTheme } from "../lib/ThemeContext";
import type { CRMActionResult } from "../lib/crmTools";
import type { CRMActionType } from "../lib/crmTools";
import {
  Search, FileText, RefreshCw, StickyNote, DollarSign,
  BarChart3, AlertTriangle, Users, Filter, Globe,
  Plus, Flag, TrendingUp, Clock, CheckCircle, XCircle,
} from "lucide-react";

interface CRMActionCardProps {
  actionType: CRMActionType;
  result: CRMActionResult;
}

const ACTION_META: Record<CRMActionType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  search_cases:       { icon: Search,     label: "کیس تلاش",        color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30" },
  get_case:           { icon: FileText,   label: "کیس تفصیل",       color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/30" },
  update_status:      { icon: RefreshCw,  label: "اسٹیٹس اپڈیٹ",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  add_note:           { icon: StickyNote, label: "نوٹ شامل",        color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/30" },
  add_payment:        { icon: DollarSign, label: "ادائیگی ریکارڈ",  color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30" },
  get_stats:          { icon: BarChart3,  label: "CRM اعداد",        color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
  list_overdue:       { icon: AlertTriangle, label: "تاخیر کیسز",   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
  list_by_agent:      { icon: Users,      label: "ایجنٹ کیسز",      color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/30" },
  list_by_status:     { icon: Filter,     label: "اسٹیٹس فہرست",    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  list_by_country:    { icon: Globe,      label: "ملک کیسز",         color: "text-teal-400",   bg: "bg-teal-500/10 border-teal-500/30" },
  create_case:        { icon: Plus,       label: "نیا کیس",          color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/30" },
  flag_case:          { icon: Flag,       label: "کیس فلیگ",         color: "text-rose-400",   bg: "bg-rose-500/10 border-rose-500/30" },
  analyze_performance:{ icon: TrendingUp, label: "کارکردگی تجزیہ",  color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/30" },
  predict_delay:      { icon: Clock,      label: "تاخیر پیشن گوئی", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
};

export function CRMActionCard({ actionType, result }: CRMActionCardProps) {
  const { darkMode } = useTheme();
  const meta = ACTION_META[actionType] || ACTION_META.get_stats;
  const Icon = meta.icon;
  const StatusIcon = result.success ? CheckCircle : XCircle;

  return (
    <div className={`rounded-xl border p-3 mb-2 text-right ${meta.bg} ${darkMode ? "text-gray-100" : "text-gray-800"}`} dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        <StatusIcon className={`w-3.5 h-3.5 ml-auto flex-shrink-0 ${result.success ? "text-emerald-400" : "text-red-400"}`} />
      </div>
      {/* Message */}
      <p className="text-xs leading-relaxed whitespace-pre-wrap opacity-90">{result.message}</p>

      {/* Extra data for specific action types */}
      {result.success && result.data && actionType === "add_payment" && (
        <div className="mt-2 pt-2 border-t border-current/10 flex justify-between text-xs opacity-70">
          <span>رسید: {result.data.receipt}</span>
          <span>PKR {result.data.paidAmount?.toLocaleString()} / {result.data.totalFee?.toLocaleString()}</span>
        </div>
      )}
      {result.success && result.data && actionType === "predict_delay" && result.data.riskScore !== undefined && (
        <div className="mt-2 pt-2 border-t border-current/10">
          <div className="flex items-center gap-2 text-xs opacity-80">
            <span>رسک سکور:</span>
            <div className="flex-1 bg-black/20 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  result.data.riskScore >= 50 ? "bg-red-400" :
                  result.data.riskScore >= 25 ? "bg-yellow-400" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(result.data.riskScore, 100)}%` }}
              />
            </div>
            <span className="font-bold">{result.data.riskScore}/100</span>
          </div>
        </div>
      )}
      {result.success && result.data && actionType === "create_case" && (
        <div className="mt-1 text-xs opacity-70">
          <span className="font-mono">{result.data.id}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Parse inline action results from the concatenated `✅ / ❌ message` text
 * and render them as cards. Falls back to plain text if not parseable.
 */
export function renderActionResults(
  actionResultText: string,
  actionTypes: CRMActionType[],
  darkMode: boolean,
) {
  if (!actionResultText) return null;
  const lines = actionResultText.split("\n\n").filter(Boolean);
  return lines.map((line, i) => {
    const success = line.startsWith("✅");
    const type = actionTypes[i] || "get_stats" as CRMActionType;
    const message = line.replace(/^[✅❌]\s*/, "");
    return (
      <CRMActionCard
        key={i}
        actionType={type}
        result={{ success, message }}
      />
    );
  });
}
