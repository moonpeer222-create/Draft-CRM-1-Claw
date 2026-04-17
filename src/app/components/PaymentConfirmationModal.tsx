import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { Case, Payment } from "../lib/mockData";
import { addPayment } from "../lib/caseApi";
import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";
import { toast } from "../lib/toast";
import {
  X, CreditCard, Banknote, Smartphone, Wallet, Receipt,
  CheckCircle2, AlertCircle, DollarSign, Calculator,
  TrendingUp, Calendar, User, Hash, FileText
} from "lucide-react";

const PAYMENT_METHODS: { value: Payment["method"]; label: string; labelUrdu: string; icon: React.ElementType; color: string }[] = [
  { value: "cash", label: "Cash", labelUrdu: "نقد", icon: Banknote, color: "from-green-500 to-green-600" },
  { value: "bank", label: "Bank Transfer", labelUrdu: "بینک ٹرانسفر", icon: CreditCard, color: "from-blue-500 to-indigo-500" },
  { value: "easypaisa", label: "EasyPaisa", labelUrdu: "ایزی پیسہ", icon: Smartphone, color: "from-green-400 to-green-500" },
  { value: "jazzcash", label: "JazzCash", labelUrdu: "جاز کیش", icon: Smartphone, color: "from-red-500 to-orange-500" },
  { value: "card", label: "Card Payment", labelUrdu: "کارڈ", icon: CreditCard, color: "from-purple-500 to-violet-500" },
];

interface Props {
  caseData: Case;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded?: (updatedCase: Case) => void;
}

