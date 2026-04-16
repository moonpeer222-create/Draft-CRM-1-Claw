import { useEffect, useState } from "react";
import { Key, Copy, Check, Clock } from "lucide-react";
import { AccessCodeService } from "../lib/accessCode";
import { toast } from "../lib/toast";
import { useTheme } from "../lib/ThemeContext";
import { copyToClipboard } from "../lib/clipboard";
import { motion } from "motion/react";

export function AgentVerificationCode() {
  const { darkMode, isUrdu } = useTheme();
  const [code, setCode] = useState("");
  const [timeRemaining, setTimeRemaining] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadCode();

    // Update time remaining every 30 seconds
    const interval = setInterval(() => {
      updateTimeRemaining();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadCode = () => {
    // Get agent ID from session
    const session = AccessCodeService.getAgentSession();
    if (!session) {
      console.log("No agent session found");
      return;
    }

    const agentCode = AccessCodeService.getAgentCode(session.agentId);
    if (agentCode) {
      console.log("Agent code loaded:", agentCode);
      setCode(agentCode.code);
      setExpiresAt(agentCode.expiresAt);
      updateTimeRemaining(agentCode.expiresAt);
    } else {
      console.log("No code found for agent:", session.agentId);
    }
  };

  const updateTimeRemaining = (expires?: number) => {
    const expiry = expires || expiresAt;
    if (!expiry) return;

    const remaining = Math.max(0, expiry - Date.now());
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (remaining === 0) {
      setTimeRemaining(isUrdu ? "منقضی" : "Expired");
    } else if (hours > 0) {
      setTimeRemaining(`${hours}h ${minutes}m`);
    } else {
      setTimeRemaining(`${minutes}m`);
    }
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(code);
      setCopied(true);
      toast.success(isUrdu ? "کوڈ کاپی ہو گیا" : "Code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(isUrdu ? "کاپی ناکام" : "Failed to copy");
    }
  };

  if (!code) return null;

  const isExpiringSoon = expiresAt - Date.now() < 30 * 60 * 1000; // Less than 30 minutes

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-4 border-2 mb-6 ${
        isExpiringSoon
          ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800"
          : "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2 rounded-lg ${darkMode ? "bg-gray-700" : "bg-white"}`}>
            <Key className={`w-5 h-5 ${isExpiringSoon ? "text-orange-600" : "text-blue-600"}`} />
          </div>
          <div className="flex-1">
            <p className={`text-xs font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              {isUrdu ? "میری رسائی کوڈ" : "My Access Code"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-2xl font-bold font-mono tracking-widest ${
                darkMode ? "text-white" : "text-gray-900"
              }`}>
                {code}
              </span>
              <button
                onClick={handleCopy}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? "hover:bg-gray-600" : "hover:bg-gray-200"
                }`}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 mb-1">
            <Clock className={`w-4 h-4 ${isExpiringSoon ? "text-orange-600" : "text-blue-600"}`} />
            <span className={`text-lg font-bold ${
              isExpiringSoon ? "text-orange-600" : "text-blue-600"
            }`}>
              {timeRemaining}
            </span>
          </div>
          <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
            {isUrdu ? "باقی" : "remaining"}
          </p>
        </div>
      </div>
      <p className={`text-xs mt-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
        {isUrdu 
          ? "یہ کوڈ 6 گھنٹے تک درست ہے۔ تصدیق کے لیے اسے ایڈمن کو دکھائیں۔"
          : "This code is valid for 6 hours. Show it to admin for verification."}
      </p>
    </motion.div>
  );
}
