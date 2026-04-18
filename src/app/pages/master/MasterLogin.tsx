import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Crown, Eye, EyeOff, Mail, Lock, Globe, Sun, Moon, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "../../lib/toast";
import { useTheme } from "../../lib/ThemeContext";
import { supabase } from "../../lib/supabase";
import { AuditLogService } from "../../lib/auditLog";
import { ForgotPasswordModal } from "../../components/ForgotPasswordModal";
// Force Vite cache invalidation after auditLog.ts type changes

export function MasterLogin() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, isUrdu, fontClass, t, toggleLanguage, language } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);

  const dc = darkMode;

  const handleLogin = async () => {
    if (!email.trim()) { toast.error(isUrdu ? "ای میل درج کریں" : "Enter email"); return; }
    if (!password.trim()) { toast.error(isUrdu ? "پاس ورڈ درج کریں" : "Enter password"); return; }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1200));

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      toast.error(error.message || (isUrdu ? "غلط اسناد" : "Invalid credentials"));
      setIsLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (!profile || profile.role !== "master_admin") {
      await supabase.auth.signOut();
      toast.error(isUrdu ? "اس پورٹل تک رسائی نہیں۔" : "You do not have access to this portal.");
      setIsLoading(false);
      return;
    }
    AuditLogService.logAuth(data.user.email || "Master Admin", "master_admin", "login");
    toast.success(isUrdu ? "خوش آمدید، ماسٹر ایڈمن!" : "Welcome, Master Admin!");
    setTimeout(() => navigate("/master"), 400);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div
      className={`${isUrdu ? fontClass : ""} min-h-screen flex items-center justify-center transition-colors duration-500 relative overflow-hidden px-4 ${
        dc ? "bg-gray-950" : "bg-gradient-to-br from-purple-50 via-white to-amber-50"
      }`}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl ${
            dc ? "bg-purple-900/20" : "bg-purple-200/40"
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
        className="absolute top-4 right-4 flex items-center gap-2"
      >
        <button onClick={toggleLanguage} className={`p-2 rounded-lg ${dc ? "bg-gray-800 text-gray-300" : "bg-white text-gray-600"} shadow-sm`}>
          <Globe className="w-4 h-4" />
        </button>
        <button onClick={toggleDarkMode} className={`p-2 rounded-lg ${dc ? "bg-gray-800 text-gray-300" : "bg-white text-gray-600"} shadow-sm`}>
          {dc ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </motion.div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className={`w-full max-w-md p-8 rounded-2xl shadow-2xl border ${
          dc
            ? "bg-gray-900 border-purple-500/20 shadow-purple-500/10"
            : "bg-white border-purple-200 shadow-purple-500/10"
        }`}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-amber-500 text-white shadow-lg shadow-purple-500/30 mb-4"
          >
            <Crown className="w-10 h-10" />
          </motion.div>
          <h1 className={`text-2xl font-bold mb-2 ${dc ? "text-white" : "text-gray-900"}`}>
            {isUrdu ? "ماسٹر ایڈمن پورٹل" : "Master Admin Portal"}
          </h1>
          <p className={`text-sm ${dc ? "text-gray-400" : "text-gray-500"}`}>
            {isUrdu ? "ایمرالڈ ٹیک پارٹنر - اعلیٰ انتظامیہ" : "Emerald Tech Partner - Executive Access"}
          </p>
          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${
            dc ? "bg-purple-900/30 text-purple-400 border-purple-600" : "bg-purple-100 text-purple-700 border-purple-200"
          }`}>
            <Sparkles className="w-3 h-3" />
            {isUrdu ? "محفوظ لاگ ان" : "Secure Login"}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
              {isUrdu ? "ای میل" : "Email"}
            </label>
            <div className="relative">
              <Mail className={`absolute ${isUrdu ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isUrdu ? "ای میل درج کریں" : "Enter your email"}
                className={`w-full ${isUrdu ? "pr-10 pl-4" : "pl-10 pr-4"} py-3 rounded-xl border transition-colors ${
                  dc
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-purple-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500"
                } outline-none`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
              {isUrdu ? "پاس ورڈ" : "Password"}
            </label>
            <div className="relative">
              <Lock className={`absolute ${isUrdu ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isUrdu ? "پاس ورڈ درج کریں" : "Enter password"}
                className={`w-full ${isUrdu ? "pr-10 pl-12" : "pl-10 pr-12"} py-3 rounded-xl border transition-colors ${
                  dc
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-purple-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500"
                } outline-none`}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${isUrdu ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 ${dc ? "text-gray-500" : "text-gray-400"}`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow disabled:opacity-60"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                {isUrdu ? "تصدیق ہو رہی ہے..." : "Authenticating..."}
              </span>
            ) : (
              isUrdu ? "ماسٹر لاگ ان" : "Master Login"
            )}
          </motion.button>
        </div>

        {/* Forgot Password */}
        <div className="mt-4 text-center">
          <button onClick={() => setShowForgotPw(true)} className={`text-sm font-medium ${dc ? "text-purple-400 hover:text-purple-300" : "text-purple-600 hover:text-purple-700"}`}>
            {isUrdu ? "پاس ورڈ بھول گئے؟" : "Forgot Password?"}
          </button>
        </div>

        {/* Footer hint */}
        <div className={`mt-4 text-center text-xs ${dc ? "text-gray-600" : "text-gray-400"}`}>
          {isUrdu ? "صرف ماسٹر ایڈمن اکاؤنٹس کے لیے" : "Master Admin accounts only"}
        </div>

        {/* Back to home */}
        <button
          onClick={() => navigate("/")}
          className={`mt-4 w-full text-center text-sm ${dc ? "text-purple-400 hover:text-purple-300" : "text-purple-600 hover:text-purple-700"}`}
        >
          {isUrdu ? "واپس ہوم پیج پر جائیں" : "Back to Home"}
        </button>
      </motion.div>
      <ForgotPasswordModal open={showForgotPw} onClose={() => setShowForgotPw(false)} darkMode={darkMode} isUrdu={isUrdu} portalType="master" />
    </div>
  );
}