import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { Briefcase, Globe, Sun, Moon, ArrowLeft, ShieldCheck, RefreshCw, MessageCircle, Clock, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "../../lib/toast";
import { useTheme } from "../../lib/ThemeContext";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { clearServerPanic } from "../../lib/panicMode";
import { formatTimeRemaining } from "../../lib/agentAuth";
import { AccessCodeService } from "../../lib/accessCode";

export function AgentLogin() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, isUrdu, fontClass, t, toggleLanguage, language } = useTheme();
  const { signInAgentWithCode } = useSupabaseAuth();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(AccessCodeService.getTOTPTimeRemaining());
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dc = darkMode;

  useEffect(() => {
    clearServerPanic();
  }, []);

  // Countdown timer for current TOTP window
  useEffect(() => {
    const tick = () => {
      setTimeLeft(AccessCodeService.getTOTPTimeRemaining());
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const handleChange = useCallback((index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(-1);
    if (!v) return;
    setDigits((prev) => {
      const next = [...prev];
      next[index] = v;
      return next;
    });
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = "";
        } else if (index > 0) {
          next[index - 1] = "";
          inputRefs.current[index - 1]?.focus();
        }
        return next;
      });
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = text.split("").concat(Array(6).fill("")).slice(0, 6);
    setDigits(next);
    const focusIndex = Math.min(text.length, 5);
    inputRefs.current[focusIndex]?.focus();
  }, []);

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length !== 6) {
      toast.error(isUrdu ? "براہ کرم 6 ہندسوں کا کوڈ مکمل کریں" : "Please enter the complete 6-digit code");
      return;
    }
    setIsLoading(true);
    const { error } = await signInAgentWithCode(code);
    if (error) {
      toast.error(error);
      setIsLoading(false);
      return;
    }
    toast.success(isUrdu ? "خوش آمدید، ایجنٹ!" : "Welcome, Agent!");
    navigate("/agent");
    setIsLoading(false);
  };

  const handleRequestCode = () => {
    const phone = "03186986259";
    const text = isUrdu
      ? encodeURIComponent("سلام، مجھے اپنا 6 ہندسوں کا ایجنٹ لاگ ان کوڈ چاہیے۔")
      : encodeURIComponent("Hi, please send me my 6-digit agent login code.");
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  const allFilled = digits.every((d) => d !== "");

  return (
    <div
      className={`${isUrdu ? fontClass : ""} min-h-screen flex items-center justify-center transition-colors duration-500 relative overflow-hidden px-4 ${
        dc ? "bg-gray-950" : "bg-gradient-to-br from-blue-50 via-white to-emerald-50"
      }`}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl ${dc ? "bg-blue-900/20" : "bg-blue-200/40"}`}
        />
        <motion.div
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className={`absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl ${dc ? "bg-emerald-900/20" : "bg-emerald-200/30"}`}
        />
      </div>

      {/* Top controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`absolute top-4 ${isUrdu ? "left-4" : "right-4"} flex gap-2 z-20`}
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            toggleLanguage();
            toast.info(`${t("lang.changed")} ${language === "en" ? "اردو" : "English"}`);
          }}
          className={`p-2.5 rounded-xl backdrop-blur-md shadow-lg transition-all ${
            dc ? "bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50" : "bg-white/90 hover:bg-white border border-gray-200/50"
          }`}
        >
          <Globe className={`w-4 h-4 ${dc ? "text-gray-300" : "text-gray-700"}`} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            toggleDarkMode();
            toast.info(!darkMode ? t("darkEnabled") : t("lightEnabled"));
          }}
          className={`p-2.5 rounded-xl backdrop-blur-md shadow-lg transition-all ${
            dc ? "bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50" : "bg-white/90 hover:bg-white border border-gray-200/50"
          }`}
        >
          {dc ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-gray-700" />}
        </motion.button>
      </motion.div>

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/")}
        className={`absolute top-4 ${isUrdu ? "right-4" : "left-4"} flex items-center gap-2 text-sm font-medium z-20 ${
          dc ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
        }`}
      >
        <ArrowLeft className={`w-4 h-4 ${isUrdu ? "rotate-180" : ""}`} />
        <span>{isUrdu ? "واپس" : "Back"}</span>
      </motion.button>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-8 border backdrop-blur-xl ${
          dc ? "bg-gray-900/90 border-gray-700/60" : "bg-white/95 border-gray-200/50"
        }`}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-600 to-emerald-500`}
          >
            <Briefcase className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className={`text-2xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>
            {isUrdu ? "ایجنٹ پورٹل" : "Agent Portal"}
          </h1>
          <p className={`text-sm mt-1 ${dc ? "text-gray-400" : "text-gray-500"}`}>
            {isUrdu ? "ایجنٹ لاگ ان" : "Agent Login"}
          </p>
        </div>

        {/* TOTP validity badge */}
        <div className={`flex items-center justify-center gap-2 mb-6 px-4 py-2 rounded-full text-xs font-medium w-fit mx-auto ${
          dc ? "bg-blue-900/30 text-blue-300 border border-blue-800/40" : "bg-blue-50 text-blue-700 border border-blue-100"
        }`}>
          <Clock className="w-3.5 h-3.5" />
          <span>{isUrdu ? "کوڈ کی مدت:" : "Code valid for:"}</span>
          <span className="font-mono">{formatTimeRemaining(timeLeft)}</span>
        </div>

        {/* 6-Digit Code Input */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-3 text-center ${dc ? "text-gray-300" : "text-gray-700"}`}>
            {isUrdu ? "6 ہندسوں کا کوڈ درج کریں" : "Enter 6-Digit Access Code"}
          </label>
          <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all ${
                  dc
                    ? "bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    : "bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Verify Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleVerify}
          disabled={!allFilled || isLoading}
          className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
            allFilled && !isLoading
              ? "bg-gradient-to-r from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-500/20"
              : dc
              ? "bg-gray-800 text-gray-400 cursor-not-allowed"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          {isUrdu ? "تصدیق کریں اور رسائی حاصل کریں" : "Verify & Access"}
        </motion.button>

        {/* Request Code Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleRequestCode}
          className={`w-full mt-3 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border transition-all ${
            dc
              ? "border-emerald-700 text-emerald-400 hover:bg-emerald-900/20"
              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          {isUrdu ? "ایڈمن سے کوڈ حاصل کریں" : "Request Code from Admin"}
        </motion.button>

        {/* Info box */}
        <div className={`mt-6 p-4 rounded-xl text-xs space-y-2 ${dc ? "bg-gray-800/60 text-gray-400" : "bg-gray-50 text-gray-500"}`}>
          <div className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              {isUrdu
                ? "یہ کوڈ کسی بھی ڈیوائس یا براؤزر پر کام کرتا ہے — واٹس ایپ یا کال کے ذریعے ایڈمن سے اپنا 6 ہندسوں کا کوڈ حاصل کریں۔"
                : "This code works on any device, any browser — get your 6-digit code from admin via WhatsApp or call."}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              {isUrdu
                ? "ہر کوڈ 6 گھنٹے کے لیے درست ہے۔ میعاد ختم ہونے پر، ایڈمن سے نیا کوڈ حاصل کریں۔"
                : "Each code is valid for 6 hours. After expiry, request a new code from your admin."}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
