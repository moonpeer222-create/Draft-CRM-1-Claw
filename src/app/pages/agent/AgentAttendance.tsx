import { AgentSidebar } from "../../components/AgentSidebar";
import {
  CheckCircle, MapPin, Camera, Clock, Calendar,
  LogIn, LogOut, TrendingUp, Award, X, Send,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useTheme } from "../../lib/ThemeContext";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem, modalVariants } from "../../lib/animations";
import { NotificationService } from "../../lib/notifications";
import { AttendanceService, type AttendanceRecord, type LeaveRequest } from "../../lib/attendanceService";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";

export function AgentAttendance() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const inputCls = `w-full px-4 py-3 sm:py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base sm:text-sm ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;

  // Get logged-in agent info
  const { profile } = useSupabaseAuth();
  const agentId = profile?.id || "AGENT-1";
  const agentName = profile?.full_name || "Agent";

  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | undefined>();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: "Vacation" as LeaveRequest["type"],
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTodayRecord(AttendanceService.getTodayRecord(agentId));
  };

  const isCheckedIn = todayRecord?.checkIn && !todayRecord?.checkOut;
  const isCheckedOut = todayRecord?.checkIn && todayRecord?.checkOut;

  const monthlyStats = useMemo(() => {
    return AttendanceService.getAgentMonthlyStats(agentId);
  }, [agentId]);

  const monthRecords = useMemo(() => {
    const now = new Date();
    return AttendanceService.getRecordsForAgentMonth(agentId, now.getFullYear(), now.getMonth() + 1);
  }, [agentId]);

  // Calculate working duration live
  const workingDuration = useMemo(() => {
    if (!todayRecord?.checkIn || todayRecord.checkOut) return null;
    try {
      const [time, period] = todayRecord.checkIn.split(" ");
      let [h, m] = time.split(":").map(Number);
      if (period === "PM" && h !== 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      const checkInMins = h * 60 + m;
      const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
      const diff = nowMins - checkInMins;
      if (diff < 0) return "0h 0m";
      return `${Math.floor(diff / 60)}h ${diff % 60}m`;
    } catch {
      return null;
    }
  }, [todayRecord, currentTime]);

  const handleCheckIn = () => {
    setIsLoading(true);
    const lt = toast.loading(isUrdu ? "حاضری لگ رہی ہے..." : "Checking in...");
    setTimeout(() => {
      const record = AttendanceService.checkIn(agentId, agentName, "Office - Main Branch");
      const time = record.checkIn!;
      const isLate = record.status === "late";

      NotificationService.notifyCheckIn(agentName, time, isLate ? "late" : "on-time");

      toast.dismiss(lt);
      if (isLate) {
        toast.warning(
          isUrdu
            ? `${time} پر دیر سے حاضری لگی۔ براہ کرم وقت پر آئیں`
            : `Checked in late at ${time}. Please arrive on time.`
        );
      } else {
        toast.success(
          isUrdu
            ? `${time} پر بروقت حاضری لگی! اچھا دن ہو!`
            : `Checked in on time at ${time}! Have a productive day!`
        );
      }

      // Check for streak milestone
      if (record.status === "on-time") {
        const stats = AttendanceService.getAgentMonthlyStats(agentId);
        if (stats.streak > 0 && stats.streak % 5 === 0) {
          NotificationService.notifyAttendanceStreak(agentName, stats.streak);
          toast.success(
            isUrdu
              ? `مبارک ہو! ${stats.streak} دن مسلسل بروقت حاضری!`
              : `Streak milestone! ${stats.streak} days on-time in a row!`
          );
        }
      }

      setIsLoading(false);
      loadData();
    }, 1200);
  };

  const handleCheckOut = () => {
    setIsLoading(true);
    const lt = toast.loading(isUrdu ? "روانگی ریکارڈ ہو رہی ہے..." : "Checking out...");
    setTimeout(() => {
      const record = AttendanceService.checkOut(agentId);
      if (!record) {
        toast.dismiss(lt);
        toast.error(isUrdu ? "پہلے حاضری لگائیں" : "No check-in found for today");
        setIsLoading(false);
        return;
      }

      NotificationService.notifyCheckOut(agentName, record.checkOut!, record.totalHours);

      // Check for overtime
      if (record.notes && record.notes.startsWith("Overtime")) {
        const overtimeStr = record.notes.replace("Overtime: ", "");
        NotificationService.notifyOvertimeWorked(
          agentName,
          overtimeStr,
          new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        );
      }

      toast.dismiss(lt);
      toast.success(
        isUrdu
          ? `${record.checkOut} پر روانگی ریکارڈ ہوئی۔ کل اوقات: ${record.totalHours}۔ شام بخیر!`
          : `Checked out at ${record.checkOut}. Total hours: ${record.totalHours}. Have a great evening!`
      );
      setIsLoading(false);
      loadData();
    }, 1200);
  };

  const handleSubmitLeave = () => {
    if (!leaveForm.startDate || !leaveForm.reason) {
      toast.error(isUrdu ? "براہ کرم تمام فیلڈز بھریں" : "Please fill all required fields");
      return;
    }
    setIsLoading(true);
    const lt = toast.loading(isUrdu ? "چھٹی کی درخواست جمع ہو رہی ہے..." : "Submitting leave request...");
    setTimeout(() => {
      const request = AttendanceService.submitLeaveRequest(
        agentId,
        agentName,
        leaveForm.type,
        leaveForm.startDate,
        leaveForm.endDate || leaveForm.startDate,
        leaveForm.reason,
      );
      NotificationService.notifyLeaveRequest(agentName, request.dates, request.type, request.reason);

      toast.dismiss(lt);
      toast.success(
        isUrdu
          ? "چھٹی کی درخواست جمع ہو گئی! منظوری کا انتظار کریں"
          : "Leave request submitted! Waiting for admin approval."
      );
      setShowLeaveModal(false);
      setLeaveForm({ type: "Vacation", startDate: "", endDate: "", reason: "" });
      setIsLoading(false);
    }, 1000);
  };

  const getStatusBadge = (status: AttendanceRecord["status"]) => {
    const map: Record<string, { bg: string; label: string }> = {
      "on-time": { bg: dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700", label: isUrdu ? "بروقت" : "On Time" },
      late: { bg: dc ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-700", label: isUrdu ? "دیر سے" : "Late" },
      absent: { bg: dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700", label: isUrdu ? "غیر حاضر" : "Absent" },
      "on-leave": { bg: dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700", label: isUrdu ? "چھٹی پر" : "Leave" },
      "half-day": { bg: dc ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700", label: isUrdu ? "نصف دن" : "Half Day" },
    };
    const s = map[status] || map["absent"];
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${s.bg}`}>{s.label}</span>;
  };

  const dateStr = currentTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = currentTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AgentSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AgentHeader />}

        <main className="p-3 sm:p-4 md:p-6">
          <div className="mb-6">
            <h1 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>{t("agentAttendance.title")}</h1>
            <p className={sub}>{t("agentAttendance.subtitle")}</p>
          </div>

          {/* Check-in/Check-out Hero Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl shadow-xl p-6 md:p-8 mb-6 text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-1">{dateStr}</h2>
                  <p className="text-blue-100 text-3xl md:text-4xl font-mono font-bold">{timeStr}</p>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
                  <MapPin className="w-5 h-5" />
                  <span className="text-sm font-medium">{isUrdu ? "آپ دفتر میں ہیں" : "You're at office"}</span>
                </div>
              </div>

              {/* Status Display */}
              {isCheckedIn && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-white/15 backdrop-blur-sm rounded-xl p-6 mb-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-100">{isUrdu ? "حاضری کا وقت" : "Checked in at"}</p>
                      <p className="text-3xl font-bold">{todayRecord?.checkIn}</p>
                      {todayRecord?.status === "late" && (
                        <span className="text-xs bg-yellow-500/30 px-2 py-0.5 rounded-full font-semibold">
                          {isUrdu ? "دیر سے" : "LATE"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-blue-100">
                    <div>
                      <p className="text-xs">{isUrdu ? "اوقات کار" : "Working Duration"}</p>
                      <p className="text-lg font-bold text-white">{workingDuration || "0h 0m"}</p>
                    </div>
                    <div>
                      <p className="text-xs">{isUrdu ? "مقام" : "Location"}</p>
                      <p className="text-sm text-white">{todayRecord?.location || "Office"}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {isCheckedOut && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-white/15 backdrop-blur-sm rounded-xl p-6 mb-4">
                  <div className="flex items-center gap-4 mb-2">
                    <CheckCircle className="w-10 h-10 text-blue-200" />
                    <div>
                      <p className="text-sm text-blue-100">{isUrdu ? "آج کا دن مکمل!" : "Day Complete!"}</p>
                      <p className="text-lg font-semibold">{todayRecord?.checkIn} → {todayRecord?.checkOut}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{isUrdu ? `کل اوقات: ${todayRecord?.totalHours}` : `Total Hours: ${todayRecord?.totalHours}`}</p>
                  {todayRecord?.notes && (
                    <p className="text-sm text-yellow-200 mt-2">{todayRecord.notes}</p>
                  )}
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                {!isCheckedIn && !isCheckedOut && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleCheckIn} disabled={isLoading}
                    className="flex-1 py-4 min-h-[44px] bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    <LogIn className="w-6 h-6" />
                    {isLoading ? (isUrdu ? "حاضری لگ رہی ہے..." : "Checking in...") : t("agentAttendance.checkIn")}
                  </motion.button>
                )}
                {isCheckedIn && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleCheckOut} disabled={isLoading}
                    className="flex-1 py-4 min-h-[44px] bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    <LogOut className="w-6 h-6" />
                    {isLoading ? (isUrdu ? "روانگی ریکارڈ ہو رہی ہے..." : "Checking out...") : t("agentAttendance.checkOut")}
                  </motion.button>
                )}
                {!isCheckedIn && !isCheckedOut && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => toast.info(isUrdu ? "کیمرا سمیولیشن۔ سیلفی منسلک ہو جائے گی" : "Camera simulated. Selfie would be attached.")}
                    className="py-4 border-2 border-white/50 text-white rounded-xl font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2 sm:w-auto px-6">
                    <Camera className="w-5 h-5" />
                    {isUrdu ? "سیلفی" : "Selfie"}
                  </motion.button>
                )}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowLeaveModal(true)}
                  className="py-4 border-2 border-white/50 text-white rounded-xl font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2 sm:w-auto px-6">
                  <Calendar className="w-5 h-5" />
                  {isUrdu ? "چھٹی کی درخواست" : "Request Leave"}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
            {[
              { icon: CheckCircle, color: "text-green-600", bgColor: dc ? "bg-green-900/20" : "bg-green-50", value: String(monthlyStats.daysPresent), label: t("agentAttendance.daysPresent") },
              { icon: Clock, color: "text-yellow-600", bgColor: dc ? "bg-yellow-900/20" : "bg-yellow-50", value: String(monthlyStats.lateArrivals), label: t("attendance.lateArrivals") },
              { icon: TrendingUp, color: "text-orange-600", bgColor: dc ? "bg-orange-900/20" : "bg-orange-50", value: `${monthlyStats.streak}d`, label: t("agentAttendance.dayStreak") },
              { icon: Award, color: "text-blue-600", bgColor: dc ? "bg-blue-900/20" : "bg-blue-50", value: `${monthlyStats.onTimeRate}%`, label: t("agentAttendance.onTimeRate") },
            ].map((s, idx) => {
              const Icon = s.icon;
              return (
                <motion.div key={idx} variants={staggerItem} whileHover={{ y: -4 }}
                  className={`${card} rounded-2xl shadow-lg p-4 md:p-5 border ${brd}`}>
                  <div className={`w-10 h-10 ${s.bgColor} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <h3 className={`text-xl md:text-2xl font-bold ${txt}`}>{s.value}</h3>
                  <p className={`text-xs md:text-sm ${sub}`}>{s.label}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Attendance History Calendar */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className={`${card} rounded-2xl shadow-lg p-4 md:p-6 border ${brd}`}>
            <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{t("agentAttendance.monthAttendance")}</h3>

            <div className="grid grid-cols-7 gap-2 mb-4">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className={`text-center text-xs font-semibold py-2 ${sub}`}>{day}</div>
              ))}
              {(() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const cells = [];

                for (let i = 0; i < firstDay; i++) {
                  cells.push(<div key={`empty-${i}`} />);
                }

                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const record = monthRecords.find(r => r.date === dateStr);
                  const isToday = d === now.getDate();
                  const isFuture = d > now.getDate();
                  const dayOfWeek = new Date(now.getFullYear(), now.getMonth(), d).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  let colorCls = dc ? "bg-gray-700/30 text-gray-500" : "bg-gray-50 text-gray-400";
                  if (isFuture) colorCls = dc ? "bg-gray-800 text-gray-600" : "bg-gray-100/50 text-gray-300";
                  else if (isWeekend) colorCls = dc ? "bg-gray-700/50 text-gray-500" : "bg-gray-50 text-gray-400";
                  else if (record) {
                    const statusColors: Record<string, string> = {
                      "on-time": dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700",
                      late: dc ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-700",
                      absent: dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700",
                      "on-leave": dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700",
                    };
                    colorCls = statusColors[record.status] || colorCls;
                  }

                  cells.push(
                    <motion.div key={d} whileHover={{ scale: 1.1 }}
                      className={`aspect-square flex flex-col items-center justify-center text-sm rounded-lg font-semibold transition-all cursor-default ${colorCls} ${isToday ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}>
                      <span className="text-xs">{d}</span>
                      {record && !isWeekend && (
                        <span className="text-[8px] mt-0.5 opacity-75">
                          {record.status === "on-time" ? "✓" : record.status === "late" ? "!" : record.status === "absent" ? "✗" : "—"}
                        </span>
                      )}
                    </motion.div>
                  );
                }

                return cells;
              })()}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
              {[
                { color: dc ? "bg-green-900/30" : "bg-green-100", label: isUrdu ? "بروقت" : "On Time" },
                { color: dc ? "bg-yellow-900/30" : "bg-yellow-100", label: isUrdu ? "دیر سے" : "Late" },
                { color: dc ? "bg-red-900/30" : "bg-red-100", label: isUrdu ? "غیر حاضر" : "Absent" },
                { color: dc ? "bg-blue-900/30" : "bg-blue-100", label: isUrdu ? "چھٹی" : "Leave" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`w-4 h-4 ${l.color} rounded`} />
                  <span className={dc ? "text-gray-300" : "text-gray-700"}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Recent History */}
            <div className={`mt-6 pt-4 border-t ${brd}`}>
              <h4 className={`text-sm font-semibold mb-3 ${txt}`}>{isUrdu ? "حالیہ حاضری" : "Recent Attendance"}</h4>
              <div className="space-y-2">
                {monthRecords.slice(0, 5).map(record => (
                  <div key={record.id} className={`flex items-center justify-between p-3 rounded-xl ${dc ? "bg-gray-700/30" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        record.status === "on-time" ? "bg-green-500"
                        : record.status === "late" ? "bg-yellow-500"
                        : record.status === "absent" ? "bg-red-500"
                        : "bg-blue-500"
                      }`} />
                      <div>
                        <p className={`text-sm font-medium ${txt}`}>
                          {new Date(record.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <p className={`text-xs ${sub}`}>
                          {record.checkIn ? `${record.checkIn}${record.checkOut ? ` → ${record.checkOut}` : ""}` : "-"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono ${txt}`}>{record.totalHours}</span>
                      {getStatusBadge(record.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </main>
      </div>

      {/* ========== LEAVE REQUEST MODAL ========== */}
      <AnimatePresence>
        {showLeaveModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => setShowLeaveModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto`}>
              <div className={`flex items-center justify-between p-6 border-b ${brd}`}>
                <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "چھٹی کی درخواست" : "Request Leave"}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowLeaveModal(false)}
                  className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                    {isUrdu ? "چھٹی کی قسم *" : "Leave Type *"}
                  </label>
                  <select value={leaveForm.type} onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value as LeaveRequest["type"] })} className={inputCls}>
                    {[
                      ["Vacation", isUrdu ? "چھٹی" : "Vacation"],
                      ["Sick Leave", isUrdu ? "بیماری" : "Sick Leave"],
                      ["Personal", isUrdu ? "ذاتی" : "Personal"],
                      ["Emergency", isUrdu ? "ہنگامی" : "Emergency"],
                      ["Other", isUrdu ? "دیگر" : "Other"],
                    ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "شروع تاریخ *" : "Start Date *"}
                    </label>
                    <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "آخری تاریخ" : "End Date"}
                    </label>
                    <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      min={leaveForm.startDate} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                    {isUrdu ? "وجہ *" : "Reason *"}
                  </label>
                  <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder={isUrdu ? "چھٹی کی وجہ بیان کریں..." : "Describe your reason for leave..."}
                    className={`${inputCls} min-h-[80px]`} />
                </div>
                <div className={`p-3 rounded-lg ${dc ? "bg-blue-900/20 border border-blue-800" : "bg-blue-50 border border-blue-200"}`}>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {isUrdu
                      ? "آپ کی درخواست ایڈمن کو بھیجی جائے گی اور نوٹیفکیشن بھی جائے گی"
                      : "Your request will be sent to admin with an instant notification"}
                  </p>
                </div>
              </div>
              <div className={`flex gap-3 p-6 border-t ${brd}`}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowLeaveModal(false)}
                  className={`flex-1 py-3 min-h-[44px] rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                  {isUrdu ? "منسوخ" : "Cancel"}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSubmitLeave} disabled={isLoading}
                  className="flex-1 py-3 min-h-[44px] bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  {isLoading ? (isUrdu ? "جمع ہو رہی ہے..." : "Submitting...") : (isUrdu ? "درخواست بھیجیں" : "Submit Request")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}