import { useState } from "react";
import {
  Search, ChevronRight, Eye, FileText, User, MapPin, Phone, DollarSign, ArrowUpDown,
} from "lucide-react";
import { motion } from "motion/react";
import { type Case } from "../../../lib/mockData";
import { ImageLightbox } from "../../../components/ImageLightbox";

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
