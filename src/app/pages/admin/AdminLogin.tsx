import { ForgotPasswordModal } from "../../components/ForgotPasswordModal";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Shield, Eye, EyeOff, Mail, Lock, Globe, Sun, Moon, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../lib/toast";
import { useTheme } from "../../lib/ThemeContext";
import { supabase } from "../../lib/supabase";
import { AuditLogService } from "../../lib/auditLog";
import { clearServerPanic } from "../../lib/panicMode";

export function AdminLogin() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, isUrdu, fontClass, t, toggleLanguage, language } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);

  const dc = darkMode;

  // Clear server panic flag on mount (safe route)
  useEffect(() => {
    clearServerPanic();
  }, []);

  const handleLogin = async () => {
    if (!email.trim()) {
      toast.error(t("auth.enterEmail"));
      return;
    }
    if (!password.trim()) {
      toast.error(t("auth.enterPassword"));
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1200));

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      toast.error(error.message || t("auth.invalidCredentials"));
      setIsLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (!profile || !["admin", "master_admin"].includes(profile.role)) {
      await supabase.auth.signOut();
      toast.error("You do not have access to this portal.");
      setIsLoading(false);
      return;
    }
    AuditLogService.logAuth(data.user.email || "Admin", "admin", "login");
    toast.success(t("auth.loginSuccess"));
    setTimeout(() => navigate("/admin"), 400);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div
      className={`${isUrdu ? fontClass : ""} min-h-screen flex items-center justify-center transition-colors duration-500 relative overflow-hidden px-4 ${
        dc ? "bg-gray-950" : "bg-gradient-to-br from-blue-50 via-white to-amber-50"
      }`}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl ${
            dc ? "bg-blue-900/20" : "bg-blue-200/40"
          }`}
        />
        <motion.div
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className={`absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl ${
            dc ? "bg-amber-900/20" : "bg-amber-200/30"
          }`}
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

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-8 border backdrop-blur-xl ${
          dc ? "bg-gray-800/90 border-gray-700/60" : "bg-white/95 border-gray-200/50"
        }`}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="inline-block mb-4"
          >
            <div className="relative">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/30">
                <Shield className="w-10 h-10 text-white" />
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                </motion.div>
              </div>
            </div>
          </motion.div>
          <h1 className={`text-2xl font-bold mb-1 ${dc ? "text-white" : "text-gray-900"}`}>
            {t("auth.adminLogin")}
          </h1>
          <p className={`text-sm ${dc ? "text-gray-400" : "text-gray-500"}`}>
            {t("auth.adminLoginDesc")}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
              {t("auth.email")}
            </label>
            <div className="relative">
              <Mail className={`absolute ${isUrdu ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="admin@emeraldvisa.com"
                dir="ltr"
                className={`w-full ${isUrdu ? "pr-10 pl-4" : "pl-10 pr-4"} py-3.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base ${
                  dc ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
              {t("auth.password")}
            </label>
            <div className="relative">
              <Lock className={`absolute ${isUrdu ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="********"
                dir="ltr"
                className={`w-full ${isUrdu ? "pr-10 pl-10" : "pl-10 pr-10"} py-3.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base ${
                  dc ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${isUrdu ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 ${dc ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3.5 rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 min-h-[48px] active:shadow-md text-base"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                <Shield className="w-4 h-4" />
                {t("auth.signIn")}
              </>
            )}
          </motion.button>

          {/* Forgot Password */}
          <div className="text-center mt-3">
            <button
              onClick={() => setShowForgotPw(true)}
              className={`text-sm font-medium ${dc ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"} transition-colors`}
            >
              {isUrdu ? "پاس ورڈ بھول گئے؟" : "Forgot Password?"}
            </button>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate("/")}
            className="text-sm text-blue-500 hover:text-blue-400 font-medium min-h-[44px] inline-flex items-center"
          >
            {isUrdu ? "→" : "←"} {t("login.back")}
          </motion.button>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal open={showForgotPw} onClose={() => setShowForgotPw(false)} darkMode={darkMode} isUrdu={isUrdu} portalType="admin" />
    </div>
  );
}