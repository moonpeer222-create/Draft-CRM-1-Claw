import { useState } from "react";
import { Download } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "../../../lib/toast";
import { AttendanceEntry, STORAGE, load, save } from "./operatorTypes";

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
