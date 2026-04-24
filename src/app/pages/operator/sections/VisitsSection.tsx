import { useState } from "react";
import {
  Building2, Plus, X, Check, Download,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../../lib/toast";
import { OfficeVisit, STORAGE, load, save } from "./operatorTypes";

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
              <option value="Expert">{u("Expert", "ایکسپرٹ")}</option>
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
