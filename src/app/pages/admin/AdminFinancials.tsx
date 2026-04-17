import { Case, Payment } from "../../lib/mockData";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { addPayment } from "../../lib/caseApi";
import { useState } from "react";
import { useNavigate } from "react-router";
import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { DollarSign, TrendingUp, TrendingDown, Plus, Download, X, Search, Eye } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../lib/toast";
import { modalVariants, staggerContainer, staggerItem } from "../../lib/animations";
import { usePortalPrefix } from "../../lib/usePortalPrefix";

export function AdminFinancials() {
  const navigate = useNavigate();
  const prefix = usePortalPrefix();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const labelCls = `block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`;

  const [cases, setCases] = useState<Case[]>([]);

  useEffect(() => {
    const fetchCases = async () => {
      const { data, error } = await supabase.from('cases').select('*');
      if (!error && data) setCases(data.map((r: any) => mapSupabaseCaseToLocal(r)));
    };
    fetchCases();
  }, []);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [newPayment, setNewPayment] = useState({ amount: 0, method: "cash" as Payment["method"], description: "", receiptNumber: "" });

  // Compute real transactions from all cases
  const allTransactions = cases.flatMap((c) =>
    c.payments.map((p) => ({
      ...p,
      caseId: c.id,
      customer: c.customerName,
      agent: c.agentName,
      status: "completed" as const,
    }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);

  const totalRevenue = cases.reduce((s, c) => s + c.paidAmount, 0);
  const totalFees = cases.reduce((s, c) => s + c.totalFee, 0);
  const outstanding = totalFees - totalRevenue;
  const avgTransaction = allTransactions.length > 0 ? totalRevenue / allTransactions.length : 0;

  const handleRecordPayment = async () => {
    if (!selectedCaseId) { toast.error("Please select a case"); return; }
    if (newPayment.amount <= 0) { toast.error("Please enter a valid amount"); return; }
    const lt = toast.loading("Recording payment...");
    setTimeout(async () => {
      const receipt = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      await addPayment(selectedCaseId, {
        ...newPayment,
        receiptNumber: receipt,
        date: new Date().toISOString(),
        collectedBy: "Admin",
      });
      toast.dismiss(lt);
      toast.success(`Payment of PKR ${newPayment.amount.toLocaleString()} recorded! Receipt: ${receipt}`);
      setShowPaymentModal(false);
      setNewPayment({ amount: 0, method: "cash", description: "", receiptNumber: "" });
      setSelectedCaseId("");
      // Refresh
      window.location.reload();
    }, 1200);
  };

  const handleExport = () => {
    const lt = toast.loading("Exporting financial report...");
    setTimeout(() => {
      const headers = "Date,Case ID,Customer,Amount,Method,Agent,Receipt\n";
      const rows = allTransactions.map((tx) =>
        `${new Date(tx.date).toLocaleDateString()},${tx.caseId},${tx.customer},${tx.amount},${tx.method},${tx.agent},${tx.receiptNumber}`
      ).join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emerald-financials-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(lt);
      toast.success("Financial report exported!");
    }, 1500);
  };

  const handleViewReceipt = (tx: any) => {
    setSelectedTx(tx);
    setShowReceiptModal(true);
  };

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}

        <main className="p-3 sm:p-4 md:p-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div>
              <h1 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>{t("financials.title")}</h1>
              <p className={sub}>{t("financials.subtitle")}</p>
            </div>
            <div className="flex gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all">
                <Plus className="w-4 h-4" /> {t("financials.recordPayment")}
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleExport} className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                <Download className="w-4 h-4" /> Export
              </motion.button>
            </div>
          </motion.div>

          {/* Summary Cards */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
            {[
              { icon: DollarSign, color: "blue", value: `PKR ${(totalRevenue / 1000000).toFixed(1)}M`, label: t("financials.revenueMonth"), trend: `${allTransactions.length} transactions`, TrendIcon: TrendingUp, trendColor: "green" },
              { icon: DollarSign, color: "indigo", value: `PKR ${(totalRevenue / 1000000).toFixed(1)}M`, label: t("financials.collected"), trend: `${Math.round((totalRevenue / totalFees) * 100)}% collection rate`, TrendIcon: null, trendColor: "blue" },
              { icon: DollarSign, color: "orange", value: `PKR ${(outstanding / 1000).toFixed(0)}K`, label: t("financials.outstanding"), trend: `${cases.filter((c) => c.paidAmount < c.totalFee).length} pending`, TrendIcon: TrendingDown, trendColor: "orange" },
              { icon: DollarSign, color: "purple", value: `PKR ${(avgTransaction / 1000).toFixed(0)}K`, label: t("financials.avgTransaction"), trend: "Per transaction", TrendIcon: null, trendColor: "purple" },
            ].map((s, idx) => {
              const Icon = s.icon;
              return (
                <motion.div key={idx} variants={staggerItem} whileHover={{ y: -3 }} onClick={() => navigate(`${prefix}/reports`)} className={`${card} rounded-xl shadow-sm p-4 md:p-6 border cursor-pointer active:opacity-80 active:scale-[0.98] transition-all ${dc ? "border-gray-700" : "border-gray-100"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <Icon className={`w-6 h-6 md:w-8 md:h-8 text-${s.color}-600`} />
                    {s.TrendIcon && <s.TrendIcon className={`w-4 h-4 text-${s.trendColor}-500`} />}
                  </div>
                  <h3 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>{s.value}</h3>
                  <p className={`text-xs md:text-sm ${sub}`}>{s.label}</p>
                  <p className={`text-${s.trendColor}-600 text-xs font-semibold mt-2`}>{s.trend}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Transactions */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${card} rounded-xl shadow-sm overflow-hidden`}>
            <div className={`p-4 md:p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <h3 className={`text-lg font-semibold ${txt}`}>{t("financials.recentTransactions")}</h3>
            </div>
            {/* Mobile Card View */}
            <div className="block sm:hidden p-3 space-y-2.5">
              {allTransactions.slice(0, 20).map((tx, idx) => (
                <motion.div key={`m-${tx.id}-${idx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => handleViewReceipt(tx)}
                  className={`p-3.5 rounded-xl cursor-pointer active:opacity-80 transition-all border-l-4 border-l-blue-500 ${dc ? "bg-gray-700/40 hover:bg-gray-700/60" : "bg-gray-50 hover:bg-gray-100"}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-blue-600">{tx.caseId}</span>
                    <span className={`text-sm font-bold ${txt}`}>PKR {tx.amount.toLocaleString()}</span>
                  </div>
                  <p className={`text-sm font-medium mb-1 ${txt}`}>{tx.customer}</p>
                  <div className="flex items-center justify-between">
                    <div className={`text-xs ${sub}`}>
                      <span className="capitalize">{tx.method}</span> · <span>{tx.agent}</span>
                    </div>
                    <span className={`text-[10px] ${sub}`}>{new Date(tx.date).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1.5 text-[10px] font-mono text-blue-500">{tx.receiptNumber}</div>
                </motion.div>
              ))}
            </div>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className={dc ? "bg-gray-700" : "bg-gray-50"}>
                  <tr>
                    {["Date", "Case ID", "Customer", "Amount", "Method", "Agent", "Receipt", "Action"].map((h) => (
                      <th key={h} className={`text-left py-3 px-3 md:px-4 text-xs font-semibold uppercase tracking-wider ${dc ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allTransactions.slice(0, 20).map((tx, idx) => (
                    <motion.tr key={`${tx.id}-${idx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                      onClick={() => handleViewReceipt(tx)}
                      className={`border-b cursor-pointer active:opacity-80 ${dc ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"} transition-colors`}>
                      <td className={`py-3 px-3 md:px-4 text-sm ${dc ? "text-gray-300" : "text-gray-900"}`}>{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="py-3 px-3 md:px-4 text-sm font-mono font-semibold text-blue-600">{tx.caseId}</td>
                      <td className={`py-3 px-3 md:px-4 text-sm ${dc ? "text-gray-300" : "text-gray-900"}`}>{tx.customer}</td>
                      <td className={`py-3 px-3 md:px-4 text-sm font-semibold ${txt}`}>PKR {tx.amount.toLocaleString()}</td>
                      <td className={`py-3 px-3 md:px-4 text-sm capitalize ${sub}`}>{tx.method}</td>
                      <td className={`py-3 px-3 md:px-4 text-sm ${sub}`}>{tx.agent}</td>
                      <td className="py-3 px-3 md:px-4 text-xs font-mono text-blue-600">{tx.receiptNumber}</td>
                      <td className="py-3 px-3 md:px-4">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); handleViewReceipt(tx); }} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-semibold">
                          <Eye className="w-3.5 h-3.5" /> Receipt
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {allTransactions.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
                <p className={sub}>No transactions found</p>
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* Record Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPaymentModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()} className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-md`}>
              <div className={`flex items-center justify-between p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg font-bold ${txt}`}>Record Payment</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowPaymentModal(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X className="w-5 h-5" /></motion.button>
              </div>
              <div className="p-6 space-y-4">
                <div><label className={labelCls}>Select Case *</label>
                  <select value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)} className={inputCls}>
                    <option value="">-- Select a case --</option>
                    {cases.filter((c) => c.paidAmount < c.totalFee).slice(0, 30).map((c) => (
                      <option key={c.id} value={c.id}>{c.id} - {c.customerName} (Outstanding: PKR {(c.totalFee - c.paidAmount).toLocaleString()})</option>
                    ))}
                  </select>
                </div>
                <div><label className={labelCls}>Amount (PKR) *</label><input type="number" value={newPayment.amount || ""} onChange={(e) => setNewPayment({ ...newPayment, amount: Number(e.target.value) })} className={inputCls} placeholder="Enter amount" /></div>
                <div><label className={labelCls}>Payment Method</label>
                  <select value={newPayment.method} onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value as Payment["method"] })} className={inputCls}>
                    {[["cash", "Cash"], ["bank", "Bank Transfer"], ["easypaisa", "EasyPaisa"], ["jazzcash", "JazzCash"], ["card", "Card"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Description</label><input type="text" value={newPayment.description} onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })} className={inputCls} placeholder="Payment description" /></div>
              </div>
              <div className={`flex gap-3 p-6 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowPaymentModal(false)} className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>Cancel</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRecordPayment} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">Record Payment</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceiptModal && selectedTx && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReceiptModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()} className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-sm`}>
              <div className={`p-6 text-center border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-3">E</div>
                <h2 className={`text-lg font-bold ${txt}`}>Payment Receipt</h2>
                <p className={`text-xs ${sub}`}>Emerald Visa Consultancy Service</p>
              </div>
              <div className="p-6 space-y-3">
                {[
                  { label: "Receipt #", value: selectedTx.receiptNumber },
                  { label: "Case ID", value: selectedTx.caseId },
                  { label: "Customer", value: selectedTx.customer },
                  { label: "Amount", value: `PKR ${selectedTx.amount.toLocaleString()}` },
                  { label: "Method", value: selectedTx.method },
                  { label: "Date", value: new Date(selectedTx.date).toLocaleDateString() },
                  { label: "Agent", value: selectedTx.agent },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className={`text-sm ${sub}`}>{item.label}</span>
                    <span className={`text-sm font-semibold ${txt}`}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div className={`flex gap-3 p-6 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowReceiptModal(false)} className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>Close</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { toast.success("Receipt downloaded!"); setShowReceiptModal(false); }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Download</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}