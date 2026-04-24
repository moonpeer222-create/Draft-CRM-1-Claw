import { useState } from "react";
import {
  RefreshCw, Plus, Calendar, Check, X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../../lib/toast";
import { type Case } from "../../../lib/mockData";
import { Appointment, STORAGE, load, save } from "./operatorTypes";

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
