import { useState, useRef, useCallback, useEffect } from "react";
import {
  FolderPlus, Search, CheckCircle2, Clock, Calendar, Users, Building2,
  DollarSign, Phone, MapPin, Plus, X, Camera, Download, RefreshCw,
  AlertTriangle, Monitor, FileText, User, Check, ChevronRight, Eye,
  Clipboard, Bell, Cloud, Lock, Flag, BarChart3, Send, FileDown, Loader2,
  ArrowUpDown, ChevronDown, Upload, Filter, Trash2, CheckCircle, XCircle,
  LayoutGrid, LayoutList, RotateCcw, ShieldCheck, Image as ImageIcon,
  Globe, Sun, Moon, LogOut, Shield, HardDrive, Wifi, CloudOff, UserCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../lib/toast";
import { copyToClipboard } from "../../lib/clipboard";
import { type Case } from "../../lib/mockData";
import { createCase, updateCase } from "../../lib/caseApi";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { ALL_COUNTRIES, POPULAR_COUNTRIES } from "../../constants/countries";
import { SearchableCountrySelect } from "../../components/SearchableCountrySelect";

import { uploadFile, getSignedUrl } from "../../lib/storageService";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useNavigate } from "react-router";
import { useTheme } from "../../lib/ThemeContext";
import { getLastSyncTime, pushOperatorData } from "../../lib/operatorSync";
import {
  isPushEnabled,
  setPushEnabled,
  getPushPermission,
} from "../../lib/pushNotifications";

// ── Types ────────────────────────────────────────────────
export interface CaseFolder {
  id: string; clientName: string; phone: string; destination: string; assignedTo: string; createdAt: string;
}
export interface Appointment {
  id: string; clientName: string; type: "medical" | "protector" | "payment"; date: string; time: string; notes: string; done: boolean;
}
export interface OfficeVisit {
  id: string; clientName: string; phone: string; purpose: string; metWith: string; notes: string; timestamp: string;
}
export interface PaymentRecord {
  id: string; clientName: string; amount: number; method: string; receiptNumber: string; receiptPhoto: string | null; storagePath?: string; uploadProgress: number; timestamp: string;
}
export interface AttendanceEntry {
  staffName: string; status: "present" | "late" | "absent" | ""; time: string; date: string;
}
export interface Notification {
  id: string; message: string; messageUr: string; type: "status" | "payment" | "flag" | "report"; time: string; read: boolean;
}

export const STORAGE = {
  folders: "emr-op-folders",
  appointments: "emr-op-appointments",
  visits: "emr-op-visits",
  payments: "emr-op-payments",
  attendance: "emr-op-attendance",
  notifications: "emr-op-notifications",
};

