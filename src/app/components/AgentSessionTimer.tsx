import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Clock, UserCheck } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "../lib/toast";
import { useTheme } from "../lib/ThemeContext";
import { AccessCodeService } from "../lib/accessCode";
import { AttendanceService } from "../lib/attendanceService";
import { AuditLogService } from "../lib/auditLog";

/**
 * AgentSessionTimer — Desktop-only header widget showing session countdown
 * and check-in button. Hidden on mobile (hidden md:flex) because
 * AgentMobileMenu now consolidates all session/check-in UI for mobile.
 *
 * The component remains mounted on all viewports so that its useEffect
 * still fires session-expiration warnings and auto-logout redirects.
 */
export function AgentSessionTimer() {
  const navigate = useNavigate();
  const { darkMode, t, isUrdu } = useTheme();
  const dc = darkMode;

  const [timeRemaining, setTimeRemaining] = useState(0);
  const [agentName, setAgentName] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  // Session timer + expiration detection (runs on ALL viewports)
  useEffect(() => {
    const session = AccessCodeService.getAgentSession();
    if (session) {
      setAgentName(session.agentName || "");
      setAgentId(session.agentId || "");

      const todayRecord = AttendanceService.getTodayRecord(session.agentId);
      setIsCheckedIn(!!todayRecord?.checkIn);
    }

    const interval = setInterval(() => {
      const remaining = AccessCodeService.getAgentTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        toast.error(t("auth.sessionExpired"));
        AccessCodeService.agentLogout();
        navigate("/agent/login");
      }

      // Warning at 30 min
      if (remaining > 0 && remaining <= 30 * 60 * 1000 && remaining > 29.9 * 60 * 1000) {
        toast.warning(t("auth.sessionExpiringWarning"));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [navigate, t]);

  const formatted = AccessCodeService.formatTimeRemaining(timeRemaining);
  const hoursLeft = timeRemaining / (1000 * 60 * 60);
  const isLow = hoursLeft < 1;
  const isCritical = hoursLeft < 0.5;

  const handleCheckIn = () => {
    if (!agentId || !agentName) {
      toast.error(isUrdu ? "ایجنٹ کی معلومات دستیاب نہیں ہیں" : "Agent information not available");
      return;
    }

    if (isCheckedIn) {
      toast.info(isUrdu ? "آج آپ پہلے ہی چیک ان ہو چکے ہیں" : "You have already checked in today");
      return;
    }

    try {
      const record = AttendanceService.checkIn(agentId, agentName);
      setIsCheckedIn(true);

      AuditLogService.log(
        agentId,
        agentName,
        "agent",
        "check-in",
        "attendance",
        `Agent checked in at ${record.checkIn} (${record.status})`
      );

      if (record.status === "late") {
        toast.warning(
          isUrdu
            ? `تاخیر سے چیک ان - وقت: ${record.checkIn}`
            : `Late check-in recorded at ${record.checkIn}`,
          { duration: 4000 }
        );
      } else {
        toast.success(
          isUrdu
            ? `چیک ان کامیاب - وقت: ${record.checkIn}`
            : `Checked in successfully at ${record.checkIn}`,
          { duration: 3000 }
        );
      }
    } catch (error) {
      toast.error(isUrdu ? "چیک ان میں خرابی" : "Failed to check in");
    }
  };

  // Root is hidden md:flex — invisible on mobile but stays mounted for effects
  return (
    <div className="hidden md:flex items-center gap-2">
      {/* Check-in button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleCheckIn}
        disabled={isCheckedIn}
        className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
          isCheckedIn
            ? dc
              ? "bg-gray-700 text-gray-400 border border-gray-600 cursor-not-allowed"
              : "bg-gray-100 text-gray-500 border border-gray-300 cursor-not-allowed"
            : dc
            ? "bg-blue-600 hover:bg-blue-700 text-white border border-blue-500"
            : "bg-blue-500 hover:bg-blue-600 text-white border border-blue-400"
        }`}
      >
        <UserCheck className="w-4 h-4" />
        <span>{isCheckedIn ? t("auth.checkedIn") : t("auth.checkIn")}</span>
        {isCheckedIn && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"
          />
        )}
      </motion.button>

      {/* Session timer */}
      <div
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ${
          isCritical
            ? "bg-red-500/10 text-red-500 border border-red-500/20"
            : isLow
            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
            : dc
            ? "bg-gray-700 text-gray-300 border border-gray-600"
            : "bg-gray-100 text-gray-600 border border-gray-200"
        }`}
      >
        <Clock className="w-4 h-4" />
        <span className="font-mono tabular-nums" dir="ltr">
          {formatted}
        </span>
      </div>
    </div>
  );
}
