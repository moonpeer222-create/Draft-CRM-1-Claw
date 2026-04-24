import { useState } from "react";
import {
  CheckCircle2, Clock, Flag, ArrowUpDown, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../../lib/toast";
import { type Case } from "../../../lib/mockData";
import { updateCase } from "../../../lib/caseApi";
import { supabase } from "../../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../../lib/caseMappers";
import { load, save } from "./operatorTypes";

// 14-stage workflow order (matches mockData.ts status type)
const STAGE_ORDER: { id: string; en: string; ur: string; stageNum: number }[] = [
  { id: "document_collection", en: "Document Collection", ur: "کاغزات جمع", stageNum: 1 },
  { id: "selection_call", en: "Selection Call", ur: "سلیکشن کال", stageNum: 2 },
  { id: "medical_token", en: "Medical Token", ur: "میڈیکل ٹوکن", stageNum: 3 },
  { id: "check_medical", en: "Check Medical", ur: "میڈیکل چیک", stageNum: 4 },
  { id: "biometric", en: "Biometric", ur: "بایومیٹرک", stageNum: 5 },
  { id: "payment_confirmation", en: "Payment Confirmation", ur: "ادائیگی تصدیق", stageNum: 6 },
  { id: "e_number_issued", en: "E-Number Issued", ur: "ای نمبر جاری", stageNum: 7 },
  { id: "original_documents", en: "Original Documents", ur: "اصل کاغزات", stageNum: 8 },
  { id: "protector", en: "Protector", ur: "پروٹیکٹر", stageNum: 9 },
  { id: "submitted_to_manager", en: "Submitted to Manager", ur: "مینیجر کو بھیجا", stageNum: 10 },
  { id: "approved", en: "Approved", ur: "منظور", stageNum: 11 },
  { id: "remaining_amount", en: "Remaining Amount", ur: "باقی رقم", stageNum: 12 },
  { id: "ticket_booking", en: "Ticket Booking", ur: "ٹکٹ بکنگ", stageNum: 13 },
  { id: "completed", en: "Completed", ur: "مکمل", stageNum: 14 },
];

export function StatusSection({ u, dc, card, txt, sub, bigBtn, cases, addNotification, onCaseUpdated }: any) {
  const [confirmedIds, setConfirmedIds] = useState<string[]>(() => load("emr-op-confirmed", []));
  const [filterPending, setFilterPending] = useState(false);
  const [confirmModal, setConfirmModal] = useState<Case | null>(null);
  const [flagModal, setFlagModal] = useState<Case | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [statusChangeModal, setStatusChangeModal] = useState<Case | null>(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState<string>("");

  const statusColors: Record<string, { bg: string; text: string; label: string; labelUr: string }> = {
    document_collection: { bg: "bg-blue-500", text: "text-blue-600", label: "Documents", labelUr: "کاغزات" },
    selection_call: { bg: "bg-cyan-500", text: "text-cyan-600", label: "Selection Call", labelUr: "سلیکشن کال" },
    medical_token: { bg: "bg-yellow-500", text: "text-yellow-600", label: "Medical", labelUr: "میڈیکل" },
    check_medical: { bg: "bg-yellow-500", text: "text-yellow-600", label: "Medical Check", labelUr: "میڈیکل چیک" },
    biometric: { bg: "bg-purple-500", text: "text-purple-600", label: "Biometric", labelUr: "بایومیٹرک" },
    payment_confirmation: { bg: "bg-green-500", text: "text-green-600", label: "Payment", labelUr: "ادائیگی" },
    e_number_issued: { bg: "bg-teal-500", text: "text-teal-600", label: "E-Number", labelUr: "ای نمبر" },
    original_documents: { bg: "bg-indigo-500", text: "text-indigo-600", label: "Originals", labelUr: "اصل کاغزات" },
    protector: { bg: "bg-orange-500", text: "text-orange-600", label: "Protector", labelUr: "پروٹیکٹر" },
    submitted_to_manager: { bg: "bg-pink-500", text: "text-pink-600", label: "Manager", labelUr: "مینیجر" },
    approved: { bg: "bg-lime-500", text: "text-lime-600", label: "Approved", labelUr: "منظور" },
    remaining_amount: { bg: "bg-rose-500", text: "text-rose-600", label: "Balance", labelUr: "باقی رقم" },
    ticket_booking: { bg: "bg-sky-500", text: "text-sky-600", label: "Ticket", labelUr: "ٹکٹ" },
    completed: { bg: "bg-emerald-500", text: "text-emerald-600", label: "Completed", labelUr: "مکمل" },
    rejected: { bg: "bg-red-500", text: "text-red-600", label: "Rejected", labelUr: "مسترد" },
  };
  const getStatus = (s: string) => statusColors[s] || { bg: "bg-gray-500", text: "text-gray-600", label: s, labelUr: s };
  const displayCases = filterPending ? cases.filter((c: Case) => !confirmedIds.includes(c.id)) : cases;

  // Get available next stages for a case
  const getNextStages = (currentStatus: string) => {
    const currentIdx = STAGE_ORDER.findIndex(s => s.id === currentStatus);
    if (currentIdx === -1) return STAGE_ORDER; // unknown status, show all
    // Allow moving forward up to 3 stages or backward 1 stage
    const minIdx = Math.max(0, currentIdx - 1);
    const maxIdx = Math.min(STAGE_ORDER.length - 1, currentIdx + 3);
    return STAGE_ORDER.slice(minIdx, maxIdx + 1).filter(s => s.id !== currentStatus);
  };

  const doStatusChange = async (c: Case) => {
    if (!selectedNewStatus) { toast.error(u("Select a status", "صورتحال منتخب کریں")); return; }
    const stageInfo = STAGE_ORDER.find(s => s.id === selectedNewStatus);
    if (!stageInfo) return;

    await updateCase(c.id, {
      status: selectedNewStatus as Case["status"],
      currentStage: stageInfo.stageNum,
      stageStartedAt: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      isOverdue: false,
    });

    const { data } = await supabase.from('cases').select('*').eq('id', c.id).single();
    const refreshed = data ? mapSupabaseCaseToLocal(data) : null;

    const oldSt = getStatus(c.status);
    const newSt = getStatus(selectedNewStatus);
    addNotification(
      `Status Changed: ${c.id} ${oldSt.label} → ${newSt.label} by Operator`,
      `صورتحال تبدیل: ${c.id} ${oldSt.labelUr} → ${newSt.labelUr} آپریٹر نے کی`,
      "status"
    );
    toast.success(u(`✅ ${c.id} status changed to ${newSt.label}`, `✅ ${c.id} کی صورتحال ${newSt.labelUr} ہو گئی`));
    setStatusChangeModal(null);
    setSelectedNewStatus("");
    // Notify parent to refresh cases
    if (onCaseUpdated) onCaseUpdated();
  };

  const doConfirm = (c: Case) => {
    const updated = [...confirmedIds, c.id];
    setConfirmedIds(updated);
    save("emr-op-confirmed", updated);
    setConfirmModal(null);
    const st = getStatus(c.status);
    addNotification(`Status Verified: ${c.id} ${st.label} Confirmed → Admin Notified`, `صورتحال تصدیق: ${c.id} ${st.labelUr} تصدیق ہو گئی → ایڈمن کو اطلاع`, "status");
    toast.success(u("✅ Confirmed! Admin notified.", "✅ تصدیق ہو گئی! ایڈمن کو اطلاع دے دی۔"));
  };

  const doFlag = (c: Case) => {
    const reason = flagReason || u("Needs attention", "توجہ ضروری ہے");
    addNotification(`Flag: ${c.id} ${c.customerName} — ${reason}`, `خبردار: ${c.id} ${c.customerName} — ${reason}`, "flag");
    setFlagModal(null);
    setFlagReason("");
    toast.success(u("⚠️ Flagged! Admin notified.", "⚠️ خبردار! ایڈمن کو اطلاع دے دی۔"));
  };

  const flagReasons = [
    { en: "Documents missing", ur: "کاغزات نامکمل" },
    { en: "Payment overdue", ur: "ادائیگی تاخیر" },
    { en: "Client not responding", ur: "کلائنٹ جواب نہیں دے رہا" },
    { en: "Deadline passed", ur: "آخری تاریخ گزر گئی" },
    { en: "Other issue", ur: "دوسرا مسئلہ" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
              className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${dc ? "bg-gray-800" : "bg-white"}`}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className={`text-lg font-bold mb-1 ${txt}`}>{u("Confirm Status?", "صورتحال کی تصدیق کریں؟")}</h3>
                <p className={`text-sm mb-1 ${sub}`}>{confirmModal.id} — {confirmModal.customerName}</p>
                <p className={`text-xs mb-4 px-3 py-1 inline-block rounded-full ${dc ? "bg-gray-700" : "bg-gray-100"} ${getStatus(confirmModal.status).text}`}>
                  {u(getStatus(confirmModal.status).label, getStatus(confirmModal.status).labelUr)}
                </p>
                <p className={`text-xs mb-5 ${sub}`}>{u("Admin will receive a push notification.", "ایڈمن کو فوری اطلاع بھیجی جائے گی۔")}</p>
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => doConfirm(confirmModal)}
                    className={`${bigBtn} flex-1 bg-emerald-600 text-white !py-3 !min-h-[48px]`}>
                    <Check className="w-4 h-4" /> {u("Yes, Confirm", "ہاں، تصدیق کریں")}
                  </motion.button>
                  <button onClick={() => setConfirmModal(null)}
                    className={`flex-1 py-3 rounded-xl font-medium ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                    {u("Cancel", "واپس")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flag Modal */}
      <AnimatePresence>
        {flagModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => { setFlagModal(null); setFlagReason(""); }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
              className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${dc ? "bg-gray-800" : "bg-white"}`}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <Flag className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className={`text-lg font-bold mb-1 ${txt}`}>{u("Flag Issue", "مسئلہ کی اطلاع دیں")}</h3>
                <p className={`text-sm mb-4 ${sub}`}>{flagModal.id} — {flagModal.customerName}</p>
                <div className="space-y-2 mb-4">
                  {flagReasons.map(r => (
                    <button key={r.en} onClick={() => setFlagReason(r.en)}
                      className={`w-full text-start px-4 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-all ${
                        flagReason === r.en ? "bg-amber-500 text-white" : dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                      }`}>
                      {u(r.en, r.ur)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => doFlag(flagModal)}
                    className={`${bigBtn} flex-1 bg-amber-500 text-white !py-3 !min-h-[48px]`}>
                    <Flag className="w-4 h-4" /> {u("Send Flag", "اطلاع بھیجیں")}
                  </motion.button>
                  <button onClick={() => { setFlagModal(null); setFlagReason(""); }}
                    className={`flex-1 py-3 rounded-xl font-medium ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                    {u("Cancel", "واپس")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Change Modal */}
      <AnimatePresence>
        {statusChangeModal && (() => {
          const nextStages = getNextStages(statusChangeModal.status);
          const currentStage = STAGE_ORDER.find(s => s.id === statusChangeModal.status);
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => { setStatusChangeModal(null); setSelectedNewStatus(""); }}>
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
                className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${dc ? "bg-gray-800" : "bg-white"}`}>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-4">
                    <ArrowUpDown className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className={`text-lg font-bold mb-1 ${txt}`}>{u("Change Status", "صورتحال تبدیل کریں")}</h3>
                  <p className={`text-sm mb-1 ${sub}`}>{statusChangeModal.id} — {statusChangeModal.customerName}</p>
                  <p className={`text-xs mb-4 px-3 py-1 inline-block rounded-full ${dc ? "bg-gray-700" : "bg-gray-100"} ${getStatus(statusChangeModal.status).text}`}>
                    {u("Current", "موجودہ")}: {u(getStatus(statusChangeModal.status).label, getStatus(statusChangeModal.status).labelUr)}
                    {currentStage ? ` (${currentStage.stageNum}/14)` : ""}
                  </p>
                  <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
                    {nextStages.map(stage => {
                      const isSelected = selectedNewStatus === stage.id;
                      const stColor = getStatus(stage.id);
                      const currentIdx = STAGE_ORDER.findIndex(s => s.id === statusChangeModal.status);
                      const stageIdx = STAGE_ORDER.findIndex(s => s.id === stage.id);
                      const isForward = stageIdx > currentIdx;
                      return (
                        <button key={stage.id} onClick={() => setSelectedNewStatus(stage.id)}
                          className={`w-full text-start px-4 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-all flex items-center gap-3 ${
                            isSelected ? "bg-blue-600 text-white ring-2 ring-blue-400" : dc ? "bg-gray-700 text-gray-300" : "bg-gray-50 text-gray-600 border border-gray-200"
                          }`}>
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${stColor.bg}`} />
                          <span className="flex-1">{u(stage.en, stage.ur)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            isSelected ? "bg-white/20 text-white" : isForward ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {isForward ? `↑ ${stage.stageNum}` : `← ${stage.stageNum}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-3">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => doStatusChange(statusChangeModal)}
                      disabled={!selectedNewStatus}
                      className={`${bigBtn} flex-1 !py-3 !min-h-[48px] ${selectedNewStatus ? "bg-blue-600 text-white" : "bg-gray-400 text-gray-200 cursor-not-allowed"}`}>
                      <ArrowUpDown className="w-4 h-4" /> {u("Change", "تبدیل کریں")}
                    </motion.button>
                    <button onClick={() => { setStatusChangeModal(null); setSelectedNewStatus(""); }}
                      className={`flex-1 py-3 rounded-xl font-medium ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                      {u("Cancel", "واپس")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <div className="flex gap-2">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setFilterPending(!filterPending)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm min-h-[48px] ${
            filterPending ? "bg-amber-500 text-white" : dc ? "bg-gray-800 text-gray-300 border border-gray-700" : "bg-white text-gray-600 border border-gray-200"
          }`}>
          <Clock className="w-4 h-4" /> {u("Pending Only", "صرف باقی")}
        </motion.button>
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${dc ? "bg-gray-800 text-gray-300" : "bg-white text-gray-600"} border ${dc ? "border-gray-700" : "border-gray-200"}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {confirmedIds.length}/{cases.length} {u("confirmed", "تصدیق شدہ")}
        </div>
      </div>

      <div className="space-y-2">
        {displayCases.map((c: Case) => {
          const s = getStatus(c.status);
          const isConfirmed = confirmedIds.includes(c.id);
          return (
            <div key={c.id} className={`rounded-xl border p-3 sm:p-4 ${card} ${isConfirmed ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${s.bg}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-mono ${dc ? "text-gray-400" : "text-gray-500"}`}>{c.id}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${dc ? "bg-gray-700" : "bg-gray-100"} ${s.text}`}>{u(s.label, s.labelUr)}</span>
                  </div>
                  <p className={`text-sm font-semibold ${txt}`}>{c.customerName}</p>
                </div>
                {isConfirmed ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium"><CheckCircle2 className="w-4 h-4" /> {u("Done", "ہو گیا")}</span>
                    {c.status !== "completed" && c.status !== "rejected" && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setStatusChangeModal(c)}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold min-h-[32px] ${dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                        <ArrowUpDown className="w-3 h-3" />
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setConfirmModal(c)}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold min-h-[44px]">
                      <Check className="w-4 h-4" /> {u("OK", "تصدیق")}
                    </motion.button>
                    {c.status !== "completed" && c.status !== "rejected" && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setStatusChangeModal(c)}
                        className={`flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-sm font-bold min-h-[44px] ${dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                        <ArrowUpDown className="w-4 h-4" />
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setFlagModal(c)}
                      className={`flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-bold min-h-[44px] ${dc ? "bg-amber-700/30 text-amber-300" : "bg-amber-100 text-amber-700"}`}>
                      <Flag className="w-4 h-4" />
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