export function PaymentConfirmationModal({ caseData, isOpen, onClose, onPaymentRecorded }: Props) {
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;

  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [description, setDescription] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");

  const remaining = caseData.totalFee - caseData.paidAmount;
  const parsedAmount = parseFloat(amount) || 0;
  const isFullPayment = parsedAmount >= remaining;
  const progressAfterPayment = Math.min(
    ((caseData.paidAmount + parsedAmount) / caseData.totalFee) * 100,
    100
  );

  const quickAmounts = [
    { label: isUrdu ? "باقی رقم" : "Full Remaining", value: remaining },
    { label: "25%", value: Math.round(remaining * 0.25) },
    { label: "50%", value: Math.round(remaining * 0.5) },
    { label: "75%", value: Math.round(remaining * 0.75) },
  ].filter(q => q.value > 0);

  const handleSubmit = () => {
    if (parsedAmount <= 0) {
      toast.error(isUrdu ? "درست رقم درج کریں" : "Please enter a valid amount");
      return;
    }
    if (parsedAmount > remaining) {
      toast.error(isUrdu ? "رقم باقی سے زیادہ ہے" : "Amount exceeds remaining balance");
      return;
    }
    setStep("confirm");
  };

  const handleConfirm = () => {
    setIsProcessing(true);
    const lt = toast.loading(isUrdu ? "ادائیگی ریکارڈ ہو رہی ہے..." : "Recording payment...");

    setTimeout(async () => {
      const ok = await addPayment(caseData.id, {
        amount: parsedAmount,
        date: new Date().toISOString(),
        method,
        receiptNumber: receiptNumber || `REC-${Date.now().toString().slice(-8)}`,
        description: description || `Payment via ${method}`,
        collectedBy: "Admin",
      } as any);

      toast.dismiss(lt);

      if (ok) {
        setShowSuccess(true);
        toast.success(
          isUrdu
            ? `PKR ${parsedAmount.toLocaleString()} کی ادائیگی ریکارڈ!`
            : `Payment of PKR ${parsedAmount.toLocaleString()} recorded!`
        );

        setTimeout(async () => {
          const { data } = await supabase.from('cases').select('*').eq('id', caseData.id).single();
          const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
          if (refreshed) onPaymentRecorded?.(refreshed);
          resetAndClose();
        }, 2000);
      } else {
        toast.error(isUrdu ? "ادائیگی ریکارڈ نہیں ہوئی" : "Failed to record payment");
      }

      setIsProcessing(false);
    }, 1500);
  };

  const resetAndClose = () => {
    setAmount("");
    setMethod("cash");
    setDescription("");
    setReceiptNumber("");
    setStep("form");
    setShowSuccess(false);
    onClose();
  };

  const inputCls = `w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
    dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 placeholder-gray-400"
  }`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={resetAndClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${
              dc ? "bg-gray-800" : "bg-white"
            }`}
          >
            {/* Success State */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle2 className="w-20 h-20 mb-4" />
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold"
                  >
                    {isUrdu ? "ادائیگی کامیاب!" : "Payment Recorded!"}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-lg text-white/80 mt-2"
                  >
                    PKR {parsedAmount.toLocaleString()}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold">
                      {step === "confirm"
                        ? (isUrdu ? "ادائیگی کی تصدیق" : "Confirm Payment")
                        : (isUrdu ? "ادائیگی ریکارڈ" : "Record Payment")
                      }
                    </h3>
                    <p className="text-xs text-white/70">{caseData.id} | {caseData.customerName}</p>
                  </div>
                </div>
                <button onClick={resetAndClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Payment Summary Bar */}
            <div className={`px-4 py-3 border-b ${dc ? "border-gray-700 bg-gray-750" : "border-gray-100 bg-gray-50"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
                  {isUrdu ? "ادائیگی کی پیش رفت" : "Payment Progress"}
                </span>
                <span className={`text-xs font-bold ${
                  remaining <= 0 ? "text-blue-500" : dc ? "text-white" : "text-gray-900"
                }`}>
                  PKR {caseData.paidAmount.toLocaleString()} / {caseData.totalFee.toLocaleString()}
                </span>
              </div>
              <div className={`w-full h-2 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                <div className="relative w-full h-full">
                  {/* Current progress */}
                  <div
                    className="absolute h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${(caseData.paidAmount / caseData.totalFee) * 100}%` }}
                  />
                  {/* Projected progress */}
                  {parsedAmount > 0 && (
                    <motion.div
                      initial={{ width: `${(caseData.paidAmount / caseData.totalFee) * 100}%` }}
                      animate={{ width: `${progressAfterPayment}%` }}
                      className="absolute h-full rounded-full bg-blue-300/50"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
                  {isUrdu ? "ادا شدہ" : "Paid"}: PKR {caseData.paidAmount.toLocaleString()}
                </span>
                <span className={`text-xs font-medium ${remaining > 0 ? "text-amber-500" : "text-blue-500"}`}>
                  {isUrdu ? "باقی" : "Remaining"}: PKR {remaining.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Form step */}
            {step === "form" && (
              <div className="p-4 space-y-4">
                {/* Amount input */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                    {isUrdu ? "رقم (PKR)" : "Amount (PKR)"} *
                  </label>
                  <div className="relative">
                    <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${dc ? "text-gray-400" : "text-gray-400"}`} />
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0"
                      max={remaining}
                      className={`${inputCls} pl-10 text-lg font-bold`}
                    />
                  </div>
                  {/* Quick amounts */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {quickAmounts.map(qa => (
                      <motion.button
                        key={qa.label}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setAmount(String(qa.value))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          parsedAmount === qa.value
                            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                            : dc
                            ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {qa.label} {qa.value !== remaining && `(${qa.value.toLocaleString()})`}
                        {qa.value === remaining && ` (${qa.value.toLocaleString()})`}
                      </motion.button>
                    ))}
                  </div>
                  {isFullPayment && parsedAmount > 0 && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-xs text-blue-500 font-medium flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isUrdu ? "مکمل ادائیگی" : "This will complete the full payment"}
                    </motion.p>
                  )}
                </div>

                {/* Payment method */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                    {isUrdu ? "ادائیگی کا طریقہ" : "Payment Method"} *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map(pm => {
                      const Icon = pm.icon;
                      const selected = method === pm.value;
                      return (
                        <motion.button
                          key={pm.value}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setMethod(pm.value)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selected
                              ? `border-blue-500 ${dc ? "bg-blue-900/20" : "bg-blue-50"} ring-2 ring-blue-500/30`
                              : dc
                              ? "border-gray-700 hover:border-gray-600"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${pm.color} flex items-center justify-center text-white mb-2`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <p className={`text-xs font-medium ${dc ? "text-white" : "text-gray-900"}`}>
                            {isUrdu ? pm.labelUrdu : pm.label}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Receipt number */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "رسید نمبر" : "Receipt #"} ({isUrdu ? "اختیاری" : "optional"})
                    </label>
                    <div className="relative">
                      <Hash className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-400" : "text-gray-400"}`} />
                      <input
                        value={receiptNumber}
                        onChange={e => setReceiptNumber(e.target.value)}
                        placeholder="REC-..."
                        className={`${inputCls} pl-9 text-sm py-2.5`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "تفصیل" : "Description"} ({isUrdu ? "اختیاری" : "optional"})
                    </label>
                    <div className="relative">
                      <FileText className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-400" : "text-gray-400"}`} />
                      <input
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder={isUrdu ? "تفصیل..." : "Description..."}
                        className={`${inputCls} pl-9 text-sm py-2.5`}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={parsedAmount <= 0}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    parsedAmount > 0
                      ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                      : dc
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Calculator className="w-4 h-4" />
                  {parsedAmount > 0
                    ? `${isUrdu ? "تصدیق" : "Review"}: PKR ${parsedAmount.toLocaleString()}`
                    : (isUrdu ? "رقم درج کریں" : "Enter Amount")
                  }
                </motion.button>
              </div>
            )}

            {/* Confirm step */}
            {step === "confirm" && !showSuccess && (
              <div className="p-4 space-y-4">
                <div className={`p-4 rounded-xl ${dc ? "bg-gray-700/30" : "bg-gray-50"}`}>
                  <div className="text-center mb-4">
                    <p className={`text-3xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                      PKR {parsedAmount.toLocaleString()}
                    </p>
                    <p className={`text-sm mt-1 ${dc ? "text-gray-400" : "text-gray-500"}`}>
                      {isUrdu ? "ادائیگی کی تصدیق کریں" : "Confirm payment details below"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: isUrdu ? "کسٹمر" : "Customer", value: caseData.customerName, icon: User },
                      { label: isUrdu ? "کیس" : "Case", value: caseData.id, icon: FileText },
                      { label: isUrdu ? "طریقہ" : "Method", value: PAYMENT_METHODS.find(m => m.value === method)?.[isUrdu ? "labelUrdu" : "label"] || method, icon: CreditCard },
                      { label: isUrdu ? "تاریخ" : "Date", value: new Date().toLocaleDateString(), icon: Calendar },
                      ...(receiptNumber ? [{ label: isUrdu ? "رسید" : "Receipt", value: receiptNumber, icon: Receipt }] : []),
                    ].map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                            <span className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>{item.label}</span>
                          </div>
                          <span className={`text-sm font-medium ${dc ? "text-white" : "text-gray-900"}`}>{item.value}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* After payment summary */}
                  <div className={`mt-4 pt-3 border-t ${dc ? "border-gray-600" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
                        {isUrdu ? "ادائیگی کے بعد باقی" : "Remaining after"}
                      </span>
                      <span className={`text-sm font-bold ${
                        isFullPayment ? "text-blue-500" : dc ? "text-amber-400" : "text-amber-600"
                      }`}>
                        PKR {(remaining - parsedAmount).toLocaleString()}
                        {isFullPayment && ` (${isUrdu ? "مکمل" : "Paid in Full"})`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warning for large amounts */}
                {parsedAmount >= 50000 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-xl flex items-center gap-2 ${
                      dc ? "bg-amber-900/20 border border-amber-800" : "bg-amber-50 border border-amber-200"
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className={`text-xs ${dc ? "text-amber-400" : "text-amber-700"}`}>
                      {isUrdu ? "بڑی رقم - براہ کرم تصدیق کریں" : "Large amount - please double-check before confirming"}
                    </p>
                  </motion.div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep("form")}
                    disabled={isProcessing}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                      dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {isUrdu ? "واپس" : "Back"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        {isUrdu ? "تصدیق کریں" : "Confirm Payment"}
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            )}

            {/* Previous Payments */}
            {step === "form" && caseData.payments.length > 0 && (
              <div className={`px-4 pb-4 border-t pt-3 ${dc ? "border-gray-700" : "border-gray-100"}`}>
                <p className={`text-xs font-semibold mb-2 ${dc ? "text-gray-400" : "text-gray-500"}`}>
                  {isUrdu ? "پچھلی ادائیگیاں" : "Previous Payments"} ({caseData.payments.length})
                </p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {caseData.payments.slice(0, 3).map(p => (
                    <div key={p.id} className={`flex items-center justify-between text-xs p-2 rounded-lg ${dc ? "bg-gray-700/30" : "bg-gray-50"}`}>
                      <div className="flex items-center gap-2">
                        <Receipt className={`w-3.5 h-3.5 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                        <span className={dc ? "text-gray-300" : "text-gray-600"}>
                          {new Date(p.date).toLocaleDateString()} | {p.method}
                        </span>
                      </div>
                      <span className={`font-bold ${dc ? "text-blue-400" : "text-blue-600"}`}>
                        +PKR {p.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}