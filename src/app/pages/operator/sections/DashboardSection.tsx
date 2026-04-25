import {
  FolderPlus, Clock, Calendar, Users,
  AlertTriangle, DollarSign, Bell, CheckCircle2,
} from "lucide-react";
import { motion } from "motion/react";
import { type Case } from "../../../lib/mockData";
import { load, STORAGE, AttendanceEntry, PaymentRecord, Appointment, OfficeVisit, OperatorNotification as Notification } from "./operatorTypes";

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
