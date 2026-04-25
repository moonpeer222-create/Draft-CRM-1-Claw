import { useNavigate } from "react-router";
import { ArrowLeft, DollarSign, CheckCircle, Clock, Download, Upload, XCircle, RefreshCw, AlertCircle, Menu } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { motion, AnimatePresence } from "motion/react";
import { Case, Payment } from "../../lib/mockData";
import { updateCase } from "../../lib/caseApi";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { AuditLogService } from "../../lib/auditLog";
import { DataSyncService } from "../../lib/dataSync";
import { NotificationService } from "../../lib/notifications";
import { MobileBottomNav } from "../../components/MobileBottomNav";
import { CustomerMobileMenu } from "../../components/CustomerMobileMenu";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";

export function CustomerPayments() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";

  const { profile } = useSupabaseAuth();
  const customerName = profile?.full_name || profile?.email || "Customer";
  const [caseId, setCaseId] = useState<string>("N/A");

  const [myCase, setMyCase] = useState<Case | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [txRef, setTxRef] = useState("");
  const [txDate, setTxDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadCase = useCallback(async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!error && data) {
      const meta = (data.metadata || {}) as any;
      setCaseId(data.case_number || data.id);
      const mapped: Case = {
        id: data.case_number || data.id,
        customerId: data.client_id || profile.id,
        customerName: meta.customerName || profile.full_name || "Customer",
        fatherName: meta.fatherName || "",
        phone: meta.phone || "",
        email: meta.email || profile.email || "",
        cnic: meta.cnic || "",
        passport: meta.passport || "",
        country: meta.country || data.destination_country || "",
        jobType: meta.jobType || data.visa_type || "",
        jobDescription: meta.jobDescription || "",
        address: meta.address || "",
        city: meta.city || "",
        maritalStatus: meta.maritalStatus || "single",
        dateOfBirth: meta.dateOfBirth || "",
        emergencyContact: meta.emergencyContact || { name: "", phone: "", relationship: "" },
        education: meta.education || "",
        experience: meta.experience || "",
        status: data.status || meta.status || "new_case",
        agentId: data.agent_id || meta.agentId || "",
        agentName: meta.agentName || "",
        createdDate: data.created_at || meta.createdDate || new Date().toISOString(),
        updatedDate: data.updated_at || meta.updatedDate || new Date().toISOString(),
        timeline: meta.timeline || [],
        documents: meta.documents || [],
        payments: meta.payments || [],
        medical: meta.medical || null,
        notes: meta.notes || [],
        priority: (data.priority || meta.priority || "medium") as any,
        totalFee: meta.totalFee || 0,
        paidAmount: meta.paidAmount || 0,
        pipelineType: meta.pipelineType || "visa",
        pipelineStageKey: data.status || meta.pipelineStageKey || "new_case",
        currentStage: meta.currentStage || 1,
        stageStartedAt: meta.stageStartedAt || data.created_at || new Date().toISOString(),
        stageDeadlineAt: meta.stageDeadlineAt || data.created_at || new Date().toISOString(),
        isOverdue: meta.isOverdue || false,
        delayReason: meta.delayReason,
        delayReportedAt: meta.delayReportedAt,
        documentChecklist: meta.documentChecklist || {},
        documentChecklistFiles: meta.documentChecklistFiles || {},
        paymentVerified: meta.paymentVerified || false,
        paymentVerifiedAt: meta.paymentVerifiedAt,
        paymentVerifiedBy: meta.paymentVerifiedBy,
        ownerApproval: meta.ownerApproval || false,
        ownerApprovalAt: meta.ownerApprovalAt,
        ownerApprovalNote: meta.ownerApprovalNote,
        cancellationReason: meta.cancellationReason,
        cancelledAt: meta.cancelledAt,
        cancelledBy: meta.cancelledBy,
        reopenedAt: meta.reopenedAt,
        reopenedBy: meta.reopenedBy,
        reopenedFromStage: meta.reopenedFromStage,
        assignedStaffId: meta.assignedStaffId,
        assignedStaffName: meta.assignedStaffName,
        assignedAt: meta.assignedAt,
        companyName: meta.companyName,
        companyCountry: meta.companyCountry,
      } as Case;
      setMyCase(mapped);
    } else {
      setMyCase(null);
      setCaseId("N/A");
    }
  }, [profile?.id]);

  useEffect(() => {
    loadCase();
    const interval = setInterval(loadCase, 15000);
    return () => clearInterval(interval);
  }, [loadCase]);

  // Live payment data from case
  const totalFee = myCase?.totalFee || 0;
  const paidAmount = myCase?.paidAmount || 0;
  const remainingAmount = totalFee - paidAmount;
  const paymentPct = totalFee > 0 ? Math.round((paidAmount / totalFee) * 100) : 0;
  const payments = myCase?.payments || [];

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case "verified": case "completed": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "rejected": return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      verified: "bg-green-100 text-green-700",
      completed: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
      pending: "bg-amber-100 text-amber-700",
      "pending_approval": "bg-blue-100 text-blue-700",
    };
    const labels: Record<string, string> = {
      verified: isUrdu ? "تصدیق شدہ" : "Verified",
      completed: isUrdu ? "مکمل" : "Completed",
      rejected: isUrdu ? "مسترد" : "Rejected",
      pending: isUrdu ? "زیر جائزہ" : "Pending",
      "pending_approval": isUrdu ? "منظوری زیر التوا" : "Pending Approval",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full font-semibold ${styles[status] || "bg-gray-100 text-gray-700"}`}>
        {labels[status] || status}
      </span>
    );
  };

  const handleSubmitPayment = async () => {
    if (!myCase) return;
    if (!txRef.trim()) { toast.error(isUrdu ? "ٹرانزیکشن ریفرنس درج کریں" : "Please enter transaction reference"); return; }
    if (!txDate) { toast.error(isUrdu ? "ادائیگی کی تاریخ درج کریں" : "Please enter payment date"); return; }
    if (!selectedMethod) { toast.error(isUrdu ? "ادائیگی کا طریقہ منتخب کریں" : "Please select a payment method"); return; }

    const amount = parseFloat(paymentAmount) || remainingAmount;
    if (amount <= 0) { toast.error(isUrdu ? "درست رقم درج کریں" : "Please enter a valid amount"); return; }

    setIsSubmitting(true);
    const lt = toast.loading(isUrdu ? "ادائیگی کا ثبوت جمع ہو رہا ہے..." : "Submitting payment proof...");

    await new Promise(r => setTimeout(r, 1500));

    // Add payment to case
    const newPayment = {
      id: `PAY-CUST-${Date.now()}`,
      amount,
      method: selectedMethod.toLowerCase().replace(/\s/g, "_") as Payment["method"],
      date: txDate,
      reference: txRef.trim(),
      status: "pending" as const,
      description: `Payment via ${selectedMethod} — submitted by customer`,
      receiptUrl: "",
      receiptNumber: txRef.trim(),
      collectedBy: "customer",
    };

    const updatedPayments = [...(myCase.payments || []), newPayment];
    const ok = await updateCase(myCase.id, { payments: updatedPayments });

    toast.dismiss(lt);

    if (ok) {
      const { data } = await supabase.from('cases').select('*').eq('id', myCase.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data, profile) : null;
      if (refreshed) setMyCase(refreshed);

      // Audit log
      AuditLogService.logPaymentAction(customerName, "customer", "payment_added", myCase.id, amount);
      DataSyncService.markModified(myCase.id, profile?.id || "customer", customerName, "customer", "case", `Customer submitted payment proof: PKR ${amount.toLocaleString()} via ${selectedMethod}`);

      // Notify admin/agent
      NotificationService.addNotification({
        type: "payment",
        priority: "high",
        title: "Customer Payment Proof Submitted",
        titleUrdu: "کسٹمر نے ادائیگی کا ثبوت جمع کرایا",
        message: `${customerName} submitted PKR ${amount.toLocaleString()} payment proof for case ${myCase.id} via ${selectedMethod} (Ref: ${txRef.trim()})`,
        messageUrdu: `${customerName} نے کیس ${myCase.id} کے لیے PKR ${amount.toLocaleString()} ادائیگی کا ثبوت جمع کرایا`,
        actionable: true,
        actionUrl: "/admin/approval-queue",
        actionLabel: "Review Payment",
        targetRole: "all",
        metadata: {
          requestType: "payment_verification",
          caseId: myCase.id,
          amount,
          method: selectedMethod,
          reference: txRef.trim(),
        },
      });

      toast.success(isUrdu ? "ادائیگی کا ثبوت جمع ہو گیا! تصدیق کے بعد آپ کو مطلع کیا جائے گا۔" : "Payment proof submitted! You'll be notified once verified.");
      setShowPaymentForm(false);
      setTxRef("");
      setTxDate("");
      setPaymentAmount("");
      setSelectedMethod("");
    } else {
      toast.error(isUrdu ? "مع کرانے میں خرابی" : "Submission failed");
    }

    setIsSubmitting(false);
  };

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-blue-50 to-gray-100"}`}>
      {!insideUnifiedLayout && (
      <header className={`${dc ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"} border-b px-4 md:px-6 py-4 sticky top-0 z-50`}>
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate("/customer")} className={`p-2 rounded-lg ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
            <ArrowLeft className={`w-5 h-5 ${dc ? "text-gray-300" : "text-gray-700"}`} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              E
            </div>
            <div>
              <h1 className={`text-lg font-bold ${txt}`}>{t("customer.paymentDetails")}</h1>
              <span className={`text-xs ${sub}`}>Case ID: {caseId}</span>
            </div>
          </div>
          <div className="flex-1" />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { loadCase(); toast.success(isUrdu ? "تازہ ترین ڈیٹا" : "Refreshed!"); }}
            className={`p-2 rounded-lg ${dc ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-700"}`}
          >
            <RefreshCw className="w-4 h-4" />
          </motion.button>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className={`lg:hidden p-2.5 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center active:opacity-80 ${dc ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-6 pb-28 lg:pb-6">
        {/* Payment Summary — Live Data */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`${card} rounded-xl shadow-sm p-4 md:p-6 mb-6 border ${brd}`}>
          <h2 className={`text-xl font-bold mb-6 ${txt}`}>{t("customer.paymentSummary")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className={`p-4 rounded-xl ${dc ? "bg-blue-900/20 border border-blue-800/30" : "bg-blue-50"}`}>
              <DollarSign className="w-8 h-8 text-blue-600 mb-2" />
              <h3 className={`text-2xl font-bold ${dc ? "text-blue-300" : "text-blue-900"}`}>PKR {totalFee.toLocaleString()}</h3>
              <p className={`text-sm ${dc ? "text-blue-400" : "text-blue-700"}`}>{isUrdu ? "کل فیس" : "Total Service Fee"}</p>
            </div>
            <div className={`p-4 rounded-xl ${dc ? "bg-green-900/20 border border-green-800/30" : "bg-green-50"}`}>
              <CheckCircle className="w-8 h-8 text-green-600 mb-2" />
              <h3 className={`text-2xl font-bold ${dc ? "text-green-300" : "text-green-900"}`}>PKR {paidAmount.toLocaleString()}</h3>
              <p className={`text-sm ${dc ? "text-green-400" : "text-green-700"}`}>{isUrdu ? "ادا شدہ" : "Paid"}</p>
            </div>
            <div className={`p-4 rounded-xl ${dc ? "bg-orange-900/20 border border-orange-800/30" : "bg-orange-50"}`}>
              <Clock className="w-8 h-8 text-orange-600 mb-2" />
              <h3 className={`text-2xl font-bold ${dc ? "text-orange-300" : "text-orange-900"}`}>PKR {remainingAmount.toLocaleString()}</h3>
              <p className={`text-sm ${dc ? "text-orange-400" : "text-orange-700"}`}>{isUrdu ? "باقی" : "Remaining"}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-medium ${sub}`}>{isUrdu ? "ادائیگی کی پیشرفت" : "Payment Progress"}</span>
              <span className={`text-xs font-bold ${paymentPct === 100 ? "text-green-600" : "text-blue-600"}`}>{paymentPct}%</span>
            </div>
            <div className={`w-full h-2.5 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${paymentPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-2.5 rounded-full ${paymentPct === 100 ? "bg-gradient-to-r from-green-500 to-green-400" : "bg-gradient-to-r from-blue-500 to-blue-400"}`}
              />
            </div>
          </div>
        </motion.div>

        {/* Make Payment */}
        {remainingAmount > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${card} rounded-xl shadow-sm p-4 md:p-6 mb-6 border ${brd}`}>
            <h2 className={`text-xl font-bold mb-4 ${txt}`}>{t("customer.makePayment")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[
                { emoji: "💳", name: "EasyPaisa", desc: isUrdu ? "ایزی پیسہ سے ادائیگی" : "Pay via EasyPaisa app", account: "03186986259" },
                { emoji: "📱", name: "JazzCash", desc: isUrdu ? "جیز کیش سے ادائیگی" : "Pay via JazzCash app", account: "03186986259" },
                { emoji: "🏦", name: "Bank Transfer", desc: "HBL Account: 12345678901", account: "HBL 12345678901" },
              ].map((m) => (
                <motion.button
                  key={m.name}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSelectedMethod(m.name);
                    toast.info(`${m.name} Account: ${m.account}`);
                  }}
                  className={`p-6 border-2 rounded-xl transition-all text-left ${selectedMethod === m.name
                    ? dc ? "border-blue-500 bg-blue-900/20" : "border-blue-600 bg-blue-50"
                    : dc ? "border-gray-600 hover:border-blue-500 hover:bg-blue-900/10" : "border-gray-300 hover:border-blue-600 hover:bg-blue-50"
                  }`}
                >
                  <span className="text-2xl mb-2 block">{m.emoji}</span>
                  <h3 className={`font-semibold mb-1 ${txt}`}>{m.name}</h3>
                  <p className={`text-sm ${sub}`}>{m.desc}</p>
                  {selectedMethod === m.name && (
                    <p className="text-xs mt-2 text-blue-600 font-semibold">{isUrdu ? "منتخب" : "Selected"} ✓</p>
                  )}
                </motion.button>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPaymentForm(!showPaymentForm)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow-sm"
            >
              {isUrdu ? "میں نے ادائیگی کر دی ہے" : "I've Made the Payment"}
            </motion.button>

            <AnimatePresence>
              {showPaymentForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`mt-6 p-6 rounded-xl ${dc ? "bg-gray-700/50 border border-gray-600" : "bg-gray-50 border border-gray-200"}`}>
                    <h4 className={`font-semibold mb-4 ${txt}`}>{t("customer.submitProof")}</h4>
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? "رقم (PKR)" : "Amount (PKR)"} *
                        </label>
                        <input
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder={`${remainingAmount.toLocaleString()}`}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-600 border-gray-500 text-white placeholder-gray-400" : "border-gray-300"}`}
                        />
                        <p className={`text-xs mt-1 ${sub}`}>{isUrdu ? `باقی: PKR ${remainingAmount.toLocaleString()}` : `Remaining: PKR ${remainingAmount.toLocaleString()}`}</p>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? "ٹرانزیکشن آئی ڈی / ریفرنس" : "Transaction ID / Reference"} *
                        </label>
                        <input
                          type="text"
                          value={txRef}
                          onChange={(e) => setTxRef(e.target.value)}
                          placeholder={isUrdu ? "ٹرانزیکشن ریفرنس درج کریں" : "Enter transaction reference"}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-600 border-gray-500 text-white placeholder-gray-400" : "border-gray-300"}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? "ادائیگی کی تاریخ" : "Payment Date"} *
                        </label>
                        <input
                          type="date"
                          value={txDate}
                          onChange={(e) => setTxDate(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-600 border-gray-500 text-white placeholder-gray-400" : "border-gray-300"}`}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmitPayment}
                        disabled={isSubmitting}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold disabled:opacity-50 shadow-sm"
                      >
                        {isSubmitting
                          ? (isUrdu ? "جمع ہو رہا ہے..." : "Submitting...")
                          : (isUrdu ? "تصدیق کے لیے جمع کریں" : "Submit for Verification")
                        }
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Full payment congratulations */}
        {remainingAmount <= 0 && totalFee > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mb-6 p-5 rounded-xl border-2 border-green-500/30 ${dc ? "bg-green-900/15" : "bg-green-50"}`}
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <h3 className={`font-bold ${dc ? "text-green-400" : "text-green-700"}`}>
                  {isUrdu ? "تمام ادائیگیاں مکمل!" : "All Payments Completed!"}
                </h3>
                <p className={`text-sm ${dc ? "text-green-300/80" : "text-green-600"}`}>
                  {isUrdu ? "آپ کی کل ادائیگی PKR " : "Total paid: PKR "}{paidAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Payment History — Live from case */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${card} rounded-xl shadow-sm p-4 md:p-6 border ${brd}`}
        >
          <h2 className={`text-xl font-bold mb-4 ${txt}`}>{t("customer.paymentHistory")}</h2>
          {payments.length > 0 ? (
            <div className="space-y-3">
              {[...payments].reverse().map((payment) => (
                <div key={payment.id} className={`p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border ${dc ? "bg-gray-700/30 border-gray-600/50" : "bg-gray-50 border-gray-100"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      {getPaymentStatusIcon((payment as any).status)}
                      <h4 className={`font-bold ${txt}`}>PKR {payment.amount.toLocaleString()}</h4>
                      {getPaymentStatusBadge((payment as any).status)}
                    </div>
                    <div className={`flex flex-wrap gap-3 text-xs ml-8 ${sub}`}>
                      <span>{isUrdu ? "تاریخ:" : "Date:"} {new Date(payment.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span>{isUrdu ? "طریقہ:" : "Method:"} {payment.method}</span>
                      {(payment as any).reference && <span>{isUrdu ? "حوالہ:" : "Ref:"} {(payment as any).reference}</span>}
                    </div>
                    {payment.description && (
                      <p className={`text-xs mt-1 ml-8 italic ${dc ? "text-gray-500" : "text-gray-400"}`}>{payment.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-8 ${sub}`}>
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{isUrdu ? "ابھی تک کوئی ادائیگی نہیں" : "No payments recorded yet"}</p>
            </div>
          )}
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav role="customer" />
      <CustomerMobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </div>
  );
}