import { supabase } from "../../lib/supabase";
import { ForgotPasswordModal } from "../../components/ForgotPasswordModal";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Monitor, Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";

export function OperatorLogin() {
  const navigate = useNavigate();
  const { darkMode, isUrdu, fontClass } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);
  const dc = darkMode;
  const u = (en: string, ur: string) => (isUrdu ? ur : en);

  const handleLogin = async () => {
    if (!email.trim()) { toast.error(u("Enter email", "ای میل ڈالیں")); return; }
    if (!password.trim()) { toast.error(u("Enter password", "پاس ورڈ ڈالیں")); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      toast.error(error.message || u("Login failed", "لاگ ان ناکام"));
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (!profile || profile.role !== "operator") {
      await supabase.auth.signOut();
      toast.error(u("You do not have access to this portal.", "اس پورٹل تک رسائی نہیں۔"));
      setLoading(false);
      return;
    }
    toast.success(u("Login successful!", "لاگ ان ہو گیا!"));
    setTimeout(() => navigate("/operator"), 500);
    setLoading(false);
  };

  return (
    <div className={`${isUrdu ? fontClass : ""} min-h-screen flex items-center justify-center p-4 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-emerald-50 to-teal-50"}`} dir={isUrdu ? "rtl" : "ltr"}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl border ${dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
        {/* Back */}
        <button onClick={() => navigate("/")} className={`flex items-center gap-1.5 text-sm mb-6 ${dc ? "text-gray-400" : "text-gray-500"}`}>
          <ArrowLeft className="w-4 h-4" /> {u("Back", "واپس")}
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-xl sm:text-2xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>
            {u("Operator Login", "آپریٹر لاگ ان")}
          </h1>
          <p className={`text-sm mt-1 ${dc ? "text-gray-400" : "text-gray-500"}`}>
            {u("Computer Operator Portal", "کمپیوٹر آپریٹر پورٹل")}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
              <Mail className="w-4 h-4 inline mr-1.5" />{u("Email", "ای میل")}
            </label>
            <input
              type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="operator@emeraldvisa.com"
              className={`w-full px-4 py-3.5 rounded-xl border text-base min-h-[52px] ${dc ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 placeholder-gray-400"} focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
              <Lock className="w-4 h-4 inline mr-1.5" />{u("Password", "پاس ورڈ")}
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"} dir="ltr" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className={`w-full px-4 py-3.5 rounded-xl border text-base min-h-[52px] pr-12 ${dc ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 placeholder-gray-400"} focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
              />
              <button onClick={() => setShowPass(!showPass)} className={`absolute top-1/2 -translate-y-1/2 ${isUrdu ? "left-3" : "right-3"} p-1 ${dc ? "text-gray-500" : "text-gray-400"}`}>
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-base min-h-[56px] shadow-lg active:from-emerald-700 active:to-teal-700 disabled:opacity-50"
          >
            {loading ? u("Logging in...", "لاگ ان ہو رہا ہے...") : u("Login", "لاگ ان کریں")}
          </motion.button>

          {/* Forgot Password */}
          <div className="text-center mt-3">
            <button
              onClick={() => setShowForgotPw(true)}
              className={`text-sm font-medium ${dc ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-600 hover:text-emerald-700"} transition-colors`}
            >
              {u("Forgot Password?", "پاس ورڈ بھول گئے؟")}
            </button>
          </div>
        </div>

      </motion.div>
      <ForgotPasswordModal open={showForgotPw} onClose={() => setShowForgotPw(false)} darkMode={darkMode} isUrdu={isUrdu} portalType="operator" />
    </div>
  );
}