export function load<T>(key: string, fallback: T): T {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}
export function save(key: string, data: any) {
  localStorage.setItem(key, JSON.stringify(data));
  // Trigger debounced cloud sync
  import("../../lib/operatorSync").then(m => m.debouncedPush()).catch(() => {});
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
export function DashboardSection({ u, dc, card, txt, sub, bigBtn, cases, agents, allStaff, notifications, addNotification }: any) {
  const confirmedIds: string[] = load("emr-op-confirmed", []);
  const attendance: AttendanceEntry[] = load(STORAGE.attendance, []);
  const today = new Date().toISOString().split("T")[0];
  const payments: PaymentRecord[] = load(STORAGE.payments, []);
  const visits: OfficeVisit[] = load(STORAGE.visits, []);

  const appointments: Appointment[] = load(STORAGE.appointments, []);

  const overdueCases = cases.filter((c: Case) => c.isOverdue);
  const pendingCases = cases.filter((c: Case) => !confirmedIds.includes(c.id));
  const todayPayments = payments.filter((p: PaymentRecord) => p.timestamp.startsWith(today));
  const todayVisits = visits.filter((v: OfficeVisit) => v.timestamp.startsWith(today));
  const presentToday = allStaff.filter((s: any) => attendance.find((a: AttendanceEntry) => a.staffName === s.fullName && a.date === today && a.status === "present"));

  // Unconfirmed payments older than 2 hours
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const unconfirmedPayments = payments.filter((p: PaymentRecord) =>
    new Date(p.timestamp).getTime() < twoHoursAgo && !p.receiptPhoto
  );

  // Upcoming appointments (today + next 2 days)
  const upcomingAppts = appointments
    .filter(a => !a.done && a.date >= today)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 5);

  const stats = [
    { icon: FolderPlus, label: u("Total Cases", "کل کیسز"), value: cases.length, color: "text-blue-500", bg: dc ? "bg-blue-900/20" : "bg-blue-50" },
    { icon: Clock, label: u("Pending", "باقی"), value: pendingCases.length, color: "text-amber-500", bg: dc ? "bg-amber-900/20" : "bg-amber-50" },
    { icon: AlertTriangle, label: u("Overdue", "تاخیر"), value: overdueCases.length, color: "text-red-500", bg: dc ? "bg-red-900/20" : "bg-red-50" },
    { icon: Users, label: u("Active Agents", "ایجنٹس"), value: agents.length, color: "text-emerald-500", bg: dc ? "bg-emerald-900/20" : "bg-emerald-50" },
  ];

  const miniStats = [
    { label: u("Today Payments", "آج کی ادائیگیاں"), value: todayPayments.length, emoji: "💰" },
    { label: u("Today Visits", "آج کے وزٹ"), value: todayVisits.length, emoji: "🏢" },
    { label: u("Present Today", "آج حاضر"), value: presentToday.length, emoji: "✅" },
    { label: u("Confirmed", "تصدیق شدہ"), value: confirmedIds.length, emoji: "☑️" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-xl border p-3 sm:p-4 ${card}`}>
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${txt}`}>{s.value}</p>
              <p className={`text-xs ${sub} mt-0.5`}>{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {miniStats.map((s, i) => (
          <div key={i} className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border ${card}`}>
            <span className="text-lg">{s.emoji}</span>
            <div>
              <p className={`text-base font-bold ${txt}`}>{s.value}</p>
              <p className={`text-[10px] ${sub}`}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {overdueCases.length > 0 && (
        <div className={`rounded-xl border p-3 sm:p-4 ${dc ? "bg-red-900/10 border-red-800/30" : "bg-red-50 border-red-200"}`}>
          <h3 className={`text-sm font-bold mb-2 flex items-center gap-2 ${dc ? "text-red-400" : "text-red-700"}`}>
            <AlertTriangle className="w-4 h-4" /> {u("Needs Attention", "فوری توجہ")}
          </h3>
          <div className="space-y-1.5">
            {overdueCases.slice(0, 5).map((c: Case) => (
              <div key={c.id} className={`flex items-center gap-2 text-xs ${dc ? "text-red-300" : "text-red-600"}`}>
                <span className="font-mono">{c.id}</span>
                <span className="font-medium">{c.customerName}</span>
                <span className={sub}> — {c.status.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unconfirmed Payments >2h Warning */}
      {unconfirmedPayments.length > 0 && (
        <div className={`rounded-xl border p-3 sm:p-4 ${dc ? "bg-amber-900/10 border-amber-800/30" : "bg-amber-50 border-amber-200"}`}>
          <h3 className={`text-sm font-bold mb-2 flex items-center gap-2 ${dc ? "text-amber-400" : "text-amber-700"}`}>
            <DollarSign className="w-4 h-4" /> {u(`${unconfirmedPayments.length} Payments Pending >2h`, `${unconfirmedPayments.length} ادائیگیاں 2 گھنٹے سے زائد`)} ⏰
          </h3>
          <div className="space-y-1.5">
            {unconfirmedPayments.slice(0, 4).map((p: PaymentRecord) => {
              const hoursAgo = Math.round((Date.now() - new Date(p.timestamp).getTime()) / 3600000);
              return (
                <div key={p.id} className={`flex items-center gap-2 text-xs ${dc ? "text-amber-300" : "text-amber-700"}`}>
                  <span className="font-medium">{p.clientName}</span>
                  <span className="font-bold text-emerald-600">PKR {p.amount.toLocaleString()}</span>
                  <span className={`ms-auto text-[10px] px-1.5 py-0.5 rounded ${dc ? "bg-amber-900/30" : "bg-amber-100"}`}>{hoursAgo}h {u("ago", "پہلے")}</span>
                </div>
              );
            })}
          </div>
          <p className={`text-[10px] mt-2 ${dc ? "text-amber-500" : "text-amber-600"}`}>
            ⚠️ {u("No receipt uploaded — needs admin confirmation", "رسید اپ لوڈ نہیں — ایڈمن کی تصدیق ضروری ہے")}
          </p>
        </div>
      )}

      {/* Upcoming Appointments */}
      {upcomingAppts.length > 0 && (
        <div className={`rounded-xl border overflow-hidden ${card}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${txt}`}>
              <Calendar className="w-4 h-4 text-blue-500" /> {u("Upcoming Appointments", "آنے والی ملاقاتیں")}
            </h3>
            <span className={`text-xs ${sub}`}>{upcomingAppts.length}</span>
          </div>
          <div className={`divide-y ${dc ? "divide-gray-700/50" : "divide-gray-100"}`}>
            {upcomingAppts.map(a => (
              <div key={a.id} className={`px-4 py-2.5 flex items-center gap-3`}>
                <span className="text-lg">{a.type === "medical" ? "🏥" : a.type === "protector" ? "🛡️" : "💰"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${txt}`}>{a.clientName}</p>
                  <p className={`text-[10px] ${sub}`}>{a.date === today ? u("Today", "آج") : a.date} — {a.time}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${a.date === today ? "bg-blue-100 text-blue-700" : dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                  {a.type === "medical" ? u("Medical", "میڈیکل") : a.type === "protector" ? u("Protector", "پروٹیکٹر") : u("Payment", "ادائیگی")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${txt}`}>
            <Bell className="w-4 h-4 text-emerald-500" /> {u("Recent Alerts", "حالیہ اطلاعات")}
          </h3>
          <span className={`text-xs ${sub}`}>{notifications.length} {u("total", "کل")}</span>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className={`text-center py-6 text-sm ${sub}`}>
              {u("No alerts yet. Confirm statuses to see activity here.", "ابھی کوئی اطلاع نہیں۔ صورتحال کی تصدیق کریں۔")}
            </p>
          ) : notifications.slice(0, 10).map((n: Notification) => (
            <div key={n.id} className={`px-4 py-2.5 border-b ${dc ? "border-gray-700/50" : "border-gray-100"} ${!n.read ? (dc ? "bg-emerald-900/5" : "bg-emerald-50/30") : ""}`}>
              <p className={`text-xs ${txt}`}>
                {n.type === "status" ? "✅" : n.type === "payment" ? "💰" : n.type === "flag" ? "⚠️" : "📊"}{" "}
                {u(n.message, n.messageUr)}
              </p>
              <p className={`text-[10px] ${sub}`}>
                {new Date(n.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// CASE FOLDERS (with Document Checklist + Flag)
// ═══════════════════════════════════════════════════════════
export function FoldersSection({ u, dc, card, txt, sub, inputCls, bigBtn, cases, agents, addNotification, onCaseCreated }: any) {
  const [folders, setFolders] = useState<CaseFolder[]>(() => load(STORAGE.folders, []));
  const [showForm, setShowForm] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dest, setDest] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [docChecklist, setDocChecklist] = useState<Record<string, Record<string, boolean>>>(() => load("emr-op-doc-checklist", {}));
  const [isCreating, setIsCreating] = useState(false);

  // Full case form state
  const [fullCase, setFullCase] = useState({
    customerName: "", fatherName: "", phone: "", email: "", cnic: "", passport: "",
    dateOfBirth: "", maritalStatus: "single" as Case["maritalStatus"],
    address: "", city: "Lahore", country: "Saudi Arabia",
    jobType: "Driver", jobDescription: "", education: "High School", experience: "",
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "father",
    agentName: agents[0]?.fullName || "Faizan", totalFee: 50000,
    priority: "medium" as Case["priority"],
  });

  const requiredDocs = [
    { id: "cnic", en: "CNIC Copy", ur: "شناختی کارڈ" },
    { id: "passport", en: "Passport Copy", ur: "پاسپورٹ" },
    { id: "photos", en: "Photos (4x)", ur: "تصاویر (4 عدد)" },
    { id: "medical", en: "Medical Report", ur: "میڈیکل رپورٹ" },
    { id: "police", en: "Police Character Certificate", ur: "پولیس سرٹیفکیٹ" },
    { id: "education", en: "Education Certificates", ur: "تعلیمی سند" },
    { id: "experience", en: "Experience Letter", ur: "تجربے کا خط" },
    { id: "bank", en: "Bank Statement", ur: "بینک اسٹیٹمنٹ" },
  ];

  const allFolders: CaseFolder[] = [
    ...cases.map((c: Case) => ({ id: c.id, clientName: c.customerName, phone: c.phone, destination: c.country, assignedTo: c.agentName, createdAt: c.createdDate })),
    ...folders,
  ];
  const filtered = allFolders.filter(f =>
    f.clientName.toLowerCase().includes(search.toLowerCase()) ||
    f.phone.includes(search) ||
    f.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!name.trim() || !phone.trim() || !dest.trim()) { toast.error(u("Fill all fields", "سب خانے بھریں")); return; }
    const newId = `EMR-${new Date().getFullYear()}-${String(allFolders.length + 1).padStart(4, "0")}`;
    const folder: CaseFolder = { id: newId, clientName: name.trim(), phone: phone.trim(), destination: dest.trim(), assignedTo: assignTo || "Operator", createdAt: new Date().toISOString() };
    const updated = [folder, ...folders];
    setFolders(updated);
    save(STORAGE.folders, updated);
    setName(""); setPhone(""); setDest(""); setAssignTo("");
    setShowForm(false);
    toast.success(`${u("Folder created!", "فولڈر بن گیا!")} ${newId}`);
  };

  const handleCreateFullCase = async () => {
    if (!fullCase.customerName.trim() || !fullCase.phone.trim()) {
      toast.error(u("Name and phone are required", "نام اور فون ضروری ہیں"));
      return;
    }
    setIsCreating(true);
    const agentNameToId: Record<string, string> = {
      "Faizan": "AGENT-1", "Imran": "AGENT-2", "Safeer": "AGENT-3", "Aynee": "AGENT-4",
    };
    try {
      const created = await createCase({
        customerName: fullCase.customerName.trim(),
        fatherName: fullCase.fatherName.trim(),
        phone: fullCase.phone.trim(),
        email: fullCase.email.trim(),
        cnic: fullCase.cnic.trim(),
        passport: fullCase.passport.trim(),
        dateOfBirth: fullCase.dateOfBirth,
        maritalStatus: fullCase.maritalStatus,
        address: fullCase.address.trim(),
        city: fullCase.city,
        country: fullCase.country,
        jobType: fullCase.jobType,
        jobDescription: fullCase.jobDescription.trim(),
        education: fullCase.education,
        experience: fullCase.experience.trim(),
        emergencyContact: {
          name: fullCase.emergencyContactName.trim(),
          phone: fullCase.emergencyContactPhone.trim(),
          relationship: fullCase.emergencyContactRelation,
        },
        agentName: fullCase.agentName,
        agentId: agentNameToId[fullCase.agentName] || "AGENT-1",
        totalFee: fullCase.totalFee,
        priority: fullCase.priority,
        status: "document_collection",
        currentStage: 1,
        stageStartedAt: new Date().toISOString(),
        stageDeadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        isOverdue: false,
      });
      if (created) {
        toast.success(`${u("Case created!", "کیس بن گیا!")} ${created.id}`);
        addNotification(
          `Operator created case ${created.id} for ${fullCase.customerName}`,
          `آپریٹر نے ${fullCase.customerName} کا کیس ${created.id} بنایا`,
          "status"
        );
      }
      setFullCase({
        customerName: "", fatherName: "", phone: "", email: "", cnic: "", passport: "",
        dateOfBirth: "", maritalStatus: "single", address: "", city: "Lahore",
        country: "Saudi Arabia", jobType: "Driver", jobDescription: "",
        education: "High School", experience: "",
        emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "father",
        agentName: agents[0]?.fullName || "Faizan", totalFee: 50000, priority: "medium",
      });
      setShowFullForm(false);
      if (onCaseCreated) onCaseCreated();
    } catch (e) {
      toast.error(u("Failed to create case", "کیس بنانا ناکام"));
    } finally {
      setIsCreating(false);
    }
  };

  const toggleDoc = (caseId: string, docId: string) => {
    const updated = { ...docChecklist };
    if (!updated[caseId]) updated[caseId] = {};
    updated[caseId][docId] = !updated[caseId]?.[docId];
    setDocChecklist(updated);
    save("emr-op-doc-checklist", updated);
    toast.success(updated[caseId][docId] ? u("Document checked!", "کاغذ چیک ہو گیا!") : u("Unchecked", "غیر چیک"));
  };

  const getDocProgress = (caseId: string) => {
    const checked = requiredDocs.filter(d => docChecklist[caseId]?.[d.id]).length;
    return { checked, total: requiredDocs.length, percent: Math.round((checked / requiredDocs.length) * 100) };
  };

  const flagMissing = (folderId: string, clientName: string) => {
    const prog = getDocProgress(folderId);
    const missingDocs = requiredDocs.filter(d => !docChecklist[folderId]?.[d.id]);
    addNotification(
      `Flag: ${clientName} (${folderId}) missing ${prog.total - prog.checked} docs: ${missingDocs.map(d => d.en).join(", ")}`,
      `خبردار: ${clientName} (${folderId}) کے ${prog.total - prog.checked} کاغزات نامکمل: ${missingDocs.map(d => d.ur).join("، ")}`,
      "flag"
    );
    toast.success(u("Admin has been notified!", "ایڈمن کو اطلاع دے دی گئی!"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowFullForm(!showFullForm); setShowForm(false); }}
          className={`${bigBtn} bg-gradient-to-r from-blue-600 to-indigo-600 text-white`}>
          <Plus className="w-5 h-5" /> {u("+ Create Full Case", "+ مکمل کیس بنائیں")}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowForm(!showForm); setShowFullForm(false); }}
          className={`${bigBtn} bg-gradient-to-r from-emerald-600 to-teal-600 text-white`}>
          <FolderPlus className="w-5 h-5" /> {u("+ Quick Folder", "+ فوری فولڈر")}
        </motion.button>
      </div>

      {/* ── FULL CASE CREATION FORM ── */}
      <AnimatePresence>
        {showFullForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`rounded-2xl border p-4 space-y-4 overflow-hidden ${card}`}>
            <h3 className={`font-bold text-base flex items-center gap-2 ${txt}`}>
              <Plus className="w-5 h-5 text-blue-500" /> {u("Create Full Case", "مکمل کیس بنائیں")}
            </h3>
            {/* Personal Info */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-blue-400" : "text-blue-600"}`}>
                <User className="w-3.5 h-3.5" /> {u("Personal Information", "ذاتی معلومات")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={fullCase.customerName} onChange={e => setFullCase({...fullCase, customerName: e.target.value})} placeholder={u("Full Name *", "مکمل نام *")} className={inputCls} />
                <input value={fullCase.fatherName} onChange={e => setFullCase({...fullCase, fatherName: e.target.value})} placeholder={u("Father's Name", "والد کا نام")} className={inputCls} />
                <input value={fullCase.phone} onChange={e => setFullCase({...fullCase, phone: e.target.value})} placeholder={u("Phone *", "فون *")} className={inputCls} dir="ltr" />
                <input value={fullCase.email} onChange={e => setFullCase({...fullCase, email: e.target.value})} placeholder={u("Email", "ای میل")} className={inputCls} dir="ltr" />
                <input value={fullCase.cnic} onChange={e => setFullCase({...fullCase, cnic: e.target.value})} placeholder="CNIC (XXXXX-XXXXXXX-X)" className={inputCls} dir="ltr" />
                <input value={fullCase.passport} onChange={e => setFullCase({...fullCase, passport: e.target.value})} placeholder={u("Passport No.", "پاسپورٹ نمبر")} className={inputCls} dir="ltr" />
                <input type="date" value={fullCase.dateOfBirth} onChange={e => setFullCase({...fullCase, dateOfBirth: e.target.value})} className={inputCls} />
                <select value={fullCase.maritalStatus} onChange={e => setFullCase({...fullCase, maritalStatus: e.target.value as Case["maritalStatus"]})} className={inputCls}>
                  {[["single","Single / غیر شادی شدہ"],["married","Married / شادی شدہ"],["divorced","Divorced / طلاق یافتہ"],["widowed","Widowed / بیوہ"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            {/* Address */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-emerald-400" : "text-emerald-600"}`}>
                <MapPin className="w-3.5 h-3.5" /> {u("Address", "پتہ")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={fullCase.address} onChange={e => setFullCase({...fullCase, address: e.target.value})} placeholder={u("Full Address", "مکمل پتہ")} className={`${inputCls} sm:col-span-2`} />
                <select value={fullCase.city} onChange={e => setFullCase({...fullCase, city: e.target.value})} className={inputCls}>
                  {["Lahore","Karachi","Islamabad","Rawalpindi","Faisalabad","Multan","Peshawar","Quetta","Sialkot","Gujranwala","Other"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {/* Job & Destination */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-amber-400" : "text-amber-600"}`}>
                <Building2 className="w-3.5 h-3.5" /> {u("Job & Destination", "ملازمت اور منزل")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SearchableCountrySelect value={fullCase.country} onChange={(v) => setFullCase({...fullCase, country: v})} darkMode={dc} />
                <select value={fullCase.jobType} onChange={e => setFullCase({...fullCase, jobType: e.target.value})} className={inputCls}>
                  {["Driver","Construction Worker","Hospitality","Healthcare","Security Guard","Factory Worker","Cleaner","Electrician","Plumber","Mechanic","Other"].map(j => <option key={j} value={j}>{j}</option>)}
                </select>
                <textarea value={fullCase.jobDescription} onChange={e => setFullCase({...fullCase, jobDescription: e.target.value})} placeholder={u("Skills / Job Description", "مہارت / نوکری کی تفصیل")} className={`${inputCls} min-h-[60px] sm:col-span-2`} />
              </div>
            </div>
            {/* Education & Experience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={fullCase.education} onChange={e => setFullCase({...fullCase, education: e.target.value})} className={inputCls}>
                {["Primary","Middle","High School","Intermediate","Graduate","Postgraduate","Technical/Diploma","None"].map(ed => <option key={ed} value={ed}>{ed}</option>)}
              </select>
              <input value={fullCase.experience} onChange={e => setFullCase({...fullCase, experience: e.target.value})} placeholder={u("Work Experience", "تجربہ")} className={inputCls} />
            </div>
            {/* Emergency Contact */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-red-400" : "text-red-600"}`}>
                <Phone className="w-3.5 h-3.5" /> {u("Emergency Contact", "ہنگامی رابطہ")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={fullCase.emergencyContactName} onChange={e => setFullCase({...fullCase, emergencyContactName: e.target.value})} placeholder={u("Contact Name", "رابطے کا نام")} className={inputCls} />
                <input value={fullCase.emergencyContactPhone} onChange={e => setFullCase({...fullCase, emergencyContactPhone: e.target.value})} placeholder={u("Contact Phone", "رابطے کا فون")} className={inputCls} dir="ltr" />
                <select value={fullCase.emergencyContactRelation} onChange={e => setFullCase({...fullCase, emergencyContactRelation: e.target.value})} className={inputCls}>
                  {[["father","Father / والد"],["mother","Mother / والدہ"],["spouse","Spouse / شریک حیات"],["brother","Brother / بھائی"],["sister","Sister / بہن"],["friend","Friend / دوست"],["other","Other / دیگر"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            {/* Case Settings */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-purple-400" : "text-purple-600"}`}>
                <Flag className="w-3.5 h-3.5" /> {u("Case Settings", "کیس کی ترتیبات")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={fullCase.agentName} onChange={e => setFullCase({...fullCase, agentName: e.target.value})} className={inputCls}>
                  {agents.map((a: any) => <option key={a.id} value={a.fullName}>{a.fullName}</option>)}
                  <option value="Operator">{u("Self (Operator)", "خود (آپریٹر)")}</option>
                </select>
                <input type="number" value={fullCase.totalFee} onChange={e => setFullCase({...fullCase, totalFee: Number(e.target.value)})} placeholder="Total Fee (PKR)" className={inputCls} dir="ltr" />
                <select value={fullCase.priority} onChange={e => setFullCase({...fullCase, priority: e.target.value as Case["priority"]})} className={inputCls}>
                  {[["low","Low / کم"],["medium","Medium / درمیانہ"],["high","High / زیادہ"],["urgent","Urgent / فوری"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreateFullCase} disabled={isCreating}
                className={`${bigBtn} flex-1 bg-blue-600 text-white disabled:opacity-50`}>
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {isCreating ? u("Creating...", "بنایا جا رہا ہے...") : u("Create Case", "کیس بنائیں")}
              </motion.button>
              <button onClick={() => setShowFullForm(false)} className={`px-4 py-3 rounded-xl ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QUICK FOLDER FORM ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`rounded-2xl border p-4 space-y-3 overflow-hidden ${card}`}>
            <h3 className={`font-bold text-base ${txt}`}>{u("Quick Folder", "فوری فولڈر")}</h3>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={u("Client Name *", "نام *")} className={inputCls} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={u("Phone *", "فون *")} className={inputCls} dir="ltr" />
            <input value={dest} onChange={e => setDest(e.target.value)} placeholder={u("Destination Country *", "ملک *")} className={inputCls} />
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className={inputCls}>
              <option value="">{u("Assign to (Operator)", "آپریٹر")}</option>
              {agents.map((a: any) => <option key={a.id} value={a.fullName}>{a.fullName}</option>)}
            </select>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate} className={`${bigBtn} flex-1 bg-emerald-600 text-white`}>
                <Check className="w-5 h-5" /> {u("Create", "بنائیں")}
              </motion.button>
              <button onClick={() => setShowForm(false)} className={`px-4 py-3 rounded-xl ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <Search className={`absolute top-1/2 -translate-y-1/2 ${dc ? "text-gray-500" : "text-gray-400"} w-5 h-5 start-4`} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={u("Search name, phone, ID...", "نام، فون، نمبر تلاش کریں...")}
          className={`${inputCls} ps-12`} />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className={`text-center py-8 ${sub}`}>{u("No folders found", "کوئی فولڈر نہیں ملا")}</p>
        ) : filtered.map(f => {
          const prog = getDocProgress(f.id);
          const isExpanded = expandedCase === f.id;
          return (
            <div key={f.id} className={`rounded-xl border overflow-hidden ${card}`}>
              <button onClick={() => setExpandedCase(isExpanded ? null : f.id)} className="w-full p-3 sm:p-4 text-start">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${dc ? "bg-emerald-900/30" : "bg-emerald-100"}`}>
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${dc ? "bg-gray-700 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}>{f.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700"}`}>
                        <User className="w-3 h-3 inline" /> {f.assignedTo}
                      </span>
                    </div>
                    <p className={`text-sm font-semibold mt-1 ${txt}`}>{f.clientName}</p>
                    <p className={`text-xs ${sub}`}><Phone className="w-3 h-3 inline" /> {f.phone} | <MapPin className="w-3 h-3 inline" /> {f.destination}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                        <div className={`h-full rounded-full transition-all ${prog.percent === 100 ? "bg-emerald-500" : prog.percent > 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${prog.percent}%` }} />
                      </div>
                      <span className={`text-[10px] font-bold ${prog.percent === 100 ? "text-emerald-500" : sub}`}>📄 {prog.checked}/{prog.total}</span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""} ${sub}`} />
                    </div>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className={`px-3 sm:px-4 pb-3 sm:pb-4 pt-1 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                      <p className={`text-xs font-bold mb-2 flex items-center gap-1 ${txt}`}>
                        <Clipboard className="w-3.5 h-3.5" /> {u("Document Checklist", "کاغزات کی فہرست")}
                      </p>
                      <div className="space-y-1.5">
                        {requiredDocs.map(doc => {
                          const isChecked = !!docChecklist[f.id]?.[doc.id];
                          return (
                            <motion.button key={doc.id} whileTap={{ scale: 0.97 }} onClick={() => toggleDoc(f.id, doc.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[44px] transition-all ${
                                isChecked
                                  ? dc ? "bg-emerald-900/20 text-emerald-400 border border-emerald-700/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : dc ? "bg-gray-700/50 text-gray-300 border border-gray-600/50" : "bg-gray-50 text-gray-600 border border-gray-200"
                              }`}>
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isChecked ? "bg-emerald-500 text-white" : dc ? "bg-gray-600" : "bg-gray-200"}`}>
                                {isChecked && <Check className="w-4 h-4" />}
                              </div>
                              <span className={`font-medium ${isChecked ? "line-through opacity-70" : ""}`}>
                                {isChecked ? "☑" : "☐"} {u(doc.en, doc.ur)}
                              </span>
                              {!isChecked && (
                                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"}`}>
                                  {u("Missing", "نامکمل")} ⚠️
                                </span>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                      {prog.percent < 100 && (
                        <>
                          <div className={`mt-3 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${dc ? "bg-amber-900/20 text-amber-400 border border-amber-700/30" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {u(`${prog.total - prog.checked} documents still missing`, `${prog.total - prog.checked} کاغزات ابھی باقی ہیں`)}
                          </div>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => flagMissing(f.id, f.clientName)}
                            className={`mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold min-h-[48px] ${
                              dc ? "bg-amber-700/30 text-amber-300 border border-amber-600/40" : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}>
                            <Flag className="w-4 h-4" /> {u("Flag Missing for Admin", "ایڈمن کو نامکمل کاغزات کی اطلاع دیں")}
                          </motion.button>
                        </>
                      )}
                      {prog.percent === 100 && (
                        <div className={`mt-3 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${dc ? "bg-emerald-900/20 text-emerald-400 border border-emerald-700/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {u("All documents complete!", "تمام کاغزات مکمل ہیں!")} ✅
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// STATUS CONFIRMATION (with Modal + Push Notify)
// ═══════════════════════════════════════════════════════════
// 14-stage workflow order (matches mockData.ts status type)
const STAGE_ORDER: { id: string; en: string; ur: string; stageNum: number }[] = [
  { id: "document_collection", en: "Document Collection", ur: "کاغزات جمع", stageNum: 1 },
  { id: "selection_call", en: "Selection Call", ur: "سلیکشن کال", stageNum: 2 },
  { id: "medical_token", en: "Medical Token", ur: "میڈیکل ٹوکن", stageNum: 3 },
  { id: "check_medical", en: "Check Medical", ur: "میڈیکل چیک", stageNum: 4 },
  { id: "biometric", en: "Biometric", ur: "بایومیٹرک", stageNum: 5 },
  { id: "payment_confirmation", en: "Payment Confirmation", ur: "ادائیگی تصدیق", stageNum: 6 },
  { id: "e_number_issued", en: "E-Number Issued", ur: "ای نمبر جاری", stageNum: 7 },
  { id: "original_documents", en: "Original Documents", ur: "اصل کاغزات", stageNum: 8 },
  { id: "protector", en: "Protector", ur: "پروٹیکٹر", stageNum: 9 },
  { id: "submitted_to_manager", en: "Submitted to Manager", ur: "مینیجر کو بھیجا", stageNum: 10 },
  { id: "approved", en: "Approved", ur: "منظور", stageNum: 11 },
  { id: "remaining_amount", en: "Remaining Amount", ur: "باقی رقم", stageNum: 12 },
  { id: "ticket_booking", en: "Ticket Booking", ur: "ٹکٹ بکنگ", stageNum: 13 },
  { id: "completed", en: "Completed", ur: "مکمل", stageNum: 14 },
];

export function StatusSection({ u, dc, card, txt, sub, bigBtn, cases, addNotification, onCaseUpdated }: any) {
  const [confirmedIds, setConfirmedIds] = useState<string[]>(() => load("emr-op-confirmed", []));
  const [filterPending, setFilterPending] = useState(false);
  const [confirmModal, setConfirmModal] = useState<Case | null>(null);
  const [flagModal, setFlagModal] = useState<Case | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [statusChangeModal, setStatusChangeModal] = useState<Case | null>(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState<string>("");

  const statusColors: Record<string, { bg: string; text: string; label: string; labelUr: string }> = {
    document_collection: { bg: "bg-blue-500", text: "text-blue-600", label: "Documents", labelUr: "کاغزات" },
    selection_call: { bg: "bg-cyan-500", text: "text-cyan-600", label: "Selection Call", labelUr: "سلیکشن کال" },
    medical_token: { bg: "bg-yellow-500", text: "text-yellow-600", label: "Medical", labelUr: "میڈیکل" },
    check_medical: { bg: "bg-yellow-500", text: "text-yellow-600", label: "Medical Check", labelUr: "میڈیکل چیک" },
    biometric: { bg: "bg-purple-500", text: "text-purple-600", label: "Biometric", labelUr: "بایومیٹرک" },
    payment_confirmation: { bg: "bg-green-500", text: "text-green-600", label: "Payment", labelUr: "ادائیگی" },
    e_number_issued: { bg: "bg-teal-500", text: "text-teal-600", label: "E-Number", labelUr: "ای نمبر" },
    original_documents: { bg: "bg-indigo-500", text: "text-indigo-600", label: "Originals", labelUr: "اصل کاغزات" },
    protector: { bg: "bg-orange-500", text: "text-orange-600", label: "Protector", labelUr: "پروٹیکٹر" },
    submitted_to_manager: { bg: "bg-pink-500", text: "text-pink-600", label: "Manager", labelUr: "مینیجر" },
    approved: { bg: "bg-lime-500", text: "text-lime-600", label: "Approved", labelUr: "منظور" },
    remaining_amount: { bg: "bg-rose-500", text: "text-rose-600", label: "Balance", labelUr: "باقی رقم" },
    ticket_booking: { bg: "bg-sky-500", text: "text-sky-600", label: "Ticket", labelUr: "ٹکٹ" },
    completed: { bg: "bg-emerald-500", text: "text-emerald-600", label: "Completed", labelUr: "مکمل" },
    rejected: { bg: "bg-red-500", text: "text-red-600", label: "Rejected", labelUr: "مسترد" },
  };
  const getStatus = (s: string) => statusColors[s] || { bg: "bg-gray-500", text: "text-gray-600", label: s, labelUr: s };
  const displayCases = filterPending ? cases.filter((c: Case) => !confirmedIds.includes(c.id)) : cases;

  // Get available next stages for a case
  const getNextStages = (currentStatus: string) => {
    const currentIdx = STAGE_ORDER.findIndex(s => s.id === currentStatus);
    if (currentIdx === -1) return STAGE_ORDER; // unknown status, show all
    // Allow moving forward up to 3 stages or backward 1 stage
    const minIdx = Math.max(0, currentIdx - 1);
    const maxIdx = Math.min(STAGE_ORDER.length - 1, currentIdx + 3);
    return STAGE_ORDER.slice(minIdx, maxIdx + 1).filter(s => s.id !== currentStatus);
  };

  const doStatusChange = async (c: Case) => {
    if (!selectedNewStatus) { toast.error(u("Select a status", "صورتحال منتخب کریں")); return; }
    const stageInfo = STAGE_ORDER.find(s => s.id === selectedNewStatus);
    if (!stageInfo) return;

    await updateCase(c.id, {
      status: selectedNewStatus as Case["status"],
      currentStage: stageInfo.stageNum,
      stageStartedAt: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      isOverdue: false,
    });

    const { data } = await supabase.from('cases').select('*').eq('id', c.id).single();
    const refreshed = data ? mapSupabaseCaseToLocal(data) : null;

    const oldSt = getStatus(c.status);
    const newSt = getStatus(selectedNewStatus);
    addNotification(
      `Status Changed: ${c.id} ${oldSt.label} → ${newSt.label} by Operator`,
      `صورتحال تبدیل: ${c.id} ${oldSt.labelUr} → ${newSt.labelUr} آپریٹر نے کی`,
      "status"
    );
    toast.success(u(`✅ ${c.id} status changed to ${newSt.label}`, `✅ ${c.id} کی صورتحال ${newSt.labelUr} ہو گئی`));
    setStatusChangeModal(null);
    setSelectedNewStatus("");
    // Notify parent to refresh cases
    if (onCaseUpdated) onCaseUpdated();
  };

  const doConfirm = (c: Case) => {
    const updated = [...confirmedIds, c.id];
    setConfirmedIds(updated);
    save("emr-op-confirmed", updated);
    setConfirmModal(null);
    const st = getStatus(c.status);
    addNotification(`Status Verified: ${c.id} ${st.label} Confirmed → Admin Notified`, `صورتحال تصدیق: ${c.id} ${st.labelUr} تصدیق ہو گئی → ایڈمن کو اطلاع`, "status");
    toast.success(u("✅ Confirmed! Admin notified.", "✅ تصدیق ہو گئی! ایڈمن کو اطلاع دے دی۔"));
  };

  const doFlag = (c: Case) => {
    const reason = flagReason || u("Needs attention", "توجہ ضروری ہے");
    addNotification(`Flag: ${c.id} ${c.customerName} — ${reason}`, `خبردار: ${c.id} ${c.customerName} — ${reason}`, "flag");
    setFlagModal(null);
    setFlagReason("");
    toast.success(u("⚠️ Flagged! Admin notified.", "⚠️ خبردار! ایڈمن کو اطلاع دے دی۔"));
  };

  const flagReasons = [
    { en: "Documents missing", ur: "کاغزات نامکمل" },
    { en: "Payment overdue", ur: "ادائیگی تاخیر" },
    { en: "Client not responding", ur: "کلائنٹ جواب نہیں دے رہا" },
    { en: "Deadline passed", ur: "آخری تاریخ گزر گئی" },
    { en: "Other issue", ur: "دوسرا مسئلہ" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
              className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${dc ? "bg-gray-800" : "bg-white"}`}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className={`text-lg font-bold mb-1 ${txt}`}>{u("Confirm Status?", "صورتحال کی تصدیق کریں؟")}</h3>
                <p className={`text-sm mb-1 ${sub}`}>{confirmModal.id} — {confirmModal.customerName}</p>
                <p className={`text-xs mb-4 px-3 py-1 inline-block rounded-full ${dc ? "bg-gray-700" : "bg-gray-100"} ${getStatus(confirmModal.status).text}`}>
                  {u(getStatus(confirmModal.status).label, getStatus(confirmModal.status).labelUr)}
                </p>
                <p className={`text-xs mb-5 ${sub}`}>{u("Admin will receive a push notification.", "ایڈمن کو فوری اطلاع بھیجی جائے گی۔")}</p>
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => doConfirm(confirmModal)}
                    className={`${bigBtn} flex-1 bg-emerald-600 text-white !py-3 !min-h-[48px]`}>
                    <Check className="w-4 h-4" /> {u("Yes, Confirm", "ہاں، تصدیق کریں")}
                  </motion.button>
                  <button onClick={() => setConfirmModal(null)}
                    className={`flex-1 py-3 rounded-xl font-medium ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                    {u("Cancel", "واپس")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flag Modal */}
      <AnimatePresence>
        {flagModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => { setFlagModal(null); setFlagReason(""); }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
              className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${dc ? "bg-gray-800" : "bg-white"}`}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <Flag className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className={`text-lg font-bold mb-1 ${txt}`}>{u("Flag Issue", "مسئلہ کی اطلاع دیں")}</h3>
                <p className={`text-sm mb-4 ${sub}`}>{flagModal.id} — {flagModal.customerName}</p>
                <div className="space-y-2 mb-4">
                  {flagReasons.map(r => (
                    <button key={r.en} onClick={() => setFlagReason(r.en)}
                      className={`w-full text-start px-4 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-all ${
                        flagReason === r.en ? "bg-amber-500 text-white" : dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                      }`}>
                      {u(r.en, r.ur)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => doFlag(flagModal)}
                    className={`${bigBtn} flex-1 bg-amber-500 text-white !py-3 !min-h-[48px]`}>
                    <Flag className="w-4 h-4" /> {u("Send Flag", "اطلاع بھیجیں")}
                  </motion.button>
                  <button onClick={() => { setFlagModal(null); setFlagReason(""); }}
                    className={`flex-1 py-3 rounded-xl font-medium ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                    {u("Cancel", "واپس")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Change Modal */}
      <AnimatePresence>
        {statusChangeModal && (() => {
          const nextStages = getNextStages(statusChangeModal.status);
          const currentStage = STAGE_ORDER.find(s => s.id === statusChangeModal.status);
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => { setStatusChangeModal(null); setSelectedNewStatus(""); }}>
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
                className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${dc ? "bg-gray-800" : "bg-white"}`}>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-4">
                    <ArrowUpDown className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className={`text-lg font-bold mb-1 ${txt}`}>{u("Change Status", "صورتحال تبدیل کریں")}</h3>
                  <p className={`text-sm mb-1 ${sub}`}>{statusChangeModal.id} — {statusChangeModal.customerName}</p>
                  <p className={`text-xs mb-4 px-3 py-1 inline-block rounded-full ${dc ? "bg-gray-700" : "bg-gray-100"} ${getStatus(statusChangeModal.status).text}`}>
                    {u("Current", "موجودہ")}: {u(getStatus(statusChangeModal.status).label, getStatus(statusChangeModal.status).labelUr)}
                    {currentStage ? ` (${currentStage.stageNum}/14)` : ""}
                  </p>
                  <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
                    {nextStages.map(stage => {
                      const isSelected = selectedNewStatus === stage.id;
                      const stColor = getStatus(stage.id);
                      const currentIdx = STAGE_ORDER.findIndex(s => s.id === statusChangeModal.status);
                      const stageIdx = STAGE_ORDER.findIndex(s => s.id === stage.id);
                      const isForward = stageIdx > currentIdx;
                      return (
                        <button key={stage.id} onClick={() => setSelectedNewStatus(stage.id)}
                          className={`w-full text-start px-4 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-all flex items-center gap-3 ${
                            isSelected ? "bg-blue-600 text-white ring-2 ring-blue-400" : dc ? "bg-gray-700 text-gray-300" : "bg-gray-50 text-gray-600 border border-gray-200"
                          }`}>
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${stColor.bg}`} />
                          <span className="flex-1">{u(stage.en, stage.ur)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            isSelected ? "bg-white/20 text-white" : isForward ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {isForward ? `↑ ${stage.stageNum}` : `← ${stage.stageNum}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-3">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => doStatusChange(statusChangeModal)}
                      disabled={!selectedNewStatus}
                      className={`${bigBtn} flex-1 !py-3 !min-h-[48px] ${selectedNewStatus ? "bg-blue-600 text-white" : "bg-gray-400 text-gray-200 cursor-not-allowed"}`}>
                      <ArrowUpDown className="w-4 h-4" /> {u("Change", "تبدیل کریں")}
                    </motion.button>
                    <button onClick={() => { setStatusChangeModal(null); setSelectedNewStatus(""); }}
                      className={`flex-1 py-3 rounded-xl font-medium ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                      {u("Cancel", "واپس")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <div className="flex gap-2">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setFilterPending(!filterPending)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm min-h-[48px] ${
            filterPending ? "bg-amber-500 text-white" : dc ? "bg-gray-800 text-gray-300 border border-gray-700" : "bg-white text-gray-600 border border-gray-200"
          }`}>
          <Clock className="w-4 h-4" /> {u("Pending Only", "صرف باقی")}
        </motion.button>
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${dc ? "bg-gray-800 text-gray-300" : "bg-white text-gray-600"} border ${dc ? "border-gray-700" : "border-gray-200"}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {confirmedIds.length}/{cases.length} {u("confirmed", "تصدیق شدہ")}
        </div>
      </div>

      <div className="space-y-2">
        {displayCases.map((c: Case) => {
          const s = getStatus(c.status);
          const isConfirmed = confirmedIds.includes(c.id);
          return (
            <div key={c.id} className={`rounded-xl border p-3 sm:p-4 ${card} ${isConfirmed ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${s.bg}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-mono ${dc ? "text-gray-400" : "text-gray-500"}`}>{c.id}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${dc ? "bg-gray-700" : "bg-gray-100"} ${s.text}`}>{u(s.label, s.labelUr)}</span>
                  </div>
                  <p className={`text-sm font-semibold ${txt}`}>{c.customerName}</p>
                </div>
                {isConfirmed ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium"><CheckCircle2 className="w-4 h-4" /> {u("Done", "ہو گیا")}</span>
                    {c.status !== "completed" && c.status !== "rejected" && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setStatusChangeModal(c)}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold min-h-[32px] ${dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                        <ArrowUpDown className="w-3 h-3" />
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setConfirmModal(c)}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold min-h-[44px]">
                      <Check className="w-4 h-4" /> {u("OK", "تصدیق")}
                    </motion.button>
                    {c.status !== "completed" && c.status !== "rejected" && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setStatusChangeModal(c)}
                        className={`flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-sm font-bold min-h-[44px] ${dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                        <ArrowUpDown className="w-4 h-4" />
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setFlagModal(c)}
                      className={`flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-bold min-h-[44px] ${dc ? "bg-amber-700/30 text-amber-300" : "bg-amber-100 text-amber-700"}`}>
                      <Flag className="w-4 h-4" />
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// PAYMENTS (with Receipt Upload + Supabase Visual)
// ═══════════════════════════════════════════════════════════
export function PaymentsSection({ u, dc, card, txt, sub, inputCls, bigBtn, cases, addNotification }: any) {
  const [payments, setPayments] = useState<PaymentRecord[]>(() => load(STORAGE.payments, []));
  const [showForm, setShowForm] = useState(false);
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [filter, setFilter] = useState<"today" | "week" | "month">("today");
  const [showCasePayments, setShowCasePayments] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const methods = ["Cash", "EasyPaisa", "JazzCash", "Bank"];

  const filtered = payments.filter(p => {
    const d = new Date(p.timestamp);
    const now = new Date();
    if (filter === "today") return p.timestamp.startsWith(today);
    if (filter === "week") return now.getTime() - d.getTime() < 7 * 86400000;
    return now.getTime() - d.getTime() < 30 * 86400000;
  });

  const casePayments = cases.flatMap((c: Case) =>
    (c.payments || []).map((p: any) => ({ ...p, customerName: c.customerName, caseId: c.id }))
  );

  const realUpload = async (paymentId: string, file: File) => {
    setUploadingId(paymentId);
    setUploadProgress(0);
    try {
      const result = await uploadFile(
        `receipts/${paymentId}`,
        file.name || `receipt-${Date.now()}.jpg`,
        file,
        (pct) => setUploadProgress(pct)
      );
      if (result.success && result.path) {
        // Get a signed URL for preview
        const urlResult = await getSignedUrl(`receipts/${paymentId}`, file.name || `receipt-${Date.now()}.jpg`);
        const previewUrl = urlResult.signedUrl || URL.createObjectURL(file);
        const updated = payments.map(p => p.id === paymentId ? { ...p, receiptPhoto: previewUrl, storagePath: result.path, uploadProgress: 100 } : p);
        setPayments(updated);
        save(STORAGE.payments, updated);
        addNotification(`Receipt uploaded for ${paymentId}`, `${paymentId} کی رسید اپ لوڈ ہو گئی`, "payment");
        toast.success(u("✅ Receipt saved in Supabase Storage!", "✅ رسید سپابیس سٹوریج میں محفوظ ہو گئی!"));
      } else {
        // Fallback: save local preview URL
        const previewUrl = URL.createObjectURL(file);
        const updated = payments.map(p => p.id === paymentId ? { ...p, receiptPhoto: previewUrl, uploadProgress: 100 } : p);
        setPayments(updated);
        save(STORAGE.payments, updated);
        toast.warning(u("⚠️ Saved locally (cloud upload failed)", "⚠️ مقامی طور پر محفوظ (کلاؤڈ ناکام)"));
      }
    } catch (err) {
      const previewUrl = URL.createObjectURL(file);
      const updated = payments.map(p => p.id === paymentId ? { ...p, receiptPhoto: previewUrl, uploadProgress: 100 } : p);
      setPayments(updated);
      save(STORAGE.payments, updated);
      toast.warning(u("⚠️ Saved locally (network error)", "⚠️ مقامی طور پر محفوظ (نیٹ ورک خرابی)"));
    } finally {
      setUploadingId(null);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (paymentId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error(u("File too large (max 10MB)", "فائل بہت بڑی ہے (زیادہ سے زیادہ 10MB)")); return; }
    realUpload(paymentId, file);
  };

  const handleNewReceiptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleAdd = () => {
    if (!client.trim() || !amount.trim()) { toast.error(u("Fill required fields", "ضروری خانے بھریں")); return; }
    const rcpt = `RCP-${Date.now().toString(36).toUpperCase()}`;
    const record: PaymentRecord = { id: `PAY-${Date.now()}`, clientName: client.trim(), amount: Number(amount), method, receiptNumber: rcpt, receiptPhoto: null, uploadProgress: 0, timestamp: new Date().toISOString() };
    const updated = [record, ...payments];
    setPayments(updated);
    save(STORAGE.payments, updated);
    if (newReceiptFile) setTimeout(() => realUpload(record.id, newReceiptFile), 300);
    setClient(""); setAmount(""); setNewReceiptFile(null); setReceiptPreview(null);
    setShowForm(false);
    toast.success(`${u("Payment recorded!", "ادائیگی درج ہو گئی!")} ${rcpt}`);
  };

  const totalFiltered = filtered.reduce((s, p) => s + p.amount, 0);

  const exportPaymentsCSV = () => {
    const header = "Date,Client,Amount,Method,Receipt Number,Has Receipt Photo\n";
    const rows = payments.map(p =>
      `${new Date(p.timestamp).toLocaleDateString("en-US")},${p.clientName},${p.amount},${p.method},${p.receiptNumber},${p.receiptPhoto ? "Yes" : "No"}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payments-${today}.csv`; a.click();
    toast.success(u("Payments CSV downloaded!", "ادائیگیاں CSV ڈاؤنلوڈ ہو گئی!"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowForm(!showForm)}
        className={`${bigBtn} w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white`}>
        <DollarSign className="w-5 h-5" /> {u("+ Record Payment", "+ ادائیگی درج کریں")}
      </motion.button>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`rounded-2xl border p-4 space-y-3 overflow-hidden ${card}`}>
            <input value={client} onChange={e => setClient(e.target.value)} placeholder={u("Client Name *", "نام *")} className={inputCls} />
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={u("Amount (PKR) *", "رقم (PKR) *")} className={inputCls} dir="ltr" />
            <div className="flex flex-wrap gap-2">
              {methods.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ${method === m ? "bg-emerald-600 text-white" : dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                  {m === "Cash" ? "💵" : m === "EasyPaisa" ? "📱" : m === "JazzCash" ? "📲" : "🏦"} {m}
                </button>
              ))}
            </div>
            {/* Receipt Upload */}
            <div className={`rounded-xl border-2 border-dashed p-4 text-center ${dc ? "border-gray-600 bg-gray-700/30" : "border-gray-300 bg-gray-50"}`}>
              {receiptPreview ? (
                <div className="space-y-2">
                  <img src={receiptPreview} alt="Receipt" className="w-24 h-24 object-cover rounded-xl mx-auto" />
                  <p className="text-xs font-medium text-emerald-500"><Lock className="w-3 h-3 inline" /> {u("Encrypted Storage", "محفوظ سٹوریج")} ☁️</p>
                  <button onClick={() => { setNewReceiptFile(null); setReceiptPreview(null); }} className="text-xs text-red-500 font-medium">{u("Remove", "ہٹائیں")}</button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" capture="environment" onChange={handleNewReceiptFile} className="hidden" />
                  <Camera className={`w-8 h-8 mx-auto ${sub}`} />
                  <p className={`text-sm font-medium mt-1 ${txt}`}>📸 {u("Upload Receipt", "رسید اپ لوڈ کریں")}</p>
                  <p className={`text-[10px] ${sub}`}><Lock className="w-3 h-3 inline" /> {u("Secure Supabase Storage", "محفوظ سپابیس سٹوریج")}</p>
                </label>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdd} className={`${bigBtn} w-full bg-emerald-600 text-white`}>
              <Check className="w-5 h-5" /> {u("Save", "محفوظ کریں")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 flex-wrap">
        {(["today", "week", "month"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium min-h-[36px] ${filter === f ? "bg-emerald-600 text-white" : dc ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-white text-gray-500 border border-gray-200"}`}>
            {f === "today" ? u("Today", "آج") : f === "week" ? u("This Week", "اس ہفتے") : u("This Month", "اس مہینے")}
          </button>
        ))}
        <div className={`ml-auto flex items-center gap-2`}>
          <span className={`text-sm font-bold ${txt}`}>{u("Total", "کل")}: <span className="text-emerald-600">PKR {totalFiltered.toLocaleString()}</span></span>
          {payments.length > 0 && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={exportPaymentsCSV}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
              <Download className="w-3 h-3" /> CSV
            </motion.button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className={`text-center py-4 ${sub}`}>{u("No payments recorded", "کوئی ادائیگی نہیں")}</p>
        ) : filtered.map(p => (
          <div key={p.id} className={`rounded-xl border p-3 sm:p-4 ${card}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${dc ? "bg-emerald-900/30" : "bg-emerald-100"}`}>
                {p.receiptPhoto ? <img src={p.receiptPhoto} alt="R" className="w-10 h-10 rounded-xl object-cover cursor-pointer hover:ring-2 hover:ring-emerald-500 transition" onClick={(e) => { e.stopPropagation(); setLightboxSrc(p.receiptPhoto); setLightboxAlt(`${p.clientName} — ${p.receiptNumber}`); }} /> : <DollarSign className="w-5 h-5 text-emerald-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${txt}`}>{p.clientName}</p>
                <p className={`text-xs ${sub}`}>{p.method} — {new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                <p className={`text-[10px] font-mono ${sub}`}>{p.receiptNumber}</p>
                {uploadingId === p.id && (
                  <div className="mt-1.5">
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                      <motion.div animate={{ width: `${uploadProgress}%` }} className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
                    </div>
                    <p className={`text-[10px] mt-0.5 ${sub} flex items-center gap-1`}>
                      <Cloud className="w-3 h-3 text-blue-400" /> ☁️ {Math.round(uploadProgress)}% {u("uploading...", "اپ لوڈ ہو رہا ہے...")}
                    </p>
                  </div>
                )}
                {p.receiptPhoto && <p className="text-[10px] mt-0.5 text-emerald-500 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {u("Uploaded to Bucket: receipts", "بکٹ: receipts میں محفوظ")}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-base font-bold text-emerald-600">PKR {p.amount.toLocaleString()}</p>
                {!p.receiptPhoto && uploadingId !== p.id && (
                  <label className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" capture="environment" onChange={handleFileSelect(p.id)} className="hidden" />
                    <Camera className="w-3 h-3" /> {u("Upload", "اپ لوڈ")}
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border ${card} overflow-hidden`}>
        <button onClick={() => setShowCasePayments(!showCasePayments)} className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold ${txt}`}>
          <span className="flex items-center gap-2"><Eye className="w-4 h-4 text-blue-500" /> {u("Case Payment History", "کیس ادائیگی کی تاریخ")} ({casePayments.length})</span>
          <ChevronRight className={`w-4 h-4 transition-transform ${showCasePayments ? "rotate-90" : ""} ${sub}`} />
        </button>
        <AnimatePresence>
          {showCasePayments && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className={`px-3 pb-3 space-y-2 border-t ${dc ? "border-gray-700" : "border-gray-200"} pt-2`}>
                {casePayments.length === 0 ? (
                  <p className={`text-center py-4 text-xs ${sub}`}>{u("No case payments", "کوئی کیس ادائیگی نہیں")}</p>
                ) : casePayments.map((p: any, idx: number) => (
                  <div key={`cp-${idx}`} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${txt}`}>{p.customerName} <span className={`font-mono ${sub}`}>({p.caseId})</span></p>
                      <p className={`text-[10px] ${sub}`}>{p.method} — {p.date} — {p.receiptNumber}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600">PKR {p.amount?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Receipt Image Lightbox */}
      <ImageLightbox src={lightboxSrc} alt={lightboxAlt} onClose={() => setLightboxSrc(null)} />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════
export function ReportsSection({ u, dc, card, txt, sub, bigBtn, cases, allStaff, addNotification }: any) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [reportHistory, setReportHistory] = useState<{ id: string; date: string; type: string }[]>(() => load("emr-op-report-history", []));

  const today = new Date().toISOString().split("T")[0];
  const confirmedIds: string[] = load("emr-op-confirmed", []);
  const attendance: AttendanceEntry[] = load(STORAGE.attendance, []);
  const payments: PaymentRecord[] = load(STORAGE.payments, []);
  const visits: OfficeVisit[] = load(STORAGE.visits, []);
  const todayAttendance = attendance.filter(a => a.date === today);
  const todayPayments = payments.filter(p => p.timestamp.startsWith(today));
  const todayVisits = visits.filter(v => v.timestamp.startsWith(today));

  const generateReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const reportEN = `📊 EMERALD VISA CRM — Daily Report\n📅 ${dateStr}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📁 Cases:\n  • Total Active: ${cases.length}\n  • Confirmed Today: ${confirmedIds.length}\n  • Overdue: ${cases.filter((c: Case) => c.isOverdue).length}\n\n👥 Attendance:\n  • Present: ${todayAttendance.filter(a => a.status === "present").length}\n  • Late: ${todayAttendance.filter(a => a.status === "late").length}\n  • Absent: ${todayAttendance.filter(a => a.status === "absent").length}\n\n💰 Payments:\n  • Recorded Today: ${todayPayments.length}\n  • Total: PKR ${todayPayments.reduce((s, p) => s + p.amount, 0).toLocaleString()}\n\n🏢 Office Visits: ${todayVisits.length}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nGenerated by Computer Operator\nTime: ${now.toLocaleTimeString("en-US")}`;
      const reportUR = `📊 ایمرالڈ ویزا CRM — روزانہ رپورٹ\n📅 ${dateStr}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📁 کیسز:\n  • کل ایکٹیو: ${cases.length}\n  • آج تصدیق شدہ: ${confirmedIds.length}\n  • تاخیر: ${cases.filter((c: Case) => c.isOverdue).length}\n\n👥 حاضری:\n  • حاضر: ${todayAttendance.filter(a => a.status === "present").length}\n  • دیر سے: ${todayAttendance.filter(a => a.status === "late").length}\n  • غیر حاضر: ${todayAttendance.filter(a => a.status === "absent").length}\n\n💰 ادائیگیاں:\n  • آج درج: ${todayPayments.length}\n  • کل رقم: PKR ${todayPayments.reduce((s, p) => s + p.amount, 0).toLocaleString()}\n\n🏢 آفس وزٹ: ${todayVisits.length}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nکمپیوٹر آپریٹر کی رپورٹ\nوقت: ${now.toLocaleTimeString("en-US")}`;
      setGeneratedReport(u(reportEN, reportUR));
      setIsGenerating(false);
    }, 1500);
  };

  const downloadReport = () => {
    if (!generatedReport) return;
    const blob = new Blob([generatedReport], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `emerald-report-${today}.txt`; a.click();
    const entry = { id: `RPT-${Date.now()}`, date: today, type: "Download" };
    setReportHistory(prev => { const u = [entry, ...prev].slice(0, 30); save("emr-op-report-history", u); return u; });
    toast.success(u("Report downloaded!", "رپورٹ ڈاؤنلوڈ ہو گئی!"));
  };

  const sendWhatsApp = () => {
    if (!generatedReport) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(generatedReport)}`, "_blank");
    addNotification("Daily report sent via WhatsApp", "روزانہ رپورٹ واٹس ایپ سے بھیجی گئی", "report");
    toast.success(u("Opening WhatsApp...", "واٹس ایپ کھل رہا ہے..."));
  };

  const copyReport = () => {
    if (!generatedReport) return;
    copyToClipboard(generatedReport).then(() => toast.success(u("Report copied!", "رپورٹ کاپی ہو گئی!"))).catch(() => toast.error(u("Copy failed", "کاپی نہیں ہو سکا")));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      <motion.button whileTap={{ scale: 0.97 }} onClick={generateReport} disabled={isGenerating}
        className={`${bigBtn} w-full ${isGenerating ? "bg-gray-500 cursor-wait" : "bg-gradient-to-r from-blue-600 to-indigo-600"} text-white`}>
        {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> {u("Generating...", "رپورٹ بن رہی ہے...")}</> : <><BarChart3 className="w-5 h-5" /> {u("Generate Daily Report", "روزانہ رپورٹ بنائیں")}</>}
      </motion.button>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: u("Cases", "کیسز"), value: cases.length, emoji: "📁" },
          { label: u("Confirmed", "تصدیق"), value: confirmedIds.length, emoji: "✅" },
          { label: u("Payments", "ادائیگیاں"), value: todayPayments.length, emoji: "💰" },
          { label: u("Visits", "وزٹ"), value: todayVisits.length, emoji: "🏢" },
        ].map((s, i) => (
          <div key={i} className={`rounded-xl border p-3 text-center ${card}`}>
            <span className="text-xl">{s.emoji}</span>
            <p className={`text-xl font-bold ${txt}`}>{s.value}</p>
            <p className={`text-[10px] ${sub}`}>{s.label}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {generatedReport && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border overflow-hidden ${card}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <h3 className={`text-sm font-bold ${txt}`}>📋 {u("Report Preview", "رپورٹ کا جائزہ")}</h3>
            </div>
            <pre className={`px-4 py-3 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto ${txt} ${dc ? "bg-gray-900/50" : "bg-gray-50"}`}>
              {generatedReport}
            </pre>
            <div className="flex gap-2 p-3 flex-wrap">
              <motion.button whileTap={{ scale: 0.95 }} onClick={sendWhatsApp} className={`${bigBtn} flex-1 bg-green-600 text-white !py-3 !min-h-[48px]`}>
                <Send className="w-4 h-4" /> WhatsApp
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={downloadReport} className={`${bigBtn} flex-1 bg-blue-600 text-white !py-3 !min-h-[48px]`}>
                <FileDown className="w-4 h-4" /> {u("Download", "ڈاؤنلوڈ")}
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={copyReport}
                className={`${bigBtn} flex-1 !py-3 !min-h-[48px] ${dc ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"}`}>
                <Clipboard className="w-4 h-4" /> {u("Copy", "کاپی")}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {reportHistory.length > 0 && (
        <div className={`rounded-xl border ${card} overflow-hidden`}>
          <div className={`px-4 py-3 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
            <h3 className={`text-sm font-bold ${txt}`}>📄 {u("Report History (Last 30 Days)", "رپورٹ کی تاریخ (آخری 30 دن)")}</h3>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {reportHistory.map((r: any) => (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 border-b ${dc ? "border-gray-700/50" : "border-gray-100"}`}>
                <FileDown className={`w-4 h-4 ${sub}`} />
                <span className={`text-xs font-medium ${txt}`}>{r.date}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"}`}>{r.type}</span>
                <span className={`text-[10px] font-mono ml-auto ${sub}`}>{r.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// ALL CASES SECTION — cross-portal case viewer with filters
// ═══════════════════════════════════════════════════════════
export function AllCasesSection({ u, dc, card, txt, sub, inputCls, bigBtn, cases, agents }: any) {
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "status">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const statusLabels: Record<string, { en: string; ur: string; color: string }> = {
    document_collection: { en: "Document Collection", ur: "کاغزات جمع", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    selection_call: { en: "Selection Call", ur: "سلیکشن کال", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    medical_token: { en: "Medical Token", ur: "میڈیکل ٹوکن", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    check_medical: { en: "Check Medical", ur: "میڈیکل چیک", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
    biometric: { en: "Biometric", ur: "بائیو میٹرک", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
    payment_confirmation: { en: "Payment Confirm", ur: "ادائیگی تصدیق", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    original_documents: { en: "Original Docs", ur: "اصل کاغزات", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
    submitted_to_manager: { en: "Submitted to Manager", ur: "مینیجر کو بھیجا", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
    approved: { en: "Approved", ur: "منظور", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    remaining_amount: { en: "Remaining Amount", ur: "بقایا رقم", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
    ticket_booking: { en: "Ticket Booking", ur: "ٹکٹ بکنگ", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
    completed: { en: "Completed", ur: "مکمل", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" },
    rejected: { en: "Rejected", ur: "مسترد", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
    e_number_issued: { en: "E-Number Issued", ur: "ای نمبر جاری", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
    protector: { en: "Protector", ur: "پروٹیکٹر", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  };

  const allStatuses = Object.keys(statusLabels);

  const filtered = (cases as Case[]).filter(c => {
    if (search && !c.customerName.toLowerCase().includes(search.toLowerCase()) && !c.id.toLowerCase().includes(search.toLowerCase()) && !c.phone.includes(search)) return false;
    if (filterAgent !== "all" && c.agentName !== filterAgent) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterPriority !== "all" && c.priority !== filterPriority) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "date") return dir * (new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());
    if (sortBy === "name") return dir * a.customerName.localeCompare(b.customerName);
    return dir * a.status.localeCompare(b.status);
  });

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("desc"); }
  };

  const priorityBadge = (p: string) => {
    const colors: Record<string, string> = {
      low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
      medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
      urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    };
    return colors[p] || colors.medium;
  };

  const brd = dc ? "border-gray-700" : "border-gray-200";

  if (selectedCase) {
    const c = selectedCase;
    const sl = statusLabels[c.status] || { en: c.status, ur: c.status, color: "bg-gray-100 text-gray-600" };
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        <button onClick={() => setSelectedCase(null)} className={`flex items-center gap-2 text-sm font-medium ${dc ? "text-emerald-400" : "text-emerald-600"} mb-2`}>
          <ChevronRight className="w-4 h-4 rotate-180" /> {u("Back to All Cases", "تمام کیسز پر واپس")}
        </button>
        <div className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className={`text-xl font-bold ${txt}`}>{c.customerName}</h2>
              <p className={`text-xs font-mono ${sub}`}>{c.id}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${sl.color}`}>{u(sl.en, sl.ur)}</span>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${priorityBadge(c.priority)}`}>{c.priority.toUpperCase()}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {[
              [u("Father", "والد"), c.fatherName], [u("Phone", "فون"), c.phone],
              [u("Email", "ای میل"), c.email], [u("CNIC", "شناختی کارڈ"), c.cnic],
              [u("Passport", "پاسپورٹ"), c.passport], [u("DOB", "تاریخ پیدائش"), c.dateOfBirth],
              [u("City", "شہر"), c.city], [u("Country", "ملک"), c.country],
              [u("Job", "ملازمت"), c.jobType], [u("Agent", "ایجنٹ"), c.agentName],
              [u("Total Fee", "کل فیس"), `PKR ${c.totalFee.toLocaleString()}`],
              [u("Paid", "ادا شدہ"), `PKR ${c.paidAmount.toLocaleString()}`],
              [u("Stage", "مرحلہ"), `${c.currentStage}/14`],
              [u("Created", "تاریخ"), new Date(c.createdDate).toLocaleDateString()],
            ].map(([label, val]) => (
              <div key={String(label)} className={`p-2.5 rounded-xl ${dc ? "bg-gray-800" : "bg-gray-50"}`}>
                <p className={`text-[10px] font-bold uppercase ${sub}`}>{label}</p>
                <p className={`text-xs font-medium ${txt} truncate`}>{val || "—"}</p>
              </div>
            ))}
          </div>
          {c.documents.length > 0 && (
            <div className="mb-4">
              <h3 className={`text-sm font-bold mb-2 ${txt}`}>📄 {u("Documents", "دستاویزات")} ({c.documents.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {c.documents.map(doc => (
                  <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-xl border ${dc ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"}`}>
                    <FileText className={`w-4 h-4 ${sub}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${txt}`}>{doc.name}</p>
                      <p className={`text-[10px] ${sub}`}>{doc.type} · {doc.uploadDate}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${doc.status === "verified" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : doc.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>{doc.status}</span>
                    {doc.url && <button onClick={() => setLightboxSrc(doc.url)} className="text-emerald-500 hover:text-emerald-400"><Eye className="w-4 h-4" /></button>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {c.payments.length > 0 && (
            <div className="mb-4">
              <h3 className={`text-sm font-bold mb-2 ${txt}`}>💰 {u("Payments", "ادائیگیاں")} ({c.payments.length})</h3>
              <div className="space-y-2">
                {c.payments.map(p => (
                  <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${dc ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"}`}>
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${txt}`}>PKR {p.amount.toLocaleString()} — {p.method}</p>
                      <p className={`text-[10px] ${sub}`}>{p.date} · {p.description}</p>
                    </div>
                    {p.approvalStatus && <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.approvalStatus === "approved" ? "bg-green-100 text-green-700" : p.approvalStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{p.approvalStatus}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {c.timeline.length > 0 && (
            <div>
              <h3 className={`text-sm font-bold mb-2 ${txt}`}>📋 {u("Timeline", "ٹائم لائن")} ({c.timeline.length})</h3>
              <div className={`max-h-48 overflow-y-auto rounded-xl border ${brd} divide-y ${dc ? "divide-gray-700" : "divide-gray-100"}`}>
                {c.timeline.map(ev => (
                  <div key={ev.id} className="px-3 py-2.5">
                    <p className={`text-xs font-medium ${txt}`}>{ev.title}</p>
                    <p className={`text-[10px] ${sub}`}>{ev.description}</p>
                    <p className={`text-[10px] mt-0.5 ${sub}`}>{ev.date} · {ev.user}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="Document" onClose={() => setLightboxSrc(null)} />}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="relative">
        <Search className={`absolute ${u("left-3", "right-3")} top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={u("Search by name, ID, or phone...", "نام، آئی ڈی، یا فون سے تلاش کریں...")} className={`${inputCls} ${u("pl-10", "pr-10")}`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className={`${inputCls} text-xs flex-1 min-w-[120px]`}>
          <option value="all">{u("All Agents", "تمام ایجنٹ")}</option>
          {agents.map((a: any) => <option key={a.id} value={a.fullName}>{a.fullName}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${inputCls} text-xs flex-1 min-w-[120px]`}>
          <option value="all">{u("All Statuses", "تمام حالت")}</option>
          {allStatuses.map(s => <option key={s} value={s}>{u(statusLabels[s].en, statusLabels[s].ur)}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={`${inputCls} text-xs flex-1 min-w-[100px]`}>
          <option value="all">{u("All Priority", "تمام ترجیح")}</option>
          {["low","medium","high","urgent"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-bold ${sub}`}>{u("Sort:", "ترتیب:")}</span>
        {([["date", "Date", "تاریخ"], ["name", "Name", "نام"], ["status", "Status", "حالت"]] as const).map(([key, en, ur]) => (
          <button key={key} onClick={() => toggleSort(key as typeof sortBy)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1 ${sortBy === key ? (dc ? "bg-emerald-800 text-emerald-200" : "bg-emerald-100 text-emerald-700") : (dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500")}`}>
            {u(en, ur)} {sortBy === key && <ArrowUpDown className="w-3 h-3" />}
          </button>
        ))}
        <span className={`text-xs ml-auto ${sub}`}>{sorted.length} {u("cases", "کیسز")}</span>
      </div>
      {sorted.length === 0 ? (
        <div className={`text-center py-12 ${sub}`}>
          <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{u("No cases match your filters", "فلٹر سے کوئی کیس نہیں ملا")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(c => {
            const sl = statusLabels[c.status] || { en: c.status, ur: c.status, color: "bg-gray-100 text-gray-600" };
            const remaining = c.totalFee - c.paidAmount;
            return (
              <motion.div key={c.id} whileTap={{ scale: 0.98 }} onClick={() => setSelectedCase(c)} className={`rounded-xl border p-3.5 cursor-pointer transition-all ${card} hover:ring-2 hover:ring-emerald-500/30`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${txt}`}>{c.customerName}</p>
                    <p className={`text-[10px] font-mono ${sub}`}>{c.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap ${sl.color}`}>{u(sl.en, sl.ur)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityBadge(c.priority)}`}>{c.priority}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className={`text-[10px] flex items-center gap-1 ${sub}`}><User className="w-3 h-3" /> {c.agentName}</span>
                  <span className={`text-[10px] flex items-center gap-1 ${sub}`}><MapPin className="w-3 h-3" /> {c.country}</span>
                  <span className={`text-[10px] flex items-center gap-1 ${sub}`}><Phone className="w-3 h-3" /> {c.phone}</span>
                  <span className={`text-[10px] flex items-center gap-1 ${sub}`}><FileText className="w-3 h-3" /> {c.documents.length} docs</span>
                  {remaining > 0 && <span className="text-[10px] flex items-center gap-1 text-amber-500"><DollarSign className="w-3 h-3" /> {u("Due", "بقایا")}: PKR {remaining.toLocaleString()}</span>}
                  <span className={`text-[10px] ml-auto ${sub}`}>{u("Stage", "مرحلہ")} {c.currentStage}/14</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="Document" onClose={() => setLightboxSrc(null)} />}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// DOCUMENTS SECTION — batch upload, drag-and-drop, search, filter,
// retry failed, bulk status change, grid/list view
// ═══════════════════════════════════════════════════════════
interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

type DocViewMode = "list" | "grid";

function isImageDoc(doc: { type: string; name: string }) {
  return doc.type === "image" || ["image", "photos", "photo"].includes(doc.type.toLowerCase()) || !!doc.name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i);
}

export function DocumentsSection({ u, dc, card, txt, sub, inputCls, bigBtn, cases, addNotification, onCaseUpdated }: any) {
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [caseSearch, setCaseSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");
  const [docTypeFilter, setDocTypeFilter] = useState<"all" | "image" | "document">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<DocViewMode>("list");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brd = dc ? "border-gray-700" : "border-gray-200";
  const isUploading = uploadQueue.some(q => q.status === "uploading" || q.status === "queued");

  const filteredCases = (cases as Case[]).filter((c: Case) =>
    !caseSearch || c.customerName.toLowerCase().includes(caseSearch.toLowerCase()) || c.id.toLowerCase().includes(caseSearch.toLowerCase())
  );

  const selectedCase = (cases as Case[]).find((c: Case) => c.id === selectedCaseId);

  // ── Filtered documents within the selected case ──
  const filteredDocs = selectedCase?.documents.filter(doc => {
    if (docSearch && !doc.name.toLowerCase().includes(docSearch.toLowerCase()) && !doc.type.toLowerCase().includes(docSearch.toLowerCase())) return false;
    if (docStatusFilter !== "all" && doc.status !== docStatusFilter) return false;
    if (docTypeFilter !== "all") {
      const isImg = isImageDoc(doc);
      if (docTypeFilter === "image" && !isImg) return false;
      if (docTypeFilter === "document" && isImg) return false;
    }
    return true;
  }) || [];

  const statusCounts = selectedCase ? {
    all: selectedCase.documents.length,
    pending: selectedCase.documents.filter(d => d.status === "pending").length,
    verified: selectedCase.documents.filter(d => d.status === "verified").length,
    rejected: selectedCase.documents.filter(d => d.status === "rejected").length,
  } : { all: 0, pending: 0, verified: 0, rejected: 0 };

  // ── Upload a single file (shared by processQueue & retrySingle) ──
  const uploadSingleFile = useCallback(async (item: UploadQueueItem, currentDocs: any[]) => {
    setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "uploading", progress: 0, error: undefined } : q));
    try {
      const result = await uploadFile(selectedCaseId, item.file.name, item.file, (pct) => {
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: pct } : q));
      });
      if (result.success && result.path) {
        const newDoc = {
          id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.file.name,
          type: item.file.type.startsWith("image/") ? "image" : "document",
          uploadDate: new Date().toISOString().split("T")[0],
          status: "pending" as const,
          url: result.path,
          notes: "Uploaded by Operator via Documents tab",
        };
        const updatedDocs = [...currentDocs, newDoc];
        await updateCase(selectedCaseId, { documents: updatedDocs });
        const { data } = await supabase.from('cases').select('*').eq('id', selectedCaseId).single();
        const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "done", progress: 100 } : q));
        return { success: true, docs: refreshed ? refreshed.documents : updatedDocs };
      } else {
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "error", error: result.error || "Upload failed" } : q));
        return { success: false, docs: currentDocs };
      }
    } catch (err: any) {
      setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "error", error: err?.message || "Unknown error" } : q));
      return { success: false, docs: currentDocs };
    }
  }, [selectedCaseId]);

  // ── Batch upload handler ──
  const processQueue = useCallback(async (files: File[]) => {
    if (!selectedCaseId) { toast.error(u("Select a case first", "پہلے کیس منتخب کریں")); return; }
    if (files.length === 0) return;

    const items: UploadQueueItem[] = files.map((f, i) => ({
      id: `UQ-${Date.now()}-${i}`,
      file: f,
      progress: 0,
      status: "queued" as const,
    }));
    setUploadQueue(prev => [...prev, ...items]);

    let successCount = 0;
    let currentDocs = (cases as Case[]).find((c: Case) => c.id === selectedCaseId)?.documents || [];

    for (const item of items) {
      const result = await uploadSingleFile(item, currentDocs);
      if (result.success) {
        successCount++;
        currentDocs = result.docs;
      }
    }

    if (successCount > 0) {
      toast.success(successCount === 1
        ? u("Document uploaded!", "دستاویز اپلوڈ ہو گئی!")
        : `${successCount} ${u("documents uploaded!", "دستاویزات اپلوڈ ہو گئیں!")}`
      );
      addNotification(
        `Operator uploaded ${successCount} file(s) to ${selectedCaseId}`,
        `آپریٹر نے ${successCount} فائل(یں) ${selectedCaseId} میں اپلوڈ کیں`,
        "status"
      );
      if (onCaseUpdated) onCaseUpdated();
    }
    setTimeout(() => { setUploadQueue(prev => prev.filter(q => q.status !== "done")); }, 3000);
  }, [selectedCaseId, cases, addNotification, onCaseUpdated, u, uploadSingleFile]);

  // ── Retry all failed uploads ──
  const retryAllFailed = useCallback(async () => {
    const failedItems = uploadQueue.filter(q => q.status === "error");
    if (failedItems.length === 0) return;
    let successCount = 0;
    let currentDocs = (cases as Case[]).find((c: Case) => c.id === selectedCaseId)?.documents || [];
    for (const item of failedItems) {
      const result = await uploadSingleFile(item, currentDocs);
      if (result.success) { successCount++; currentDocs = result.docs; }
    }
    if (successCount > 0) {
      toast.success(`${successCount} ${u("retried successfully!", "دوبارہ کامیاب!")}`);
      if (onCaseUpdated) onCaseUpdated();
    }
    setTimeout(() => { setUploadQueue(prev => prev.filter(q => q.status !== "done")); }, 3000);
  }, [uploadQueue, selectedCaseId, cases, uploadSingleFile, onCaseUpdated, u]);

  // ── Retry single failed upload ──
  const retrySingle = useCallback(async (itemId: string) => {
    const item = uploadQueue.find(q => q.id === itemId);
    if (!item || item.status !== "error") return;
    let currentDocs = (cases as Case[]).find((c: Case) => c.id === selectedCaseId)?.documents || [];
    const result = await uploadSingleFile(item, currentDocs);
    if (result.success) {
      toast.success(u("Retry successful!", "دوبارہ کوشش کامیاب!"));
      if (onCaseUpdated) onCaseUpdated();
    }
    setTimeout(() => { setUploadQueue(prev => prev.filter(q => q.status !== "done")); }, 3000);
  }, [uploadQueue, selectedCaseId, cases, uploadSingleFile, onCaseUpdated, u]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processQueue(files);
    e.target.value = "";
  }, [processQueue]);

  // ── Drag-and-drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === "image/jpeg" || f.type === "image/png" || f.type === "application/pdf"
    );
    if (files.length === 0) { toast.error(u("Unsupported file type", "غیر تعاون شدہ فائل")); return; }
    processQueue(files);
  }, [processQueue, u]);

  const clearQueue = useCallback(() => {
    setUploadQueue(prev => prev.filter(q => q.status === "uploading" || q.status === "queued"));
  }, []);

  // ── View document (lightbox) ──
  const viewDocument = async (doc: { url: string; name: string; id: string }) => {
    setLoadingUrl(doc.id);
    try {
      const result = await getSignedUrl(selectedCaseId, doc.name);
      if (result.success && result.signedUrl) { setLightboxSrc(result.signedUrl); }
      else { setLightboxSrc(doc.url); }
    } catch { setLightboxSrc(doc.url); }
    finally { setLoadingUrl(null); }
  };

  // ── Load thumbnail URL for grid view ──
  const loadThumbnail = useCallback(async (doc: { url: string; name: string; id: string }) => {
    if (thumbnailUrls[doc.id]) return;
    try {
      const result = await getSignedUrl(selectedCaseId, doc.name);
      if (result.success && result.signedUrl) {
        setThumbnailUrls(prev => ({ ...prev, [doc.id]: result.signedUrl! }));
      } else {
        setThumbnailUrls(prev => ({ ...prev, [doc.id]: doc.url }));
      }
    } catch {
      setThumbnailUrls(prev => ({ ...prev, [doc.id]: doc.url }));
    }
  }, [selectedCaseId, thumbnailUrls]);

  // ── Bulk selection helpers ──
  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedDocIds.size === filteredDocs.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredDocs.map(d => d.id)));
    }
  }, [filteredDocs, selectedDocIds]);

  const clearSelection = useCallback(() => setSelectedDocIds(new Set()), []);

  // ── Bulk status change ──
  const bulkChangeStatus = useCallback(async (newStatus: "verified" | "rejected" | "pending") => {
    if (!selectedCase || selectedDocIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const updatedDocs = selectedCase.documents.map(d =>
        selectedDocIds.has(d.id) ? { ...d, status: newStatus } : d
      );
      const ok = await updateCase(selectedCaseId, { documents: updatedDocs });
      if (ok) {
        const { data } = await supabase.from('cases').select('*').eq('id', selectedCaseId).single();
        const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
        const statusLabel = newStatus === "verified" ? u("Verified", "تصدیق شدہ") : newStatus === "rejected" ? u("Rejected", "مسترد") : u("Pending", "زیر التواء");
        toast.success(`${selectedDocIds.size} ${u("documents marked as", "دستاویزات کی حالت")} ${statusLabel}`);
        addNotification(
          `Operator bulk-changed ${selectedDocIds.size} docs to "${newStatus}" in ${selectedCaseId}`,
          `آپریٹر نے ${selectedDocIds.size} دستاویزات کی حالت "${statusLabel}" میں تبدیل کی — ${selectedCaseId}`,
          "status"
        );
        setSelectedDocIds(new Set());
        if (onCaseUpdated) onCaseUpdated();
      }
    } catch (err) {
      toast.error(u("Failed to update status", "حالت تبدیل نہیں ہو سکی"));
    } finally {
      setBulkProcessing(false);
    }
  }, [selectedCase, selectedCaseId, selectedDocIds, addNotification, onCaseUpdated, u]);

  const totalQueueProgress = uploadQueue.length > 0
    ? Math.round(uploadQueue.reduce((sum, q) => sum + q.progress, 0) / uploadQueue.length)
    : 0;
  const doneCount = uploadQueue.filter(q => q.status === "done").length;
  const errorCount = uploadQueue.filter(q => q.status === "error").length;
  const allSelected = filteredDocs.length > 0 && selectedDocIds.size === filteredDocs.length;

  // Helper: status badge
  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
      status === "verified" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
      : status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    }`}>
      {status === "verified" ? u("Verified", "تصدیق شدہ") : status === "rejected" ? u("Rejected", "مسترد") : u("Pending", "زیر التواء")}
    </span>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <h3 className={`text-base font-bold flex items-center gap-2 ${txt}`}>
        <FileText className="w-5 h-5 text-emerald-500" /> {u("Document Management", "دستاویزات کا نظام")}
      </h3>

      {/* ── Case selector ── */}
      <div className="space-y-2">
        <div className="relative">
          <Search className={`absolute ${u("left-3", "right-3")} top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
          <input value={caseSearch} onChange={e => setCaseSearch(e.target.value)} placeholder={u("Search case by name or ID...", "نام یا آئی ڈی سے کیس تلاش کریں...")} className={`${inputCls} ${u("pl-10", "pr-10")}`} />
        </div>
        <select value={selectedCaseId} onChange={e => { setSelectedCaseId(e.target.value); setSelectedDocIds(new Set()); setThumbnailUrls({}); }} className={inputCls}>
          <option value="">{u("— Select a case —", "— کیس منتخب کریں —")}</option>
          {filteredCases.map((c: Case) => <option key={c.id} value={c.id}>{c.id} — {c.customerName} ({c.agentName})</option>)}
        </select>
      </div>

      {selectedCase ? (
        <div className="space-y-3">
          {/* ── Case header + stats ── */}
          <div className={`rounded-xl border p-4 ${card}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`text-sm font-bold ${txt}`}>{selectedCase.customerName}</p>
                <p className={`text-[10px] font-mono ${sub}`}>{selectedCase.id} · {selectedCase.agentName}</p>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { key: "verified" as const, icon: CheckCircle, color: "text-green-500", count: statusCounts.verified },
                  { key: "pending" as const, icon: Clock, color: "text-amber-500", count: statusCounts.pending },
                  { key: "rejected" as const, icon: XCircle, color: "text-red-500", count: statusCounts.rejected },
                ].map(s => (
                  <span key={s.key} className={`flex items-center gap-0.5 text-[10px] font-bold ${s.color}`} title={s.key}>
                    <s.icon className="w-3 h-3" /> {s.count}
                  </span>
                ))}
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${dc ? "bg-emerald-900/30 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>
                  {selectedCase.documents.length} {u("total", "کل")}
                </span>
              </div>
            </div>

            {/* ── Drag-and-drop / batch upload zone ── */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${isUploading ? "opacity-60 cursor-wait" : ""} ${
                dragOver
                  ? (dc ? "border-emerald-400 bg-emerald-900/20 scale-[1.01]" : "border-emerald-500 bg-emerald-50 scale-[1.01]")
                  : (dc ? "border-gray-600 hover:border-emerald-500/50 bg-gray-800/50" : "border-gray-300 hover:border-emerald-400 bg-gray-50")
              }`}
            >
              {dragOver ? (
                <>
                  <Download className="w-10 h-10 mx-auto mb-2 text-emerald-500 animate-bounce" />
                  <p className="text-sm font-bold text-emerald-500">{u("Drop files here!", "فائلیں یہاں چھوڑیں!")}</p>
                </>
              ) : (
                <>
                  <Upload className={`w-8 h-8 mx-auto mb-2 ${sub}`} />
                  <p className={`text-sm font-medium ${txt}`}>{u("Click or drag files to upload", "اپلوڈ کے لیے فائلیں کلک یا ڈریگ کریں")}</p>
                  <p className={`text-[10px] mt-1 ${sub}`}>{u("Supports batch upload — select multiple files at once", "ایک ساتھ کئی فائلیں منتخب کر سکتے ہیں")}</p>
                  <p className={`text-[10px] ${sub}`}>{u("JPG, PNG, PDF only", "صرف JPG، PNG، PDF")}</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileInput} />
          </div>

          {/* ── Upload queue / progress ── */}
          <AnimatePresence>
            {uploadQueue.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`rounded-xl border overflow-hidden ${card}`}
              >
                <div className={`px-4 py-3 border-b ${brd} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-500" />
                    <h4 className={`text-sm font-bold ${txt}`}>
                      {u("Upload Queue", "اپلوڈ قطار")}
                      <span className={`ml-2 text-xs font-normal ${sub}`}>
                        {doneCount}/{uploadQueue.length} {u("complete", "مکمل")}
                        {errorCount > 0 && <span className="text-red-500 ml-1">· {errorCount} {u("failed", "ناکام")}</span>}
                      </span>
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Retry all failed button */}
                    {errorCount > 0 && !isUploading && (
                      <button
                        onClick={retryAllFailed}
                        className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-colors ${dc ? "bg-amber-900/30 text-amber-300 hover:bg-amber-900/50" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                        title={u("Retry all failed", "سب ناکام دوبارہ")}
                      >
                        <RotateCcw className="w-3 h-3" />
                        {u("Retry all", "سب دوبارہ")} ({errorCount})
                      </button>
                    )}
                    {isUploading && (
                      <span className={`text-[10px] font-bold ${sub}`}>{totalQueueProgress}%</span>
                    )}
                    {!isUploading && (
                      <button onClick={clearQueue} className={`p-1.5 rounded-lg transition-colors ${dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`} title={u("Clear queue", "قطار صاف کریں")}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {isUploading && (
                  <div className={`h-1 ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                    <motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${totalQueueProgress}%` }} transition={{ ease: "easeOut" }} />
                  </div>
                )}
                <div className={`max-h-48 overflow-y-auto divide-y ${dc ? "divide-gray-700" : "divide-gray-100"}`}>
                  {uploadQueue.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      {item.status === "uploading" && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-emerald-500" />}
                      {item.status === "queued" && <Clock className="w-4 h-4 shrink-0 text-gray-400" />}
                      {item.status === "done" && <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />}
                      {item.status === "error" && <XCircle className="w-4 h-4 shrink-0 text-red-500" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${txt}`}>{item.file.name}</p>
                        <div className="flex items-center gap-2">
                          <p className={`text-[10px] ${sub}`}>{(item.file.size / 1024).toFixed(0)} KB</p>
                          {item.status === "error" && item.error && (
                            <p className="text-[10px] text-red-400 truncate max-w-[120px]">{item.error}</p>
                          )}
                        </div>
                      </div>
                      {item.status === "uploading" && (
                        <div className={`w-16 h-1.5 rounded-full overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                      {item.status === "error" && !isUploading && (
                        <button
                          onClick={() => retrySingle(item.id)}
                          className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg shrink-0 transition-colors ${dc ? "text-amber-300 hover:bg-amber-900/30" : "text-amber-600 hover:bg-amber-50"}`}
                          title={u("Retry", "دوبارہ")}
                        >
                          <RotateCcw className="w-3 h-3" />
                          {u("Retry", "دوبارہ")}
                        </button>
                      )}
                      {item.status === "error" && isUploading && (
                        <span className="text-[10px] text-red-500 shrink-0">{u("Failed", "ناکام")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Document search & filter bar ── */}
          {selectedCase.documents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className={`absolute ${u("left-3", "right-3")} top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${sub}`} />
                  <input
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    placeholder={u("Search documents...", "دستاویز تلاش کریں...")}
                    className={`w-full px-3 py-2.5 ${u("pl-9", "pr-9")} rounded-lg border text-xs ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-300 placeholder-gray-400"} focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                  />
                  {docSearch && (
                    <button onClick={() => setDocSearch("")} className={`absolute ${u("right-2", "left-2")} top-1/2 -translate-y-1/2`}>
                      <X className={`w-3.5 h-3.5 ${sub} hover:text-red-400`} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                    showFilters || docStatusFilter !== "all" || docTypeFilter !== "all"
                      ? (dc ? "bg-emerald-900/30 border-emerald-700 text-emerald-300" : "bg-emerald-50 border-emerald-300 text-emerald-700")
                      : (dc ? "bg-gray-700 border-gray-600 text-gray-300" : "bg-gray-50 border-gray-300 text-gray-600")
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {u("Filter", "فلٹر")}
                  {(docStatusFilter !== "all" || docTypeFilter !== "all") && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
                {/* View mode toggle */}
                <div className={`flex items-center rounded-lg border overflow-hidden ${dc ? "border-gray-600" : "border-gray-300"}`}>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2.5 transition-colors ${viewMode === "list" ? (dc ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-50 text-emerald-700") : (dc ? "bg-gray-700 text-gray-400 hover:text-gray-200" : "bg-gray-50 text-gray-400 hover:text-gray-600")}`}
                    title={u("List view", "فہرست")}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2.5 transition-colors ${viewMode === "grid" ? (dc ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-50 text-emerald-700") : (dc ? "bg-gray-700 text-gray-400 hover:text-gray-200" : "bg-gray-50 text-gray-400 hover:text-gray-600")}`}
                    title={u("Grid view", "گرڈ")}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={`flex flex-wrap gap-2 p-3 rounded-xl border ${dc ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                      <div className="space-y-1">
                        <p className={`text-[10px] font-bold uppercase ${sub}`}>{u("Status", "حالت")}</p>
                        <div className="flex flex-wrap gap-1">
                          {([
                            ["all", u("All", "سب"), ""],
                            ["pending", u("Pending", "زیر التواء"), ""],
                            ["verified", u("Verified", "تصدیق شدہ"), ""],
                            ["rejected", u("Rejected", "مسترد"), ""],
                          ] as const).map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => setDocStatusFilter(key as any)}
                              className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                                docStatusFilter === key
                                  ? (dc ? "bg-emerald-800 text-emerald-200 ring-1 ring-emerald-500" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400")
                                  : (dc ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200")
                              }`}
                            >
                              {label} {key !== "all" && <span className="opacity-60">({statusCounts[key]})</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className={`text-[10px] font-bold uppercase ${sub}`}>{u("Type", "قسم")}</p>
                        <div className="flex flex-wrap gap-1">
                          {([
                            ["all", u("All", "سب")],
                            ["image", u("Images", "تصاویر")],
                            ["document", u("Documents", "دستاویزات")],
                          ] as const).map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => setDocTypeFilter(key as any)}
                              className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                                docTypeFilter === key
                                  ? (dc ? "bg-emerald-800 text-emerald-200 ring-1 ring-emerald-500" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400")
                                  : (dc ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200")
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(docStatusFilter !== "all" || docTypeFilter !== "all" || docSearch) && (
                        <button
                          onClick={() => { setDocStatusFilter("all"); setDocTypeFilter("all"); setDocSearch(""); }}
                          className={`text-[10px] px-2.5 py-1 rounded-full font-medium self-end ${dc ? "text-red-400 hover:bg-red-900/20" : "text-red-500 hover:bg-red-50"}`}
                        >
                          {u("Clear all", "سب صاف کریں")} ✕
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Bulk action bar (appears when docs are selected) ── */}
          <AnimatePresence>
            {selectedDocIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`rounded-xl border p-3 flex flex-wrap items-center gap-2 ${dc ? "bg-emerald-900/20 border-emerald-800" : "bg-emerald-50 border-emerald-200"}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className={`text-xs font-bold ${txt}`}>
                    {selectedDocIds.size} {u("selected", "منتخب")}
                  </span>
                  <button onClick={clearSelection} className={`text-[10px] ${sub} hover:text-red-400 underline`}>
                    {u("Clear", "صاف")}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => bulkChangeStatus("verified")}
                    disabled={bulkProcessing}
                    className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      bulkProcessing ? "opacity-50 cursor-wait" : ""
                    } ${dc ? "bg-green-900/40 text-green-300 hover:bg-green-900/60" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
                  >
                    {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    {u("Verify", "تصدیق")}
                  </button>
                  <button
                    onClick={() => bulkChangeStatus("rejected")}
                    disabled={bulkProcessing}
                    className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      bulkProcessing ? "opacity-50 cursor-wait" : ""
                    } ${dc ? "bg-red-900/40 text-red-300 hover:bg-red-900/60" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                  >
                    {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                    {u("Reject", "مسترد")}
                  </button>
                  <button
                    onClick={() => bulkChangeStatus("pending")}
                    disabled={bulkProcessing}
                    className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      bulkProcessing ? "opacity-50 cursor-wait" : ""
                    } ${dc ? "bg-amber-900/40 text-amber-300 hover:bg-amber-900/60" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}
                  >
                    {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                    {u("Pending", "زیر التواء")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Document list / grid ── */}
          {selectedCase.documents.length > 0 ? (
            <div className={`rounded-xl border overflow-hidden ${card}`}>
              <div className={`px-4 py-3 border-b ${brd} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  {/* Select all checkbox */}
                  <button onClick={toggleSelectAll} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    allSelected
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : selectedDocIds.size > 0
                        ? (dc ? "bg-emerald-900/30 border-emerald-600" : "bg-emerald-50 border-emerald-400")
                        : (dc ? "border-gray-600 hover:border-gray-500" : "border-gray-300 hover:border-gray-400")
                  }`}>
                    {allSelected && <Check className="w-3 h-3" />}
                    {!allSelected && selectedDocIds.size > 0 && <div className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />}
                  </button>
                  <h4 className={`text-sm font-bold ${txt}`}>
                    {u("Documents", "دستاویزات")}
                    {filteredDocs.length !== selectedCase.documents.length && (
                      <span className={`ml-2 text-xs font-normal ${sub}`}>
                        {u(`Showing ${filteredDocs.length} of ${selectedCase.documents.length}`, `${selectedCase.documents.length} میں سے ${filteredDocs.length} دکھائے جا رہے ہیں`)}
                      </span>
                    )}
                  </h4>
                </div>
              </div>

              {filteredDocs.length > 0 ? (
                viewMode === "list" ? (
                  /* ── LIST VIEW ── */
                  <div className={`divide-y ${dc ? "divide-gray-700" : "divide-gray-100"}`}>
                    {filteredDocs.map(doc => (
                      <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${selectedDocIds.has(doc.id) ? (dc ? "bg-emerald-900/15" : "bg-emerald-50/60") : ""} ${dc ? "hover:bg-gray-700/30" : "hover:bg-gray-50"}`}>
                        {/* Checkbox */}
                        <button onClick={() => toggleDocSelection(doc.id)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          selectedDocIds.has(doc.id)
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : (dc ? "border-gray-600 hover:border-emerald-500" : "border-gray-300 hover:border-emerald-400")
                        }`}>
                          {selectedDocIds.has(doc.id) && <Check className="w-3 h-3" />}
                        </button>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isImageDoc(doc)
                            ? (dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-500")
                            : (dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500")
                        }`}>
                          {isImageDoc(doc) ? <Camera className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${txt}`}>{doc.name}</p>
                          <p className={`text-[10px] ${sub}`}>{doc.type} · {doc.uploadDate}</p>
                        </div>
                        <StatusBadge status={doc.status} />
                        <button onClick={() => viewDocument(doc)} disabled={loadingUrl === doc.id} className={`p-2 rounded-lg transition-colors shrink-0 ${dc ? "hover:bg-gray-700 text-emerald-400" : "hover:bg-gray-100 text-emerald-600"}`} title={u("View", "دیکھیں")}>
                          {loadingUrl === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ── GRID / THUMBNAIL VIEW ── */
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredDocs.map(doc => {
                      const isImg = isImageDoc(doc);
                      const thumbUrl = thumbnailUrls[doc.id];
                      // Lazy load thumbnail
                      if (isImg && !thumbUrl) { loadThumbnail(doc); }
                      return (
                        <div
                          key={doc.id}
                          className={`rounded-xl border overflow-hidden transition-all group relative ${
                            selectedDocIds.has(doc.id) ? (dc ? "ring-2 ring-emerald-500 border-emerald-600" : "ring-2 ring-emerald-400 border-emerald-300") : brd
                          } ${dc ? "bg-gray-800 hover:bg-gray-750" : "bg-white hover:shadow-md"}`}
                        >
                          {/* Thumbnail area */}
                          <div className={`relative w-full h-28 flex items-center justify-center overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                            {isImg && thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={doc.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : isImg && !thumbUrl ? (
                              <Loader2 className={`w-6 h-6 animate-spin ${sub}`} />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <FileText className={`w-8 h-8 ${sub}`} />
                                <span className={`text-[9px] font-mono uppercase ${sub}`}>
                                  {doc.name.split(".").pop() || "DOC"}
                                </span>
                              </div>
                            )}
                            {/* Selection checkbox overlay */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleDocSelection(doc.id); }}
                              className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                selectedDocIds.has(doc.id)
                                  ? "bg-emerald-500 border-emerald-500 text-white scale-100"
                                  : "border-white/80 bg-black/20 text-transparent hover:border-white hover:bg-black/40 group-hover:scale-100 scale-0"
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            {/* View button overlay */}
                            <button
                              onClick={(e) => { e.stopPropagation(); viewDocument(doc); }}
                              disabled={loadingUrl === doc.id}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                            >
                              {loadingUrl === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                          {/* Info area */}
                          <div className="p-2.5 space-y-1.5">
                            <p className={`text-[11px] font-medium truncate ${txt}`}>{doc.name}</p>
                            <div className="flex items-center justify-between">
                              <p className={`text-[9px] ${sub}`}>{doc.uploadDate}</p>
                              <StatusBadge status={doc.status} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className={`text-center py-6 ${sub}`}>
                  <Search className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs">{u("No documents match your filters", "فلٹر سے کوئی دستاویز نہیں ملی")}</p>
                  <button
                    onClick={() => { setDocStatusFilter("all"); setDocTypeFilter("all"); setDocSearch(""); }}
                    className="text-[10px] text-emerald-500 mt-1 hover:underline"
                  >
                    {u("Clear filters", "فلٹر صاف کریں")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={`text-center py-8 rounded-xl border ${card}`}>
              <FileText className={`w-8 h-8 mx-auto mb-2 opacity-30 ${sub}`} />
              <p className={`text-sm ${sub}`}>{u("No documents uploaded yet", "ابھی کوئی دستاویز نہیں")}</p>
              <p className={`text-[10px] mt-1 ${sub}`}>{u("Drag and drop files above or click to browse", "اوپر فائلیں ڈریگ کریں یا کلک کر کے منتخب کریں")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className={`text-center py-12 rounded-xl border ${card}`}>
          <FolderPlus className={`w-10 h-10 mx-auto mb-3 opacity-30 ${sub}`} />
          <p className={`text-sm font-medium ${txt}`}>{u("Select a case to manage documents", "دستاویزات کے لیے کیس منتخب کریں")}</p>
          <p className={`text-xs mt-1 ${sub}`}>{u("Choose from the dropdown above", "اوپر ڈراپ ڈاؤن سے چنیں")}</p>
        </div>
      )}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="Document" onClose={() => setLightboxSrc(null)} />}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// APPOINTMENTS
// ═══════════════════════════════════════════════════════════
export function AppointmentsSection({ u, dc, card, txt, sub, inputCls, bigBtn, cases }: any) {
  const [appts, setAppts] = useState<Appointment[]>(() => load(STORAGE.appointments, []));
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<"today" | "upcoming" | "all">("today");
  const [client, setClient] = useState("");
  const [type, setType] = useState<"medical" | "protector" | "payment">("medical");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("08:00");
  const [notes, setNotes] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const typeLabels = { medical: { en: "Medical", ur: "میڈیکل", color: "bg-blue-500" }, protector: { en: "Protector", ur: "پروٹیکٹر", color: "bg-orange-500" }, payment: { en: "Payment", ur: "ادائیگی", color: "bg-emerald-500" } };
  const presetTimes = ["08:00", "10:00", "12:00", "14:00", "16:00"];

  const displayAppts = (() => {
    const sorted = [...appts].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    if (viewMode === "today") return sorted.filter(a => a.date === today);
    if (viewMode === "upcoming") return sorted.filter(a => a.date >= today && !a.done);
    return sorted;
  })();

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthApptDates = new Map<string, Set<string>>();
  appts.forEach(a => {
    const key = a.date;
    if (!monthApptDates.has(key)) monthApptDates.set(key, new Set());
    monthApptDates.get(key)!.add(a.type);
  });

  const handleAdd = () => {
    if (!client.trim()) { toast.error(u("Enter client name", "نام ڈالیں")); return; }
    const appt: Appointment = { id: `APT-${Date.now()}`, clientName: client.trim(), type, date, time, notes: notes.trim(), done: false };
    const updated = [appt, ...appts];
    setAppts(updated); save(STORAGE.appointments, updated);
    setClient(""); setNotes(""); setShowForm(false);
    toast.success(u("Appointment added!", "ملاقات شامل ہو گئی!"));
  };

  const autoGenerate = () => {
    const generated: Appointment[] = [];
    cases.forEach((c: Case) => {
      if (c.status === "medical_token" || c.status === "check_medical")
        generated.push({ id: `APT-${Date.now()}-${c.id}-m`, clientName: c.customerName, type: "medical", date: today, time: "08:00", notes: `Auto: ${c.status}`, done: false });
      if (c.status === "protector")
        generated.push({ id: `APT-${Date.now()}-${c.id}-p`, clientName: c.customerName, type: "protector", date: today, time: "08:00", notes: "Auto: Protector", done: false });
      if (c.status === "payment_confirmation")
        generated.push({ id: `APT-${Date.now()}-${c.id}-pay`, clientName: c.customerName, type: "payment", date: today, time: "10:00", notes: "Auto: Payment", done: false });
    });
    if (!generated.length) { toast.info(u("No auto-appointments needed", "خودکار ملاقات کی ضرورت نہیں")); return; }
    const updated = [...generated, ...appts];
    setAppts(updated); save(STORAGE.appointments, updated);
    toast.success(`${generated.length} ${u("appointments generated!", "ملاقاتیں بن گئیں!")}`);
  };

  const toggleDone = (id: string) => {
    const updated = appts.map(a => a.id === id ? { ...a, done: !a.done } : a);
    setAppts(updated); save(STORAGE.appointments, updated);
    toast.success(u("Updated!", "اپ ڈیٹ ہو گیا!"));
  };

  const deleteAppt = (id: string) => {
    const updated = appts.filter(a => a.id !== id);
    setAppts(updated); save(STORAGE.appointments, updated);
    setDeleteConfirm(null);
    toast.success(u("Appointment deleted!", "ملاقات حذف ہو گئی!"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="flex gap-2">
        <motion.button whileTap={{ scale: 0.97 }} onClick={autoGenerate} className={`${bigBtn} flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white`}>
          <RefreshCw className="w-5 h-5" /> {u("Auto Generate", "خودکار بنائیں")}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowForm(!showForm)} className={`${bigBtn} flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white`}>
          <Plus className="w-5 h-5" /> {u("Add New", "نئی شامل کریں")}
        </motion.button>
      </div>

      <div className={`rounded-xl border p-3 sm:p-4 ${card}`}>
        <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${txt}`}>
          <Calendar className="w-4 h-4 text-blue-500" /> {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = String(i + 1).padStart(2, "0");
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${d}`;
            const types = monthApptDates.get(dateStr);
            const isToday = dateStr === today;
            return (
              <div key={i} className={`w-8 h-10 sm:w-9 sm:h-11 rounded-lg flex flex-col items-center justify-center text-[10px] font-medium ${
                isToday ? "ring-2 ring-blue-500 " : ""
              }${types ? (dc ? "bg-gray-700" : "bg-gray-50") : dc ? "bg-gray-800 text-gray-600" : "bg-gray-100/50 text-gray-400"} ${isToday ? (dc ? "text-blue-400" : "text-blue-700") : types ? txt : ""}`}>
                <span>{i + 1}</span>
                {types && (
                  <div className="flex gap-0.5 mt-0.5">
                    {types.has("medical") && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    {types.has("protector") && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                    {types.has("payment") && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 mt-2.5">
          <span className="flex items-center gap-1 text-[10px]"><div className="w-2 h-2 rounded-full bg-blue-500" /> {u("Medical", "میڈیکل")}</span>
          <span className="flex items-center gap-1 text-[10px]"><div className="w-2 h-2 rounded-full bg-orange-500" /> {u("Protector", "پروٹیکٹر")}</span>
          <span className="flex items-center gap-1 text-[10px]"><div className="w-2 h-2 rounded-full bg-emerald-500" /> {u("Payment", "ادائیگی")}</span>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`rounded-2xl border p-4 space-y-3 overflow-hidden ${card}`}>
            <input value={client} onChange={e => setClient(e.target.value)} placeholder={u("Client Name *", "نام *")} className={inputCls} />
            <select value={type} onChange={e => setType(e.target.value as any)} className={inputCls}>
              <option value="medical">{u("Medical", "میڈیکل")}</option>
              <option value="protector">{u("Protector", "پروٹیکٹر")}</option>
              <option value="payment">{u("Payment", "ادائیگی")}</option>
            </select>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} dir="ltr" />
            <div className="flex gap-2 flex-wrap">
              {presetTimes.map(t => (
                <button key={t} onClick={() => setTime(t)} className={`px-3 py-2.5 rounded-lg text-sm font-medium min-h-[40px] ${time === t ? "bg-emerald-600 text-white" : dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>{t}</button>
              ))}
            </div>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={u("Notes (optional)", "نوٹ")} className={inputCls} />
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdd} className={`${bigBtn} w-full bg-emerald-600 text-white`}>
              <Check className="w-5 h-5" /> {u("Save", "محفوظ کریں")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        {([
          { id: "today" as const, en: "Today", ur: "آج", count: appts.filter(a => a.date === today).length },
          { id: "upcoming" as const, en: "Upcoming", ur: "آنے والی", count: appts.filter(a => a.date >= today && !a.done).length },
          { id: "all" as const, en: "All", ur: "تمام", count: appts.length },
        ]).map(v => (
          <button key={v.id} onClick={() => setViewMode(v.id)}
            className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold min-h-[40px] transition-all ${
              viewMode === v.id ? "bg-blue-600 text-white" : dc ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-white text-gray-500 border border-gray-200"
            }`}>
            {u(v.en, v.ur)} ({v.count})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {displayAppts.length === 0 ? (
          <p className={`text-center py-6 ${sub}`}>{u("No appointments", "کوئی ملاقات نہیں")}</p>
        ) : displayAppts.map(a => {
          const isOverdue = a.date < today && !a.done;
          return (
            <div key={a.id} className={`rounded-xl border p-3 sm:p-4 ${card} ${a.done ? "opacity-50" : ""} ${isOverdue ? (dc ? "border-red-800/50" : "border-red-300") : ""}`}>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-lg">{a.type === "medical" ? "🏥" : a.type === "protector" ? "🛡️" : "💰"}</span>
                  <div className={`w-2 h-2 rounded-full mt-1 ${typeLabels[a.type].color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${txt}`}>{a.clientName}</p>
                  <p className={`text-xs ${sub}`}>
                    {a.date === today ? u("Today", "آج") : a.date} — {a.time} — {u(typeLabels[a.type].en, typeLabels[a.type].ur)}
                  </p>
                  {a.notes && <p className={`text-[10px] mt-0.5 ${sub}`}>{a.notes}</p>}
                  {isOverdue && <p className="text-[10px] text-red-500 font-bold mt-0.5">⚠️ {u("Overdue!", "وقت گزر گیا!")}</p>}
                </div>
                <div className="flex gap-1.5">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleDone(a.id)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-bold min-h-[44px] ${a.done ? "bg-gray-500 text-white" : "bg-emerald-600 text-white"}`}>
                    {a.done ? u("Undo", "واپس") : <Check className="w-4 h-4" />}
                  </motion.button>
                  {deleteConfirm === a.id ? (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteAppt(a.id)}
                      className="px-3 py-2.5 rounded-xl text-sm font-bold min-h-[44px] bg-red-600 text-white">
                      {u("Sure?", "پکا؟")}
                    </motion.button>
                  ) : (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDeleteConfirm(a.id)}
                      className={`px-2 py-2.5 rounded-xl min-h-[44px] ${dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                      <X className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// AGENT SUPPORT
// ═══════════════════════════════════════════════════════════
export function AgentSupportSection({ u, dc, card, txt, sub, cases, agents }: any) {
  const [takenIds, setTakenIds] = useState<string[]>(() => load("emr-op-taken-tasks", []));
  const [viewMode, setViewMode] = useState<"tasks" | "agents">("agents");

  const missedTasks = cases
    .filter((c: Case) => c.isOverdue || c.status === "document_collection")
    .map((c: Case) => ({
      id: `task-${c.id}`, caseId: c.id, agentName: c.agentName, customerName: c.customerName,
      description: c.isOverdue ? u(`Overdue: ${c.status.replace(/_/g, " ")}`, `تاخیر: ${c.status.replace(/_/g, " ")}`)
        : u(`Missing documents for ${c.customerName}`, `${c.customerName} کے کاغزات نامکمل`),
    }));

  const agentWorkloads = agents.map((agent: any) => {
    const agentCases = cases.filter((c: Case) => c.agentName === agent.fullName);
    return {
      ...agent,
      totalCases: agentCases.length,
      overdue: agentCases.filter((c: Case) => c.isOverdue).length,
      pending: agentCases.filter((c: Case) => c.status !== "completed" && c.status !== "rejected").length,
      completed: agentCases.filter((c: Case) => c.status === "completed").length,
      cases: agentCases,
    };
  });

  const takeOver = (taskId: string) => {
    const updated = [...takenIds, taskId];
    setTakenIds(updated); save("emr-op-taken-tasks", updated);
    toast.success(u("Task taken over!", "کام آپ نے لے لیا!"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setViewMode("agents")}
          className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold min-h-[40px] ${viewMode === "agents" ? "bg-blue-600 text-white" : dc ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-white text-gray-500 border border-gray-200"}`}>
          👥 {u("Agent Workload", "ایجنٹ کا کام")}
        </button>
        <button onClick={() => setViewMode("tasks")}
          className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold min-h-[40px] ${viewMode === "tasks" ? "bg-blue-600 text-white" : dc ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-white text-gray-500 border border-gray-200"}`}>
          ⚠️ {u("Pending Tasks", "باقی کام")} ({missedTasks.length})
        </button>
      </div>

      {viewMode === "agents" ? (
        <div className="space-y-2">
          {agentWorkloads.length === 0 ? (
            <p className={`text-center py-8 ${sub}`}>{u("No agents found", "کوئی ایجنٹ نہیں ملا")}</p>
          ) : agentWorkloads.map((agent: any) => (
            <div key={agent.id} className={`rounded-xl border p-3 sm:p-4 ${card}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${dc ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
                  {agent.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${txt}`}>{agent.fullName}</p>
                  <p className={`text-xs ${sub}`}>{agent.meta?.title || u("Agent", "ایجنٹ")} — {agent.phone || ""}</p>
                </div>
                {agent.overdue > 0 && (
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"}`}>
                    ⚠️ {agent.overdue} {u("overdue", "تاخیر")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-lg p-2 text-center ${dc ? "bg-blue-900/20" : "bg-blue-50"}`}>
                  <p className={`text-lg font-bold ${dc ? "text-blue-400" : "text-blue-600"}`}>{agent.totalCases}</p>
                  <p className={`text-[10px] ${sub}`}>{u("Total", "کل")}</p>
                </div>
                <div className={`rounded-lg p-2 text-center ${dc ? "bg-amber-900/20" : "bg-amber-50"}`}>
                  <p className={`text-lg font-bold ${dc ? "text-amber-400" : "text-amber-600"}`}>{agent.pending}</p>
                  <p className={`text-[10px] ${sub}`}>{u("Active", "فعال")}</p>
                </div>
                <div className={`rounded-lg p-2 text-center ${dc ? "bg-emerald-900/20" : "bg-emerald-50"}`}>
                  <p className={`text-lg font-bold ${dc ? "text-emerald-400" : "text-emerald-600"}`}>{agent.completed}</p>
                  <p className={`text-[10px] ${sub}`}>{u("Done", "مکمل")}</p>
                </div>
              </div>
              {agent.cases.length > 0 && (
                <div className={`mt-2 pt-2 border-t ${dc ? "border-gray-700" : "border-gray-200"} space-y-1`}>
                  {agent.cases.slice(0, 3).map((c: Case) => (
                    <div key={c.id} className={`flex items-center gap-2 text-xs ${sub}`}>
                      <span className="font-mono">{c.id}</span>
                      <span className={txt}>{c.customerName}</span>
                      <span className={`ms-auto text-[10px] px-1.5 py-0.5 rounded ${
                        c.isOverdue ? (dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600")
                          : (dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500")
                      }`}>{c.status.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                  {agent.cases.length > 3 && (
                    <p className={`text-[10px] ${sub}`}>+{agent.cases.length - 3} {u("more", "اور")}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={`rounded-xl border p-3 ${dc ? "bg-amber-900/20 border-amber-700/30" : "bg-amber-50 border-amber-200"}`}>
            <p className={`text-sm font-medium ${dc ? "text-amber-400" : "text-amber-700"}`}>
              <AlertTriangle className="w-4 h-4 inline" /> {missedTasks.length} {u("pending agent tasks", "ایجنٹ کے باقی کام")}
            </p>
          </div>
          <div className="space-y-2">
            {missedTasks.length === 0 ? (
              <p className={`text-center py-8 ${sub}`}>{u("All agent tasks up to date!", "سب کام مکمل ہیں!")}</p>
            ) : missedTasks.map((task: any) => {
              const taken = takenIds.includes(task.id);
              return (
                <div key={task.id} className={`rounded-xl border p-3 sm:p-4 ${card} ${taken ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${dc ? "bg-red-900/30" : "bg-red-100"}`}>
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${dc ? "text-red-400" : "text-red-600"} font-medium`}>{u("Agent", "ایجنٹ")} {task.agentName} — {task.caseId}</p>
                      <p className={`text-sm font-semibold mt-0.5 ${txt}`}>{task.description}</p>
                    </div>
                    {taken ? (
                      <span className="text-xs text-emerald-500 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {u("Taken", "لے لیا")}</span>
                    ) : (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => takeOver(task.id)}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold min-h-[44px] whitespace-nowrap">
                        <RefreshCw className="w-4 h-4" /> {u("I'll Do This", "میں کرتا ہوں")}
                      </motion.button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════════════════════
export function AttendanceSection({ u, dc, card, txt, sub, allStaff }: any) {
  const today = new Date().toISOString().split("T")[0];
  const [attendance, setAttendance] = useState<AttendanceEntry[]>(() => load(STORAGE.attendance, []));
  const getToday = (name: string) => attendance.find(a => a.staffName === name && a.date === today);

  const markAttendance = (name: string, status: "present" | "late" | "absent") => {
    const existing = attendance.filter(a => !(a.staffName === name && a.date === today));
    const entry: AttendanceEntry = { staffName: name, status, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), date: today };
    const updated = [...existing, entry];
    setAttendance(updated); save(STORAGE.attendance, updated);
    const labels = { present: u("Present", "حاضر"), late: u("Late", "دیر"), absent: u("Absent", "غیر حاضر") };
    toast.success(`${name}: ${labels[status]}`);
  };

  const statusBtn = (name: string, status: "present" | "late" | "absent", emoji: string, label: string, activeColor: string) => {
    const isActive = getToday(name)?.status === status;
    return (
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => markAttendance(name, status)}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold min-h-[44px] transition-all ${isActive ? activeColor : dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
        {emoji} {label}
      </motion.button>
    );
  };

  const exportCSV = () => {
    const header = "Date,Name,Status,Time\n";
    const rows = attendance.map(a => `${a.date},${a.staffName},${a.status},${a.time}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `attendance-${today}.csv`; a.click();
    toast.success(u("Downloaded!", "ڈاؤنلوڈ ہو گیا!"));
  };

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="space-y-2">
        {allStaff.map((s: any) => {
          const todayEntry = getToday(s.fullName);
          return (
            <div key={s.id} className={`rounded-xl border p-3 sm:p-4 ${card}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${dc ? "bg-gray-700 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
                  {s.fullName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${txt}`}>{s.fullName}</p>
                  <p className={`text-xs ${sub}`}>{s.meta?.title || s.role}</p>
                </div>
                {todayEntry && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    todayEntry.status === "present" ? "bg-emerald-100 text-emerald-700" : todayEntry.status === "late" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  }`}>{todayEntry.time}</span>
                )}
              </div>
              <div className="flex gap-2">
                {statusBtn(s.fullName, "present", "✅", u("Present", "حاضر"), "bg-emerald-600 text-white")}
                {statusBtn(s.fullName, "late", "⏰", u("Late", "دیر"), "bg-amber-500 text-white")}
                {statusBtn(s.fullName, "absent", "❌", u("Absent", "غیر حاضر"), "bg-red-500 text-white")}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`rounded-xl border p-3 sm:p-4 ${card}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-bold text-sm ${txt}`}>{u("This Month", "اس مہینے")}</h3>
          <motion.button whileTap={{ scale: 0.95 }} onClick={exportCSV}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
            <Download className="w-3.5 h-3.5" /> CSV
          </motion.button>
        </div>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = String(i + 1).padStart(2, "0");
            const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${d}`;
            const dayEntries = attendance.filter(a => a.date === dateStr);
            const hasPresent = dayEntries.some(a => a.status === "present");
            const hasLate = dayEntries.some(a => a.status === "late");
            const hasAbsent = dayEntries.some(a => a.status === "absent");
            return (
              <div key={i} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] font-medium ${
                hasPresent ? "bg-emerald-500 text-white" : hasLate ? "bg-amber-500 text-white" : hasAbsent ? "bg-red-500 text-white" : dc ? "bg-gray-700 text-gray-500" : "bg-gray-100 text-gray-400"
              } ${dateStr === today ? "ring-2 ring-blue-500" : ""}`}>
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// OFFICE VISITS
// ═══════════════════════════════════════════════════════════
export function VisitsSection({ u, dc, card, txt, sub, inputCls, bigBtn }: any) {
  const [visits, setVisits] = useState<OfficeVisit[]>(() => load(STORAGE.visits, []));
  const [showForm, setShowForm] = useState(false);
  const [viewFilter, setViewFilter] = useState<"today" | "week" | "all">("today");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [metWith, setMetWith] = useState("");
  const [notes, setNotes] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const purposes = [
    { en: "Consultation", ur: "مشاورت" },
    { en: "Document Submit", ur: "کاغزات جمع" },
    { en: "Payment", ur: "ادائیگی" },
    { en: "Other", ur: "دیگر" },
  ];

  const displayVisits = (() => {
    const sorted = [...visits].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (viewFilter === "today") return sorted.filter(v => v.timestamp.startsWith(today));
    if (viewFilter === "week") return sorted.filter(v => Date.now() - new Date(v.timestamp).getTime() < 7 * 86400000);
    return sorted;
  })();

  const handleAdd = () => {
    if (!name.trim() || !phone.trim() || !purpose) { toast.error(u("Fill required fields", "ضروری خانے بھریں")); return; }
    const visit: OfficeVisit = { id: `VIS-${Date.now()}`, clientName: name.trim(), phone: phone.trim(), purpose, metWith: metWith || "Operator", notes: notes.trim(), timestamp: new Date().toISOString() };
    const updated = [visit, ...visits];
    setVisits(updated); save(STORAGE.visits, updated);
    setName(""); setPhone(""); setPurpose(""); setMetWith(""); setNotes("");
    setShowForm(false);
    toast.success(u("Visit logged!", "وزٹ درج ہو گیا!"));
  };

  const deleteVisit = (id: string) => {
    const updated = visits.filter(v => v.id !== id);
    setVisits(updated); save(STORAGE.visits, updated);
    toast.success(u("Visit deleted!", "وزٹ حذف ہو گیا!"));
  };

  const exportVisitsCSV = () => {
    const header = "Date,Time,Client,Phone,Purpose,Met With,Notes\n";
    const rows = visits.map(v => {
      const dt = new Date(v.timestamp);
      return `${dt.toLocaleDateString("en-US")},${dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })},${v.clientName},${v.phone},${v.purpose},${v.metWith},"${v.notes}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `visits-${today}.csv`; a.click();
    toast.success(u("Visits CSV downloaded!", "وزٹ CSV ڈاؤنلوڈ ہو گئی!"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowForm(!showForm)}
        className={`${bigBtn} w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white`}>
        <Building2 className="w-5 h-5" /> {u("+ Log Office Visit", "+ آفس وزٹ درج کریں")}
      </motion.button>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`rounded-2xl border p-4 space-y-3 overflow-hidden ${card}`}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={u("Client Name *", "نام *")} className={inputCls} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={u("Phone *", "فون *")} className={inputCls} dir="ltr" />
            <div className="flex flex-wrap gap-2">
              {purposes.map(p => (
                <button key={p.en} onClick={() => setPurpose(p.en)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ${purpose === p.en ? "bg-emerald-600 text-white" : dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                  {u(p.en, p.ur)}
                </button>
              ))}
            </div>
            <select value={metWith} onChange={e => setMetWith(e.target.value)} className={inputCls}>
              <option value="">{u("Met With (Operator)", "کس سے ملے")}</option>
              <option value="Expert">{u("Expert / Sir Atif", "ایکسپرٹ")}</option>
              <option value="Agent">{u("Agent", "ایجنٹ")}</option>
              <option value="Operator">{u("Operator", "آپریٹر")}</option>
            </select>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={u("Notes", "نوٹ")} className={inputCls} />
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdd} className={`${bigBtn} w-full bg-emerald-600 text-white`}>
              <Check className="w-5 h-5" /> {u("Save Visit", "وزٹ محفوظ کریں")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: "today" as const, en: "Today", ur: "آج" },
          { id: "week" as const, en: "This Week", ur: "اس ہفتے" },
          { id: "all" as const, en: "All", ur: "تمام" },
        ]).map(f => (
          <button key={f.id} onClick={() => setViewFilter(f.id)}
            className={`px-3 py-2 rounded-xl text-xs font-medium min-h-[36px] ${viewFilter === f.id ? "bg-blue-600 text-white" : dc ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-white text-gray-500 border border-gray-200"}`}>
            {u(f.en, f.ur)}
          </button>
        ))}
        <div className="ms-auto flex items-center gap-2">
          <span className={`text-sm font-bold ${txt}`}>{displayVisits.length} {u("visits", "وزٹ")}</span>
          {visits.length > 0 && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={exportVisitsCSV}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
              <Download className="w-3 h-3" /> CSV
            </motion.button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {displayVisits.length === 0 ? (
          <p className={`text-center py-6 ${sub}`}>{u("No visits", "کوئی وزٹ نہیں")}</p>
        ) : displayVisits.map(v => (
          <div key={v.id} className={`rounded-xl border p-3 sm:p-4 ${card}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dc ? "bg-blue-900/30" : "bg-blue-100"}`}>
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${txt}`}>{v.clientName}</p>
                <p className={`text-xs ${sub}`}>
                  {v.timestamp.startsWith(today) ? "" : `${new Date(v.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · `}
                  {new Date(v.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} — {v.purpose} — {v.metWith}
                </p>
                {v.notes && <p className={`text-[10px] mt-0.5 ${sub}`}>{v.notes}</p>}
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteVisit(v.id)}
                className={`p-2 rounded-lg ${dc ? "text-gray-500 hover:bg-gray-700" : "text-gray-400 hover:bg-gray-100"}`}>
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// OPERATOR PROFILE
// ═══════════════════════════════════════════════════════════
export function ProfileSection({ u, dc, card, txt, sub, bigBtn, session, syncStatus, onLogout }: any) {
  const { darkMode, toggleDarkMode, isUrdu, toggleLanguage } = useTheme();
  const navigate = useNavigate();
  const lastSync = getLastSyncTime();

  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0 });
  useEffect(() => {
    try {
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("emr-")) totalSize += (localStorage.getItem(key) || "").length * 2;
      }
      setStorageInfo({ used: totalSize, total: 5 * 1024 * 1024 });
    } catch {}
  }, []);

  const storagePercent = storageInfo.total > 0 ? Math.round((storageInfo.used / storageInfo.total) * 100) : 0;
  const storageKB = Math.round(storageInfo.used / 1024);

  const handleClearCache = () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("emr-op-") && !key.includes("session")) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
    toast.success(u("Cache cleared! Reloading...", "کیشے صاف ہو گئی! ری لوڈ ہو رہا ہے..."));
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleForceSync = async () => {
    toast.info(u("Syncing to cloud...", "کلاؤڈ پر بھیج رہے ہیں..."));
    const ok = await pushOperatorData();
    if (ok) toast.success(u("Synced!", "سنک ہو گیا!"));
    else toast.error(u("Sync failed", "سنک ناکام"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className={`rounded-2xl border p-5 sm:p-6 ${card}`}>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className={`text-xl font-bold ${txt}`}>{session?.full_name || session?.fullName || "Operator"}</h2>
            <p className={`text-sm ${sub}`}>{u("Computer Operator", "کمپیوٹر آپریٹر")} — Emerald Tech Partner</p>
            <p className={`text-xs mt-1 ${sub}`}>
              {u("Role", "کردار")}: <span className="text-emerald-500 font-medium">{u("Operator", "آپریٹر")}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className={`rounded-xl p-3 ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${sub}`}>{u("Status", "حیثیت")}</p>
            <p className={`text-lg font-bold mt-1 ${txt}`}>{u("Active", "فعال")}</p>
          </div>
          <div className={`rounded-xl p-3 ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${sub}`}>{u("Cloud Sync", "کلاؤڈ سنک")}</p>
            <div className="flex items-center gap-2 mt-1">
              {syncStatus === "synced" ? (
                <><Cloud className="w-4 h-4 text-emerald-500" /><span className="text-sm font-bold text-emerald-500">{u("Connected", "جڑا ہوا")}</span></>
              ) : syncStatus === "error" ? (
                <><CloudOff className="w-4 h-4 text-red-500" /><span className="text-sm font-bold text-red-500">{u("Error", "خرابی")}</span></>
              ) : (
                <><Wifi className="w-4 h-4 text-amber-500" /><span className="text-sm font-bold text-amber-500">{u("Syncing", "سنک ہو رہا")}</span></>
              )}
            </div>
          </div>
        </div>
        {lastSync && (
          <p className={`text-xs ${sub}`}>
            {u("Last synced", "آخری سنک")}: {new Date(lastSync).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
        <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${txt}`}>
          <HardDrive className="w-4 h-4 text-blue-500" /> {u("Local Storage", "مقامی سٹوریج")}
        </h3>
        <div className={`w-full h-3 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"} mb-2`}>
          <div className={`h-3 rounded-full transition-all ${storagePercent > 80 ? "bg-red-500" : storagePercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(storagePercent, 100)}%` }} />
        </div>
        <p className={`text-xs ${sub}`}>{storageKB} KB / {Math.round(storageInfo.total / 1024)} KB ({storagePercent}%)</p>
      </div>

      <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
        <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${txt}`}>
          <Shield className="w-4 h-4 text-purple-500" /> {u("Settings", "ترتیبات")}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {darkMode ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span className={`text-sm ${txt}`}>{u("Dark Mode", "ڈارک موڈ")}</span>
            </div>
            <button onClick={toggleDarkMode}
              className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? "bg-emerald-600" : "bg-gray-300"}`}>
              <motion.div animate={{ x: darkMode ? 24 : 2 }} className="absolute top-1 w-4 h-4 rounded-full bg-white shadow" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-green-500" />
              <span className={`text-sm ${txt}`}>{u("Language", "زبان")}</span>
            </div>
            <button onClick={toggleLanguage}
              className={`px-4 py-2 rounded-xl text-xs font-bold min-h-[36px] ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
              {isUrdu ? "Switch to English" : "اردو میں بدلیں"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className={`w-4 h-4 ${isPushEnabled() ? "text-emerald-500" : "text-gray-400"}`} />
              <span className={`text-sm ${txt}`}>{u("Push Notifications", "پش اطلاعات")}</span>
            </div>
            <button onClick={() => { setPushEnabled(!isPushEnabled()); window.location.reload(); }}
              className={`relative w-12 h-6 rounded-full transition-colors ${isPushEnabled() ? "bg-emerald-600" : dc ? "bg-gray-600" : "bg-gray-300"}`}>
              <motion.div animate={{ x: isPushEnabled() ? 24 : 2 }} className="absolute top-1 w-4 h-4 rounded-full bg-white shadow" />
            </button>
          </div>
          {getPushPermission() === "denied" && (
            <p className={`text-[10px] px-2 ${dc ? "text-red-400" : "text-red-500"}`}>
              {u("Browser notifications blocked. Enable in browser settings.", "براؤزر اطلاعات بلاک ہیں۔ براؤزر سیٹنگز میں فعال کریں۔")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleForceSync}
          className={`${bigBtn} bg-gradient-to-r from-blue-600 to-indigo-600 text-white`}>
          <Cloud className="w-5 h-5" /> {u("Force Sync", "فوری سنک")}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleClearCache}
          className={`${bigBtn} ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"}`}>
          <HardDrive className="w-5 h-5" /> {u("Clear Cache", "کیشے صاف")}
        </motion.button>
      </div>

      <motion.button whileTap={{ scale: 0.97 }} onClick={() => {
        pushOperatorData().catch(() => {});
        onLogout?.();
        toast.info(u("Logged out", "لاگ آؤٹ ہو گیا"));
      }} className={`${bigBtn} w-full bg-red-600 text-white`}>
        <LogOut className="w-5 h-5" /> {u("Logout", "لاگ آؤٹ")}
      </motion.button>
    </motion.div>
  );
}