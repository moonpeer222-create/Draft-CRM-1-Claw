import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import {
  Calendar, CheckCircle, XCircle, Clock, AlertCircle, Download, UserX,
  Search, Phone, MessageCircle, ChevronLeft, ChevronRight, Award, UserCheck, X,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { usePortalPrefix } from "../../lib/usePortalPrefix";
import { useTheme } from "../../lib/ThemeContext";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../lib/toast";
import { modalVariants, staggerContainer, staggerItem } from "../../lib/animations";
import { NotificationService } from "../../lib/notifications";
import { AttendanceService, type AttendanceRecord, type LeaveRequest } from "../../lib/attendanceService";

export function AdminAttendance() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showMarkAbsentModal, setShowMarkAbsentModal] = useState(false);
  const [showLeaveDetailModal, setShowLeaveDetailModal] = useState<LeaveRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Calendar month navigation
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Agent to mark absent
  const [absentAgentName, setAbsentAgentName] = useState("");
  const [absentAgentId, setAbsentAgentId] = useState("");

  const agents = [
    { id: "AGENT-1", name: "Faizan" },
    { id: "AGENT-2", name: "Imran" },
    { id: "AGENT-3", name: "Safeer" },
    { id: "AGENT-4", name: "Aynee" },
  ];

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // Deep-link: highlight agent from notification click
  const [deepLinkedAgent, setDeepLinkedAgent] = useState<string | null>(null);
  const location = useLocation();
  useEffect(() => {
    const state = location.state as { highlightAgent?: string; fromNotification?: boolean } | null;
    if (state?.highlightAgent) {
      setSearchTerm(state.highlightAgent);
      if (state.fromNotification) {
        setDeepLinkedAgent(state.highlightAgent);
        setTimeout(() => setDeepLinkedAgent(null), 3700);
        toast.success(isUrdu ? `${state.highlightAgent} کی حاضری دکھائی جا رہی ہے` : `Showing attendance for ${state.highlightAgent}`);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadData = () => {
    setRecords(AttendanceService.getRecordsForDate(selectedDate));
    setLeaveRequests(AttendanceService.getPendingLeaveRequests());
  };

  const summary = useMemo(() => {
    const present = records.filter(r => r.status === "on-time").length;
    const late = records.filter(r => r.status === "late").length;
    const absent = records.filter(r => r.status === "absent").length;
    const onLeave = records.filter(r => r.status === "on-leave").length;
    return { present, late, absent, onLeave, total: records.length };
  }, [records]);

  const filteredRecords = useMemo(() => {
    let filtered = [...records];
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.agentName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    return filtered;
  }, [records, searchTerm, statusFilter]);

  const handleApproveLeave = (request: LeaveRequest) => {
    const lt = toast.loading(isUrdu ? "چھٹی منظور ہو رہی ہے..." : "Approving leave...");
    setTimeout(() => {
      AttendanceService.approveLeave(request.id);
      NotificationService.notifyLeaveApproved(request.agentName, request.dates);
      toast.dismiss(lt);
      toast.success(
        isUrdu
          ? `${request.agentName} کی چھٹی منظور ہوئی`
          : `${request.agentName}'s leave approved for ${request.dates}`
      );
      loadData();
      setShowLeaveDetailModal(null);
    }, 800);
  };

  const handleRejectLeave = (request: LeaveRequest) => {
    const lt = toast.loading(isUrdu ? "چھٹی مسترد ہو رہی ہے..." : "Rejecting leave...");
    setTimeout(() => {
      AttendanceService.rejectLeave(request.id);
      NotificationService.notifyLeaveRejected(request.agentName, request.dates);
      toast.dismiss(lt);
      toast.info(
        isUrdu
          ? `${request.agentName} کی چھٹی مسترد ہوئی`
          : `${request.agentName}'s leave request rejected`
      );
      loadData();
      setShowLeaveDetailModal(null);
    }, 800);
  };

  const handleMarkAbsent = () => {
    if (!absentAgentId) {
      toast.error(isUrdu ? "ایجنٹ منتخب کریں" : "Please select an agent");
      return;
    }
    const lt = toast.loading(isUrdu ? "غیر حاضری ریکارڈ ہو رہی ہے..." : "Recording absence...");
    setTimeout(() => {
      AttendanceService.markAbsent(absentAgentId, absentAgentName, selectedDate);
      NotificationService.notifyAbsentAgent(absentAgentName, selectedDate);
      toast.dismiss(lt);
      toast.success(
        isUrdu
          ? `${absentAgentName} غیر حاضری ریکارڈ ہوا`
          : `${absentAgentName} marked as absent for ${selectedDate}`
      );
      setShowMarkAbsentModal(false);
      setAbsentAgentId("");
      setAbsentAgentName("");
      loadData();
    }, 800);
  };

  const handleExportReport = () => {
    const lt = toast.loading(isUrdu ? "رپورٹ ایکسپورٹ ہو رہی ہے..." : "Exporting attendance report...");
    setTimeout(() => {
      const allRecords = AttendanceService.getRecords();
      const headers = "Date,Agent,Check In,Check Out,Hours,Status\n";
      const rows = allRecords
        .filter(r => r.date.startsWith(selectedDate.substring(0, 7)))
        .map(r => `${r.date},${r.agentName},${r.checkIn || "-"},${r.checkOut || "-"},${r.totalHours},${r.status}`)
        .join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${selectedDate.substring(0, 7)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(lt);
      toast.success(isUrdu ? "رپورٹ ایکسپورٹ ہو گئی!" : "Attendance report exported!");
    }, 1500);
  };

  const getStatusBadge = (status: AttendanceRecord["status"]) => {
    const map: Record<string, { bg: string; label: string; labelUrdu: string }> = {
      "on-time": {
        bg: dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700",
        label: "On Time", labelUrdu: "بروقت",
      },
      late: {
        bg: dc ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-700",
        label: "Late", labelUrdu: "دیر سے",
      },
      absent: {
        bg: dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700",
        label: "Absent", labelUrdu: "غیر حاضر",
      },
      "on-leave": {
        bg: dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700",
        label: "On Leave", labelUrdu: "چھٹی پر",
      },
      "half-day": {
        bg: dc ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700",
        label: "Half Day", labelUrdu: "نصف دن",
      },
    };
    const s = map[status] || map["absent"];
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${s.bg}`}>{isUrdu ? s.labelUrdu : s.label}</span>;
  };

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { day: number; dateStr: string; records: AttendanceRecord[] }[] = [];

    const allRecords = AttendanceService.getRecords();
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, dateStr: "", records: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${prefix}-${String(d).padStart(2, "0")}`;
      const dayRecords = allRecords.filter(r => r.date === dateStr);
      days.push({ day: d, dateStr, records: dayRecords });
    }
    return days;
  }, [calendarMonth]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const navigateMonth = (dir: -1 | 1) => {
    setCalendarMonth(prev => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const getCalendarDayColor = (dayData: typeof calendarDays[0]) => {
    if (dayData.day === 0) return "";
    if (dayData.records.length === 0) return dc ? "bg-gray-700/30 text-gray-500" : "bg-gray-50 text-gray-400";
    const hasAbsent = dayData.records.some(r => r.status === "absent");
    const hasLate = dayData.records.some(r => r.status === "late");
    const allOnTime = dayData.records.every(r => r.status === "on-time" || r.status === "on-leave");
    if (hasAbsent) return dc ? "bg-red-900/20 text-red-400 ring-1 ring-red-500/30" : "bg-red-50 text-red-700 ring-1 ring-red-200";
    if (hasLate) return dc ? "bg-yellow-900/20 text-yellow-400 ring-1 ring-yellow-500/30" : "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200";
    if (allOnTime) return dc ? "bg-green-900/20 text-green-400 ring-1 ring-green-500/30" : "bg-green-50 text-green-700 ring-1 ring-green-200";
    return dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700";
  };

  const navigate = useNavigate();
  const prefix = usePortalPrefix();
  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}

        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div>
              <h1 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>{t("attendance.title")}</h1>
              <p className={sub}>{t("attendance.subtitle")}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowMarkAbsentModal(true)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all ${dc ? "border-red-700 text-red-400 hover:bg-red-900/20" : "border-red-300 text-red-600 hover:bg-red-50"}`}>
                <UserX className="w-4 h-4" />
                {isUrdu ? "غیر حاضر" : "Mark Absent"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleExportReport}
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-white"}`}>
                <Download className="w-4 h-4" />
                {t("attendance.exportReport")}
              </motion.button>
            </div>
          </motion.div>

          {/* Summary Cards */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
            {[
              { icon: CheckCircle, color: "text-green-600", bgColor: dc ? "bg-green-900/20" : "bg-green-50", value: summary.present, label: t("attendance.presentToday") },
              { icon: Clock, color: "text-yellow-600", bgColor: dc ? "bg-yellow-900/20" : "bg-yellow-50", value: summary.late, label: t("attendance.lateArrivals") },
              { icon: XCircle, color: "text-red-600", bgColor: dc ? "bg-red-900/20" : "bg-red-50", value: summary.absent, label: t("attendance.absent") },
              { icon: AlertCircle, color: "text-blue-600", bgColor: dc ? "bg-blue-900/20" : "bg-blue-50", value: summary.onLeave, label: t("attendance.onLeave") },
            ].map((s, idx) => {
              const Icon = s.icon;
              return (
                <motion.div key={idx} variants={staggerItem} whileHover={{ y: -4 }}
                  onClick={() => {
                    const statusMap: Record<number, string> = { 0: "on-time", 1: "late", 2: "absent", 3: "on-leave" };
                    setStatusFilter(statusMap[idx] || "all");
                  }}
                  className={`${card} rounded-2xl shadow-lg p-4 md:p-5 border ${brd} cursor-pointer active:opacity-80 touch-manipulation`}>
                  <div className={`w-10 h-10 ${s.bgColor} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${txt}`}>{s.value}</h3>
                  <p className={`text-xs md:text-sm ${sub}`}>{s.label}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Daily Attendance Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className={`lg:col-span-2 ${card} rounded-2xl shadow-lg overflow-hidden border ${brd}`}>
              {/* Table Header */}
              <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 border-b ${brd} gap-3`}>
                <h3 className={`text-lg font-semibold ${txt}`}>{t("attendance.dailyLog")}</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={isUrdu ? "تلاش..." : "Search agent..."}
                      className={`pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`} />
                  </div>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}>
                    <option value="all">{isUrdu ? "سب" : "All Status"}</option>
                    <option value="on-time">{isUrdu ? "بروقت" : "On Time"}</option>
                    <option value="late">{isUrdu ? "دیر سے" : "Late"}</option>
                    <option value="absent">{isUrdu ? "غیر حاضر" : "Absent"}</option>
                    <option value="on-leave">{isUrdu ? "چھٹی پر" : "On Leave"}</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-4 h-4 ${sub}`} />
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                      className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`} />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={dc ? "bg-gray-700" : "bg-gray-50"}>
                    <tr>
                      {[
                        isUrdu ? "ایجنٹ" : "Agent",
                        isUrdu ? "حاضری" : "Check-in",
                        isUrdu ? "روانگی" : "Check-out",
                        isUrdu ? "گھنٹے" : "Hours",
                        isUrdu ? "حیثیت" : "Status",
                        isUrdu ? "عمل" : "Actions",
                      ].map(h => (
                        <th key={h} className={`text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider ${dc ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <AlertCircle className={`w-10 h-10 mx-auto mb-3 ${sub}`} />
                          <p className={sub}>{isUrdu ? "کوئی ریکارڈ نہیں ملا" : "No attendance records found"}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((record, idx) => (
                        <motion.tr key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`border-b ${deepLinkedAgent === record.agentName ? "animate-notif-row" : ""} ${dc ? "border-gray-700/50 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50"}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {record.agentName.split(" ").map(n => n[0]).join("")}
                              </div>
                              <div>
                                <p className={`text-sm font-semibold ${txt}`}>{record.agentName}</p>
                                {record.location && <p className={`text-xs ${sub}`}>{record.location}</p>}
                              </div>
                            </div>
                          </td>
                          <td className={`py-3 px-4 text-sm font-mono ${record.checkIn ? (dc ? "text-gray-300" : "text-gray-900") : sub}`}>
                            {record.checkIn || "-"}
                          </td>
                          <td className={`py-3 px-4 text-sm font-mono ${record.checkOut ? (dc ? "text-gray-300" : "text-gray-900") : sub}`}>
                            {record.checkOut || (record.checkIn ? (isUrdu ? "ابھی تک" : "Still in") : "-")}
                          </td>
                          <td className={`py-3 px-4 text-sm font-semibold ${txt}`}>
                            {record.totalHours}
                            {record.notes && record.notes.startsWith("Overtime") && (
                              <span className="block text-xs text-orange-500">{record.notes}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(record.status)}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                  window.open(`tel:+923001234567`);
                                  toast.info(`Calling ${record.agentName}...`);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                                <Phone className="w-4 h-4" />
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                  window.open(`https://wa.me/923001234567`);
                                  toast.info(`WhatsApp ${record.agentName}`);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                                <MessageCircle className="w-4 h-4" />
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Calendar Overview */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className={`${card} rounded-2xl shadow-lg p-4 md:p-6 border ${brd}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${txt}`}>{t("attendance.monthlyOverview")}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigateMonth(-1)} className={`p-1 rounded-lg ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                    <ChevronLeft className={`w-4 h-4 ${sub}`} />
                  </button>
                  <span className={`text-sm font-medium ${txt}`}>
                    {monthNames[calendarMonth.month]} {calendarMonth.year}
                  </span>
                  <button onClick={() => navigateMonth(1)} className={`p-1 rounded-lg ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                    <ChevronRight className={`w-4 h-4 ${sub}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5 mb-4">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className={`text-center text-xs font-semibold py-1 ${sub}`}>{day}</div>
                ))}
                {calendarDays.map((dayData, i) => (
                  <motion.div key={i} whileHover={dayData.day > 0 ? { scale: 1.1 } : {}}
                    onClick={() => {
                      if (dayData.day > 0) {
                        setSelectedDate(dayData.dateStr);
                        loadData();
                      }
                    }}
                    className={`aspect-square flex flex-col items-center justify-center text-sm rounded-lg cursor-pointer transition-all ${dayData.day === 0 ? "" : getCalendarDayColor(dayData)} ${dayData.dateStr === selectedDate ? "ring-2 ring-blue-500 font-bold" : ""}`}>
                    {dayData.day > 0 && (
                      <>
                        <span className="text-xs">{dayData.day}</span>
                        {dayData.records.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {dayData.records.some(r => r.status === "absent") && <div className="w-1 h-1 bg-red-500 rounded-full" />}
                            {dayData.records.some(r => r.status === "late") && <div className="w-1 h-1 bg-yellow-500 rounded-full" />}
                            {dayData.records.some(r => r.status === "on-time") && <div className="w-1 h-1 bg-green-500 rounded-full" />}
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Legend */}
              <div className="space-y-2 text-xs">
                {[
                  { color: "bg-green-500", label: isUrdu ? "بروقت" : "On Time" },
                  { color: "bg-yellow-500", label: isUrdu ? "دیر سے" : "Late" },
                  { color: "bg-red-500", label: isUrdu ? "غیر حاضر" : "Absent" },
                  { color: "bg-blue-500", label: isUrdu ? "چھٹی پر" : "On Leave" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${l.color} rounded-full`} />
                    <span className={dc ? "text-gray-300" : "text-gray-700"}>{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Agent Performance Highlights */}
              <div className={`mt-6 pt-4 border-t ${brd}`}>
                <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${txt}`}>
                  <Award className="w-4 h-4 text-blue-600" />
                  {isUrdu ? "بہترین حاضری" : "Top Attendance"}
                </h4>
                <div className="space-y-2">
                  {agents.slice(0, 3).map(agent => {
                    const stats = AttendanceService.getAgentMonthlyStats(agent.id);
                    return (
                      <div key={agent.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer active:opacity-80 touch-manipulation ${dc ? "bg-gray-700/30 hover:bg-gray-700/50" : "bg-gray-50 hover:bg-gray-100"}`}
                        onClick={() => navigate(`${prefix}/team`, { state: { highlightAgent: agent.name } })}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                            {agent.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <span className={`text-xs font-medium ${txt}`}>{agent.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-blue-600">{stats.onTimeRate}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Leave Requests */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className={`${card} rounded-2xl shadow-lg p-4 md:p-6 border ${brd}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${txt}`}>{t("attendance.leaveRequests")}</h3>
              {leaveRequests.length > 0 && (
                <span className="px-2.5 py-1 text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
                  {leaveRequests.length} {isUrdu ? "زیر التوا" : "pending"}
                </span>
              )}
            </div>

            {leaveRequests.length > 0 ? (
              <div className="space-y-3">
                {leaveRequests.map((request, idx) => (
                  <motion.div key={request.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl gap-3 border ${dc ? "bg-gray-700/30 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {request.agentName.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <h4 className={`font-semibold ${txt}`}>{request.agentName}</h4>
                        <p className={`text-sm ${sub}`}>{request.dates} • {request.type}</p>
                        <p className={`text-xs mt-0.5 ${dc ? "text-gray-500" : "text-gray-500"}`}>{request.reason}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setShowLeaveDetailModal(request)}
                        className={`px-3 py-2 border rounded-lg text-sm ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-600" : "border-gray-300 text-gray-700 hover:bg-gray-100"}`}>
                        {isUrdu ? "تفصیلات" : "Details"}
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => handleApproveLeave(request)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                        {t("attendance.approve")}
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => handleRejectLeave(request)}
                        className={`px-4 py-2 border rounded-lg text-sm font-medium ${dc ? "border-red-700 text-red-400 hover:bg-red-900/20" : "border-red-300 text-red-600 hover:bg-red-50"}`}>
                        {t("attendance.reject")}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <UserCheck className={`w-12 h-12 mx-auto mb-3 ${sub}`} />
                <p className={sub}>{isUrdu ? "کوئی زیر التوا چھٹی کی درخواست نہیں" : "No pending leave requests"}</p>
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* ========== MARK ABSENT MODAL ========== */}
      <AnimatePresence>
        {showMarkAbsentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowMarkAbsentModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-md`}>
              <div className={`flex items-center justify-between p-6 border-b ${brd}`}>
                <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "غیر حاضر ریکارڈ کریں" : "Mark Agent Absent"}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowMarkAbsentModal(false)}
                  className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                    {isUrdu ? "ایجنٹ منتخب کریں" : "Select Agent"}
                  </label>
                  <select value={absentAgentId} onChange={(e) => {
                    setAbsentAgentId(e.target.value);
                    const agent = agents.find(a => a.id === e.target.value);
                    setAbsentAgentName(agent?.name || "");
                  }} className={inputCls}>
                    <option value="">{isUrdu ? "-- منتخب کریں --" : "-- Select Agent --"}</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                    {isUrdu ? "تاریخ" : "Date"}
                  </label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={inputCls} />
                </div>
                {absentAgentName && (
                  <div className={`p-3 rounded-lg ${dc ? "bg-red-900/20 border border-red-800" : "bg-red-50 border border-red-200"}`}>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {isUrdu
                        ? `${absentAgentName} کو ${selectedDate} کے لیے غیر حاضر ریکارڈ کیا جائے گا اور نوٹیفکیشن بھیجی جائے گی`
                        : `${absentAgentName} will be marked absent for ${selectedDate} and a notification will be sent`}
                    </p>
                  </div>
                )}
              </div>
              <div className={`flex gap-3 p-6 border-t ${brd}`}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowMarkAbsentModal(false)}
                  className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                  {isUrdu ? "منسوخ" : "Cancel"}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleMarkAbsent}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold">
                  {isUrdu ? "غیر حاضر ریکارڈ کریں" : "Mark Absent"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== LEAVE DETAIL MODAL ========== */}
      <AnimatePresence>
        {showLeaveDetailModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLeaveDetailModal(null)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-md`}>
              <div className={`flex items-center justify-between p-6 border-b ${brd}`}>
                <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "چھٹی کی تفصیلات" : "Leave Request Details"}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowLeaveDetailModal(null)}
                  className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                    {showLeaveDetailModal.agentName.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${txt}`}>{showLeaveDetailModal.agentName}</h3>
                    <p className={`text-sm ${sub}`}>{showLeaveDetailModal.type}</p>
                  </div>
                </div>

                {[
                  { label: isUrdu ? "تاریخیں" : "Dates", value: showLeaveDetailModal.dates },
                  { label: isUrdu ? "وجہ" : "Reason", value: showLeaveDetailModal.reason },
                  { label: isUrdu ? "جمع کرایا" : "Submitted", value: new Date(showLeaveDetailModal.submittedAt).toLocaleString() },
                ].map((item) => (
                  <div key={item.label} className={`p-3 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                    <p className={`text-xs ${sub} mb-1`}>{item.label}</p>
                    <p className={`text-sm font-medium ${txt}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className={`flex gap-3 p-6 border-t ${brd}`}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => handleRejectLeave(showLeaveDetailModal)}
                  className={`flex-1 py-3 rounded-xl border font-semibold ${dc ? "border-red-700 text-red-400 hover:bg-red-900/20" : "border-red-300 text-red-600 hover:bg-red-50"}`}>
                  {t("attendance.reject")}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => handleApproveLeave(showLeaveDetailModal)}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold">
                  {t("attendance.approve")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}