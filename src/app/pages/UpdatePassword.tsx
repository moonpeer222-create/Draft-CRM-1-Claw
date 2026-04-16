import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { toast } from "../lib/toast";
import { supabase } from "../lib/supabase";
import { validatePasswordStrength } from "../lib/security";

export function UpdatePassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hashHandled, setHashHandled] = useState(false);

  const u = (en: string, ur: string) => (isUrdu ? ur : en);

  // Supabase sends recovery tokens in the URL hash (e.g. #access_token=...&type=recovery)
  // or as query params when using PKCE code. We try both.
  useEffect(() => {
    const handleRecovery = async () => {
      // Check for PKCE code in query params
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message || u("Invalid or expired link", "غلط یا ختم شدہ لنک"));
          navigate("/customer/login");
          return;
        }
        setHashHandled(true);
        return;
      }

      // Legacy hash-based token
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || hash.includes("access_token=")) {
        // Supabase client automatically parses the hash on init if configured,
        // but we can force a session refresh to pick it up.
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          toast.error(u("Invalid or expired link", "غلط یا ختم شدہ لنک"));
          navigate("/customer/login");
          return;
        }
        setHashHandled(true);
        return;
      }

      // If nothing found, just allow the page to render (session may already be valid)
      setHashHandled(true);
    };
    handleRecovery();
  }, [searchParams, navigate, u]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPw || !confirmPw) {
      toast.error(u("Fill all fields", "تمام فیلڈز بھریں"));
      return;
    }
    if (newPw !== confirmPw) {
      toast.error(u("Passwords don't match", "پاس ورڈ مطابقت نہیں رکھتے"));
      return;
    }
    const strength = validatePasswordStrength(newPw);
    if (!strength.valid) {
      toast.error(strength.errors[0]);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);

    if (error) {
      toast.error(error.message || u("Failed to update password", "پاس ورڈ اپ ڈیٹ ناکام"));
    } else {
      toast.success(u("Password updated successfully!", "پاس ورڈ کامیابی سے اپ ڈیٹ ہو گیا!"));
      setTimeout(() => navigate("/customer/login"), 1500);
    }
  };

  const passwordStrength = validatePasswordStrength(newPw);
  const strengthColor = passwordStrength.score <= 2 ? "bg-red-500" : passwordStrength.score <= 4 ? "bg-yellow-500" : "bg-green-500";
  const strengthLabel = passwordStrength.score <= 2 ? u("Weak", "کمزور") : passwordStrength.score <= 4 ? u("Medium", "درمیانہ") : u("Strong", "مضبوط");

  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";
  const inputCls = `w-full px-4 py-3.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base ${dc ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"}`;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${dc ? "bg-gray-900" : "bg-gray-50"}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${card} w-full max-w-md rounded-2xl shadow-2xl p-8`}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className={`text-2xl font-bold ${txt}`}>{u("Set New Password", "نیا پاس ورڈ سیٹ کریں")}</h1>
          <p className={`text-sm ${sub} mt-1`}>{u("Enter a strong new password for your account.", "اپنے اکاؤنٹ کے لیے ایک مضبوط نیا پاس ورڈ درج کریں۔")}</p>
        </div>

        {!hashHandled ? (
          <div className="flex items-center justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full"
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                {u("New Password", "نیا پاس ورڈ")}
              </label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                <input
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  dir="ltr"
                  className={`${inputCls} pl-10 pr-10`}
                  placeholder={u("Min 8 chars, uppercase, digit, special", "کم از کم 8 حروف")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${sub}`}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPw && (
                <div className="mt-2">
                  <div className={`h-1.5 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      className={`h-full rounded-full ${strengthColor}`}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${sub}`}>{strengthLabel}</p>
                </div>
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                {u("Confirm Password", "پاس ورڈ کی تصدیق")}
              </label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                <input
                  type={showPw ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  dir="ltr"
                  className={`${inputCls} pl-10`}
                  placeholder={u("Repeat password", "پاس ورڈ دوبارہ درج کریں")}
                />
              </div>
              {confirmPw && newPw !== confirmPw && (
                <p className="text-xs text-red-500 mt-1">{u("Passwords don't match", "پاس ورڈ مطابقت نہیں رکھتے")}</p>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || !passwordStrength.valid || newPw !== confirmPw}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {u("Update Password", "پاس ورڈ اپ ڈیٹ کریں")}
                </>
              )}
            </motion.button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
