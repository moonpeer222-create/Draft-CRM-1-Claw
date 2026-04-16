import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ArrowLeft, CheckCircle, X } from "lucide-react";
import { toast } from "../lib/toast";
import { supabase } from "../lib/supabase";

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  isUrdu?: boolean;
  portalType?: "admin" | "master" | "operator" | "customer";
}

type Step = "email" | "success";

export function ForgotPasswordModal({ open, onClose, darkMode, isUrdu = false }: ForgotPasswordModalProps) {
  const dc = darkMode;
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const u = (en: string, ur: string) => (isUrdu ? ur : en);

  const resetState = () => {
    setStep("email");
    setEmail("");
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleRequestCode = async () => {
    if (!email.trim()) {
      toast.error(u("Enter your email", "ای میل درج کریں"));
      return;
    }
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) {
        toast.error(error.message || u("Failed to send reset email", "ری سیٹ ای میل بھیجنے میں ناکامی"));
      } else {
        toast.success(u("Reset link sent to your email!", "ری سیٹ لنک آپ کی ای میل پر بھیج دیا گیا!"));
        setStep("success");
      }
    } catch (err: any) {
      console.error("Forgot password request error:", err);
      toast.error(u("Network error. Try again.", "نیٹ ورک خرابی۔ دوبارہ کوشش کریں۔"));
    }
    setLoading(false);
  };

  if (!open) return null;

  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";
  const inputCls = `w-full px-4 py-3.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base ${dc ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className={`${card} w-full max-w-md rounded-2xl shadow-2xl overflow-hidden`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-5 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
            <div className="flex items-center gap-3">
              {step !== "email" && step !== "success" && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setStep("email")}
                  className={`p-1.5 rounded-lg ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                >
                  <ArrowLeft className="w-4 h-4" />
                </motion.button>
              )}
              <div>
                <h2 className={`font-bold ${txt}`}>
                  {step === "email" && u("Forgot Password", "پاس ورڈ بھول گئے")}
                  {step === "success" && u("Password Reset", "پاس ورڈ ری سیٹ")}
                </h2>
                <p className={`text-xs ${sub}`}>
                  {step === "email" && u("We'll send a reset link to your email", "ہم آپ کی ای میل پر ری سیٹ لنک بھیجیں گے")}
                  {step === "success" && u("Check your email for the reset link", "اپنی ای میل میں ری سیٹ لنک دیکھیں")}
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleClose}
              className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Email */}
              {step === "email" && (
                <motion.div key="email" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRequestCode()}
                      placeholder={u("Enter your registered email", "اپنی رجسٹرڈ ای میل درج کریں")}
                      dir="ltr"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRequestCode}
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        {u("Send Reset Link", "ری سیٹ لنک بھیجیں")}
                      </>
                    )}
                  </motion.button>
                </motion.div>
              )}

              {/* Step 2: Success */}
              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
                  >
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </motion.div>
                  <h3 className={`text-lg font-bold ${txt}`}>{u("Reset Link Sent!", "ری سیٹ لنک بھیج دیا گیا!")}</h3>
                  <p className={`text-sm ${sub}`}>
                    {u("Check your email and follow the instructions to reset your password.", "اپنی ای میل چیک کریں اور پاس ورڈ ری سیٹ کرنے کے لیے ہدایات پر عمل کریں۔")}
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    className="px-8 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
                  >
                    {u("Back to Login", "لاگ ان پر واپس جائیں")}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
