const fs = require('fs');

// Read extracted chunks
const cState = fs.readFileSync('conflict_state.txt', 'utf8');
const mStates = fs.readFileSync('modal_sub_states.txt', 'utf8');
const dlEffect = fs.readFileSync('deep_link_effect.txt', 'utf8');
const tEffect = fs.readFileSync('tick_effect.txt', 'utf8');
const handlers = fs.readFileSync('detail_handlers.txt', 'utf8');
const deleteHandler = fs.readFileSync('delete_handler.txt', 'utf8');
const colors = fs.readFileSync('detail_colors.txt', 'utf8');
const detailJsx = fs.readFileSync('detail_jsx.txt', 'utf8');
const delayJsx = fs.readFileSync('delay_modal_jsx.txt', 'utf8');

const content = `import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Trash2, Check, Link2, AlertTriangle, Clock, ChevronDown, Timer, 
  MessageSquare, DollarSign, Phone, Send, Plus, CheckCircle2, ChevronRight,
  Eye, Edit, MapPin, Calendar, User, Briefcase, FileText, Heart, GraduationCap, ShieldCheck, Home, 
  RotateCcw, XCircle
} from 'lucide-react';
import { toast } from '../lib/toast';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import { mapSupabaseCaseToLocal } from '../lib/caseMappers';
import { 
  updateCase, updateCaseStatus, addPayment, addNote, deleteCase, 
  getStageLabel, getPipelineStages, getOverdueInfo, getDelayReasonLabel, 
  reportDelay, shouldAutoMigrateToVisa, DELAY_REASONS
} from '../lib/mockData';
import { pipelineApi, visaverseApi } from '../lib/api';
import { NotificationService } from '../lib/notifications';
import { AuditLogService } from '../lib/auditLog';
import { DataSyncService } from '../lib/dataSync';
import { sendCaseStatusEmail, extractEmailsFromCase } from '../lib/emailService';
import { pushCases } from '../lib/syncService';
import { useConflictPolling } from '../lib/useConflictPolling';
import { modalVariants } from '../lib/animations';
import { RealtimeIndicator } from './RealtimeIndicator';
import { EditableCaseFields } from './EditableCaseFields';
import { VisualTimelineStepper } from './VisualTimelineStepper';
import { WhatsAppActions } from './WhatsAppActions';
import { SirAtifApprovalButton } from './SirAtifApprovalButton';
import { EmojiMoodTracker } from './visaverse/EmojiMoodTracker';
import { ARScannerButton } from './visaverse/ARScanner';
import { MandatoryDocumentChecklist } from './MandatoryDocumentChecklist';
import { DocumentUploadInterface } from './DocumentUploadInterface';
import { DocumentFileStore } from '../lib/documentStore';
import { PaymentConfirmationModal } from './PaymentConfirmationModal';
import { CancellationReopenModal } from './CancellationReopenModal';
import { ImageLightbox } from './ImageLightbox';
import { documentUploadApi } from '../lib/api';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { Case, Payment } from '../lib/mockData';

interface CaseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: Case | null;
  adminName: string;
  isMasterAdmin: boolean;
  onSuccess: () => void;
}

export function CaseDetailModal({ 
  isOpen, 
  onClose, 
  caseData, 
  adminName, 
  isMasterAdmin, 
  onSuccess 
}: CaseDetailModalProps) {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = \`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all \${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}\`;
  const labelCls = \`block text-sm font-medium mb-1.5 \${dc ? "text-gray-300" : "text-gray-700"}\`;

  const [selectedCase, setSelectedCase] = useState<Case | null>(caseData);
  const [activeTab, setActiveTab] = useState("overview");
  const [linkCopied, setLinkCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDelayReason, setSelectedDelayReason] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delayStep, setDelayStep] = useState<"reason" | "note">("reason");
  const [deepLinked, setDeepLinked] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  useEffect(() => {
    setSelectedCase(caseData);
  }, [caseData]);

  const loadCases = onSuccess;

${cState.replace(/showCaseDetail/g, 'isOpen')}

${mStates}

${dlEffect.replace(/setShowCaseDetail\(true\)/g, 'setSelectedCase(target); setDeepLinked(true)')}

${tEffect}

${handlers}

${deleteHandler.replace(/setShowCaseDetail\(false\)/g, 'onClose()')}

${colors}

  const getStatusColor = (status: Case["status"]) => {
    const colors: Record<string, string> = {
      document_collection: dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700",
      selection_call: dc ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-700",
      medical_token: dc ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700",
      check_medical: dc ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-700",
      biometric: dc ? "bg-cyan-900/30 text-cyan-400" : "bg-cyan-100 text-cyan-700",
      e_number_issued: dc ? "bg-teal-900/30 text-teal-400" : "bg-teal-100 text-teal-700",
      payment_confirmation: dc ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-700",
      original_documents: dc ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-100 text-indigo-700",
      submitted_to_manager: dc ? "bg-violet-900/30 text-violet-400" : "bg-violet-100 text-violet-700",
      approved: dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700",
      remaining_amount: dc ? "bg-pink-900/30 text-pink-400" : "bg-pink-100 text-pink-700",
      protector: dc ? "bg-lime-900/30 text-lime-400" : "bg-lime-100 text-lime-700",
      ticket_booking: dc ? "bg-sky-900/30 text-sky-400" : "bg-sky-100 text-sky-700",
      completed: dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700",
      rejected: dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700",
    };
    return colors[status] || colors.document_collection;
  };

  const getPriorityColor = (priority: Case["priority"]) => {
    const colors: Record<string, string> = {
      low: dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700",
      medium: dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700",
      high: dc ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700",
      urgent: dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700",
    };
    return colors[priority];
  };

  if (!isOpen || !selectedCase) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => onClose()}>
        <motion.div
           variants={modalVariants} initial="hidden" animate="visible" exit="exit"
           onClick={(e) => e.stopPropagation()}
           className={\`\${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto \${deepLinked ? "animate-notif-ring" : ""}\`}
        >
          {/* Deep-link highlight banner */}
          {deepLinked && (
            <div className="animate-notif-banner bg-gradient-to-r from-blue-500/20 via-blue-400/10 to-blue-500/20 border-b border-blue-500/30 px-6 py-2 flex items-center gap-2">
              <div className="animate-notif-dot w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs font-medium text-blue-400">
                {isUrdu ? "اطلاع سے کھولا گیا" : "Opened from notification"}
              </span>
            </div>
          )}
          {/* Header */}
          <div className={\`flex items-center justify-between p-6 border-b \${dc ? "border-gray-700" : "border-gray-200"}\`}>
            <div>
              <div className="flex items-center gap-3">
                <h2 className={\`text-xl font-bold \${txt}\`}>{selectedCase.id}</h2>
                <span className={\`px-3 py-1 rounded-full text-xs font-semibold \${getStatusColor(selectedCase.status)}\`}>{getStageLabel(selectedCase.status)}</span>
                <span className={\`px-3 py-1 rounded-full text-xs font-semibold \${getPriorityColor(selectedCase.priority)}\`}>{selectedCase.priority}</span>
                <RealtimeIndicator caseId={selectedCase.id} onRefresh={async () => {
                  const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                  if (data) {
                    setSelectedCase(mapSupabaseCaseToLocal(data));
                    toast.success(isUrdu ? "کیس تازہ ترین ہو گیا" : "Case refreshed");
                  }
                }} />
              </div>
              <p className={\`mt-1 \${sub}\`}>{selectedCase.customerName} • {selectedCase.country} • {selectedCase.jobType}</p>
            </div>
            <div className="flex items-center gap-2">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { const url = \`\${window.location.origin}/admin/cases/\${selectedCase.id}\`; NotificationService.copyToClipboard(url).then(() => { setLinkCopied(true); toast.success(isUrdu ? "لنک کاپی ہو گیا!" : \`Link copied: \${selectedCase.id}\`); setTimeout(() => setLinkCopied(false), 2000); }).catch(() => {}); }} className={\`p-2 rounded-lg transition-colors \${linkCopied ? "text-green-500 bg-green-50 dark:bg-green-900/20" : dc ? "text-gray-400 hover:bg-gray-700 hover:text-blue-400" : "text-gray-400 hover:bg-blue-50 hover:text-blue-600"}\`} title={isUrdu ? "لنک کاپی" : "Copy Link"}>{linkCopied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}</motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDeleteCase(selectedCase.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-5 h-5" /></motion.button>
              <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => onClose()} className={\`p-2 rounded-full \${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}\`}><X className="w-5 h-5" /></motion.button>
            </div>
          </div>

          {/* Conflict Warning Banner — Real-time Polling */}
          <AnimatePresence>
            {conflictState.hasConflict && conflictState.record && !conflictState.dismissed && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className={\`mx-6 mt-3 p-3 rounded-xl border flex items-start gap-3 \${dc ? "bg-amber-900/20 border-amber-700/50 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"}\`}
              >
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{isUrdu ? "ڈیٹا کہیں اور اپ ڈیٹ ہوا!" : "Data Updated Elsewhere!"}</p>
                    <span className={\`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded \${dc ? "bg-amber-800/40 text-amber-400" : "bg-amber-200/60 text-amber-700"}\`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <p className={\`text-xs mt-0.5 \${dc ? "text-amber-400/80" : "text-amber-700"}\`}>
                    {\`\${conflictState.record.lastModifiedByName} (\${conflictState.record.lastModifiedByRole}) modified this case \${conflictState.timeSince}\`}
                  </p>
                  {conflictState.record.changeDescription && (
                    <p className={\`text-[10px] mt-1 italic \${dc ? "text-amber-500/70" : "text-amber-600"}\`}>{conflictState.record.changeDescription}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={async () => {
                    conflictState.refresh();
                    const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                    const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
                    if (refreshed) setSelectedCase({ ...refreshed });
                    toast.success(isUrdu ? "تازہ ترین ڈیٹا لوڈ ہو گیا" : "Latest data loaded");
                  }}
                    className={\`px-2.5 py-1 rounded-lg text-xs font-semibold \${dc ? "bg-amber-800/50 text-amber-300 hover:bg-amber-700/60" : "bg-amber-100 text-amber-800 hover:bg-amber-200"}\`}>
                    {isUrdu ? "ریفریش" : "Refresh"}
                  </button>
                  <button onClick={conflictState.dismiss}
                    className={\`px-2.5 py-1 rounded-lg text-[10px] \${dc ? "text-gray-500 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"}\`}>
                    {isUrdu ? "بند" : "Dismiss"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Content and everything else... */}
          <div className="p-6">
             {/* [CONTENT_HERE] */}
             {activeTab === "overview" && (
                <div className="space-y-6">
                <EditableCaseFields
                    caseData={selectedCase}
                    darkMode={dc}
                    isUrdu={isUrdu}
                    userName={adminName}
                    userRole={isMasterAdmin ? "master_admin" : "admin"}
                    onUpdate={(updated) => {
                    setSelectedCase(updated);
                    onSuccess();
                    }}
                />
                
                {/* Status Change */}
                <div>
                    <label className={labelCls}>Update Status</label>
                    <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="relative flex-1 w-full sm:max-w-xs">
                        <select
                        value={selectedCase.status}
                        onChange={(e) => handleUpdateStatus(selectedCase.id, e.target.value as Case["status"])}
                        className={\`w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 \${
                            dc
                            ? "bg-gray-700 border-gray-600 text-gray-200 hover:border-blue-500/50"
                            : "bg-white border-gray-200 text-gray-800 hover:border-blue-400"
                        }\`}
                        >
                        {(() => {
                            const pType = selectedCase.pipelineType || "visa";
                            const stages = (pType === "visa" ? [] : []).concat(getPipelineStages(pType));
                            return stages.map((s) => (
                            <option key={s.key} value={s.key}>
                                {s.stageNumber > 0 ? \`\${s.stageNumber}. \` : \"✕ \"}{isUrdu ? s.labelUrdu : s.label}
                            </option>
                            ));
                        })()}
                        </select>
                        <ChevronDown className={\`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none \${sub}\`} />
                    </div>
                    </div>
                </div>

                {/* Overdue info, visual stepper, quick actions... */}
                {/* ... (rest of JSX) ... */}
                </div>
             )}
          </div>
        </motion.div>
      </motion.div>
      
      {/* Modals */}
      <PaymentConfirmationModal
        caseData={selectedCase}
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentRecorded={(updatedCase) => {
          setSelectedCase(updatedCase);
          onSuccess();
        }}
      />
      
      {/* Delay Modal JSX */}
      {showDelayModal && (
          {/* [DELAY_MODAL_JSX] */}
      )}
    </AnimatePresence>
  );
}
\`;

console.log("Ready to assemble");
`;
fs.writeFileSync('build_case_detail_modal.cjs', content);
