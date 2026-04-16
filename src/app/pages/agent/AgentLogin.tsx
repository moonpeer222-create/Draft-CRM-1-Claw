import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Briefcase, Mail, Lock, Globe, Sun, Moon, Sparkles, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "../../lib/toast";
import { useTheme } from "../../lib/ThemeContext";
import { supabase } from "../../lib/supabase";
import { clearServerPanic } from "../../lib/panicMode";

export function AgentLogin() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, isUrdu, fontClass, t, toggleLanguage, language } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const dc = darkMode;

  useEffect(() => {
    clearServerPanic();
  }, []);

  const handleLogin = async () => {
    if (!email.trim()) {
      toast.error(isUrdu ? "ای میل درج کریں" : "Enter email");
      return;
    }
    if (!password.trim()) {
      toast.error(isUrdu ? "پاس ورڈ درج کریں" : "Enter password");
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      toast.error(error.message || (isUrdu ? "غلط اسناد" : "Invalid credentials"));
      setIsLoading(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (!profile || profile.role !== "agent") {
      await supabase.auth.signOut();
      toast.error(isUrdu ? "اس پورٹل تک رسائی نہیں۔" : "You do not have access to this portal.");
      setIsLoading(false);
      return;
    }

    toast.success(isUrdu ? "خوش آمدید، ایجنٹ!" : "Welcome, Agent!");
    setTimeout(() => navigate("/agent"), 400);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

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
          className={`absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl ${
            dc ? "bg-blue-900/20" : "bg-blue-200/40"
          }`}
        />
        <motion.div
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className={`absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl ${
            dc ? "bg-emerald-900/20" : "bg-emerald-200/30"
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
        <div className="text-center mb-8">
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

        {/* Email/Password Form */}
        <div className="space-y-5">
          <div>
            <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>
              <Mail className="w-4 h-4 inline mr-2" />
              {isUrdu ? "ای میل" : "Email"}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isUrdu ? "اپنی ای میل درج کریں" : "Enter your email"}
              className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition-all ${
                dc
                  ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500"
                  : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500"
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>
              <Lock className="w-4 h-4 inline mr-2" />
              {isUrdu ? "پاس ورڈ" : "Password"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isUrdu ? "اپنا پاس ورڈ درج کریں" : "Enter your password"}
                className={`w-full px-4 py-3 pr-12 rounded-xl border-2 outline-none transition-all ${
                  dc
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${
                  dc ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            disabled={isLoading}
            className={`w-full py-3.5 rounded-xl font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-emerald-500 hover:shadow-xl hover:from-blue-700 hover:to-emerald-600"
            }`}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {isUrdu ? "لاگ ان" : "Login"}
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
