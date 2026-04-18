import { AgentHeader } from "../../components/AgentHeader";
import { AgentSidebar } from "../../components/AgentSidebar";
import { RealtimeIndicator } from "../../components/RealtimeIndicator";
import {
  Search, Phone, MessageCircle, Eye, X, FileText, DollarSign, Stethoscope,
  Plus, Send, User, Home, Briefcase, GraduationCap, Heart, ShieldCheck,
  Upload, CheckCircle2, Clock, AlertCircle, Filter, ChevronDown, MapPin, Calendar,
  Trash2, Image, File as FileIcon, CloudUpload, Paperclip, AlertTriangle, Timer, ChevronRight, MessageSquare, Link2, Check, ZoomIn, Download, RefreshCw, XCircle, History, ChevronUp
} from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useParams, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { Case, Payment, WORKFLOW_STAGES, getStageLabel, getStageNumber, DELAY_REASONS, getOverdueInfo, getDelayReasonLabel, reportDelay, LEAD_PIPELINE_STAGES, VISA_PIPELINE_STAGES, getPipelineStages, shouldAutoMigrateToVisa } from "../../lib/mockData";
import { ALL_COUNTRIES, POPULAR_COUNTRIES } from "../../constants/countries";
import { SearchableCountrySelect } from "../../components/SearchableCountrySelect";
import { pipelineApi } from "../../lib/api";
import { MandatoryDocumentChecklist } from "../../components/MandatoryDocumentChecklist";
import { modalVariants, staggerContainer, staggerItem } from "../../lib/animations";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { NotificationService } from "../../lib/notifications";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { sendCaseStatusEmail, extractEmailsFromCase } from "../../lib/emailService";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { AuditLogService } from "../../lib/auditLog";
import { DataSyncService } from "../../lib/dataSync";
import { useConflictPolling } from "../../lib/useConflictPolling";
import { useCrossTabRefresh } from "../../lib/useCrossTabRefresh";
import { pushCases } from "../../lib/syncService";
import { copyToClipboard } from "../../lib/clipboard";
import { DocumentFileStore } from "../../lib/documentStore";
import { VideoGenerator } from "../../components/visaverse";
import { ImageLightbox } from "../../components/ImageLightbox";
import { EditableCaseFields } from "../../components/EditableCaseFields";
import { LiveDocumentThumbnail } from "../../components/LiveDocumentThumbnail";
import { VisualTimelineStepper } from "../../components/VisualTimelineStepper";
import { documentUploadApi } from "../../lib/api";
import { createCase, updateCase, updateCaseStatus, addPayment, addNote } from "../../lib/caseApi";

// Agent-to-name mapping
const AGENT_MAP: Record<string, string> = {
  "AGENT-1": "Faizan",
  "AGENT-2": "Imran",
  "AGENT-3": "Safeer",
  "AGENT-4": "Aynee",
};

export function AgentCases() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const inputCls = `w-full px-4 py-3 sm:py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base sm:text-sm ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const labelCls = `block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`;

  // Get logged-in agent info
  const { profile } = useSupabaseAuth();
  const agentId = profile?.id || "AGENT-1";
  const agentName = profile?.full_name || AGENT_MAP[agentId] || "Agent";

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [activeTab, setActiveTab] = useState("info");
  const [linkCopied, setLinkCopied] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [selectedDelayReason, setSelectedDelayReason] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delayStep, setDelayStep] = useState<"reason" | "note">("reason");
  const [newPaymentAmount, setNewPaymentAmount] = useState(0);
  const [newPaymentMethod, setNewPaymentMethod] = useState("cash");
  const [newPaymentDesc, setNewPaymentDesc] = useState("");
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [deepLinked, setDeepLinked] = useState(false);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  // Cloud preview loading state for agent documents
  const [cloudPreviews, setCloudPreviews] = useState<Record<string, string | null>>({});
  const [loadingCloudIds, setLoadingCloudIds] = useState<Set<string>>(new Set());

  // Rejection modal state
  const [rejectModalDocId, setRejectModalDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Bulk selection state
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Document history expand state
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());

  // File upload state
  interface UploadedFile {
    id: string;
    file: File;
    preview: string;
    category: string;
  }
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time conflict polling — active when case detail modal is open
  const conflictState = useConflictPolling({
    entityId: selectedCase?.id || null,
    currentUserId: agentId,
    enabled: !!selectedCase,
    intervalMs: 5000,
  });

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_FILES = 10;
  const ALLOWED_TYPES = [
    "image/jpeg", "image/png",
    "application/pdf",
  ];
  const ALLOWED_EXTENSIONS = ".jpg,.jpeg,.png,.pdf";

  const DOC_CATEGORIES = [
    "Passport Copy", "CNIC Front", "CNIC Back", "Photos (4x6)",
    "Educational Cert", "Experience Letter", "Police Character Cert",
    "Medical Report", "Other",
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return Image;
    if (type === "application/pdf") return FileText;
    return FileIcon;
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = MAX_FILES - uploadedFiles.length;
    if (remaining <= 0) {
      toast.error(isUrdu ? `زیادہ سے زیادہ ${MAX_FILES} فائلز اپ لوڈ کی جا سکتی ہیں` : `Maximum ${MAX_FILES} files allowed`);
      return;
    }
    const toProcess = fileArray.slice(0, remaining);
    let added = 0;

    toProcess.forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(isUrdu ? `${file.name}: غیر معتبر فائل ٹائپ` : `${file.name}: Unsupported file type. Use JPG, PNG, or PDF only`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(isUrdu ? `${file.name}: فائل 5MB سے بڑی ہے` : `${file.name}: File exceeds 5MB limit`);
        return;
      }
      if (uploadedFiles.some((uf) => uf.file.name === file.name && uf.file.size === file.size)) {
        toast.error(isUrdu ? `${file.name} پہلے سے شامل ہے` : `${file.name} already added`);
        return;
      }

      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
      const newFile: UploadedFile = {
        id: `UF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        file,
        preview,
        category: "Other",
      };
      setUploadedFiles((prev) => [...prev, newFile]);
      added++;
    });

    if (added > 0) {
      toast.success(isUrdu ? `${added} فائل(ز) شامل ہو گئیں` : `${added} file(s) added successfully`);
    }
  }, [uploadedFiles, isUrdu]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== fileId);
    });
    toast.info(isUrdu ? "فائل ہٹا دی گئی" : "File removed");
  };

  const updateFileCategory = (fileId: string, category: string) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, category } : f))
    );
  };

  // New case form state
  const [newCase, setNewCase] = useState({
    customerName: "",
    fatherName: "",
    phone: "",
    email: "",
    cnic: "",
    passport: "",
    dateOfBirth: "",
    maritalStatus: "single" as Case["maritalStatus"],
    address: "",
    city: "Lahore",
    country: "Saudi Arabia",
    jobType: "Driver",
    jobDescription: "",
    education: "High School",
    experience: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "father",
    totalFee: 50000,
    priority: "medium" as Case["priority"],
    uploadedDocs: [] as string[],
  });

  // Load cases for this agent
  const loadCases = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error("Failed to load cases");
      console.error(error);
    } else {
      const all = (data || []).map((r: any) => mapSupabaseCaseToLocal(r));
      const agentCases = all.filter(
        (c) => c.agentName === agentName || c.agentId === agentId
      );
      setCases(agentCases);
    }
    setIsLoading(false);
  };

  // Auto-refresh when another tab modifies cases
  useCrossTabRefresh(["cases"], loadCases);

  useEffect(() => {
    loadCases();
    // Auto-refresh every 30s
    const interval = setInterval(loadCases, 30000);
    return () => clearInterval(interval);
  }, [agentName, agentId]);

  // Deep-link: auto-open case from URL param (/agent/cases/:caseId?tab=documents&from=notification) or legacy location.state
  const location = useLocation();
  const { caseId: urlCaseId } = useParams<{ caseId?: string }>();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const state = location.state as { openCaseId?: string; openTab?: string; fromNotification?: boolean } | null;
    const targetCaseId = urlCaseId || state?.openCaseId;
    const tab = searchParams.get("tab") || state?.openTab;
    const fromNotification = searchParams.get("from") === "notification" || state?.fromNotification;
    if (targetCaseId) {
      (async () => {
        const { data, error } = await supabase.from('cases').select('*').eq('id', targetCaseId).single();
        if (!error && data) {
          const target = mapSupabaseCaseToLocal(data);
          setSelectedCase(target);
          setActiveTab(tab || "info");
          if (fromNotification) {
            setDeepLinked(true);
            setTimeout(() => setDeepLinked(false), 3200);
            const tabLabel = tab ? ` → ${tab.charAt(0).toUpperCase() + tab.slice(1)}` : "";
            toast.success(`Opened ${target.id} (${target.customerName})${tabLabel}`);
          } else {
            toast.info(`Navigated to case ${target.id}`);
          }
        } else {
          toast.error(`Case ${targetCaseId} not found`);
        }
      })();
      // Clear query params and state so refresh doesn't re-open
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.state, urlCaseId, searchParams]);

  // Load cloud preview URLs when documents tab is open
  useEffect(() => {
    if (!selectedCase || activeTab !== "documents" || !selectedCase.documents?.length) return;
    let cancelled = false;
    const loadCloud = async () => {
      const toLoad: string[] = [];
      for (const doc of selectedCase.documents) {
        const stored = DocumentFileStore.getFile(doc.id);
        if (!stored || !stored.isCloudStored || !stored.mimeType?.startsWith("image/")) continue;
        if (cloudPreviews[doc.id] !== undefined) continue;
        if (DocumentFileStore.getPreviewUrl(doc.id)) continue;
        toLoad.push(doc.id);
      }
      if (toLoad.length === 0) return;
      setLoadingCloudIds(new Set(toLoad));
      const results: Record<string, string | null> = {};
      for (const docId of toLoad) {
        const url = await DocumentFileStore.getCloudPreviewUrl(docId);
        if (url) results[docId] = url;
      }
      if (!cancelled) {
        if (Object.keys(results).length > 0) setCloudPreviews(prev => ({ ...prev, ...results }));
        setLoadingCloudIds(new Set());
      }
    };
    loadCloud();
    return () => { cancelled = true; };
  }, [selectedCase?.id, activeTab]);

  // Download All documents helper
  const handleDownloadAll = useCallback(() => {
    if (!selectedCase?.documents?.length) return;
    let count = 0;
    for (const doc of selectedCase.documents) {
      if (DocumentFileStore.hasFile(doc.id)) {
        DocumentFileStore.downloadFile(doc.id);
        count++;
      }
    }
    if (count > 0) {
      toast.success(isUrdu ? `${count} فائلز ڈاؤن لوڈ شروع ہو گئیں` : `Downloading ${count} file${count > 1 ? "s" : ""}...`);
    } else {
      toast.error(isUrdu ? "ڈاؤن لوڈ کے لیے کوئی فائل نہیں" : "No files available to download");
    }
  }, [selectedCase, isUrdu]);

  // Document verification handler
  const handleDocVerification = useCallback(async (docId: string, newStatus: "verified" | "rejected", reason?: string) => {
    if (!selectedCase) return;
    const now = new Date().toISOString();
    const updatedDocs = (selectedCase.documents || []).map(d => {
      if (d.id !== docId) return d;
      const historyEntry = { action: newStatus, by: agentName, at: now, ...(reason ? { reason } : {}) };
      return {
        ...d,
        status: newStatus,
        verifiedBy: agentName,
        verifiedAt: now,
        ...(reason ? { rejectionReason: reason } : {}),
        verificationHistory: [...((d as any).verificationHistory || []), historyEntry],
      };
    });
    const docName = updatedDocs.find(d => d.id === docId)?.name || docId;
    const success = await updateCase(selectedCase.id, {
      documents: updatedDocs,
      timeline: [
        ...selectedCase.timeline,
        {
          id: `TL-${Date.now()}`,
          date: now,
          title: `Document ${newStatus} by agent`,
          description: `${agentName} ${newStatus} document: ${docName}${reason ? ` — Reason: ${reason}` : ""}`,
          type: "document" as const,
          user: agentName,
        },
      ],
    });
    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
      if (refreshed) setSelectedCase({ ...refreshed });
      toast.success(isUrdu
        ? (newStatus === "verified" ? "دستاویز کی تصدیق ہو گئی" : "دستاویز مسترد ہو گئی")
        : `Document ${newStatus} successfully`
      );
      AuditLogService.log({
        action: newStatus === "verified" ? "document_verified" : "document_rejected",
        entityType: "document",
        entityId: docId,
        userId: agentId,
        userName: agentName,
        details: `${agentName} ${newStatus} document ${docId} in case ${selectedCase.id}${reason ? ` — Reason: ${reason}` : ""}`,
      });
    }
  }, [selectedCase, agentId, agentName, isUrdu]);

  // Bulk verification handler
  const handleBulkVerification = useCallback(async (newStatus: "verified" | "rejected", reason?: string) => {
    if (!selectedCase || selectedDocIds.size === 0) return;
    const now = new Date().toISOString();
    const names: string[] = [];
    const updatedDocs = (selectedCase.documents || []).map(d => {
      if (!selectedDocIds.has(d.id) || d.status !== "pending") return d;
      names.push(d.name);
      const historyEntry = { action: newStatus, by: agentName, at: now, ...(reason ? { reason } : {}) };
      return {
        ...d,
        status: newStatus,
        verifiedBy: agentName,
        verifiedAt: now,
        ...(reason ? { rejectionReason: reason } : {}),
        verificationHistory: [...((d as any).verificationHistory || []), historyEntry],
      };
    });
    if (names.length === 0) { toast.error(isUrdu ? "کوئی زیر التوا دستاویز منتخب نہیں" : "No pending documents selected"); return; }
    const success = await updateCase(selectedCase.id, {
      documents: updatedDocs,
      timeline: [
        ...selectedCase.timeline,
        {
          id: `TL-${Date.now()}`,
          date: now,
          title: `Bulk ${newStatus}: ${names.length} document${names.length > 1 ? "s" : ""}`,
          description: `${agentName} ${newStatus} ${names.length} document(s): ${names.join(", ")}${reason ? ` — Reason: ${reason}` : ""}`,
          type: "document" as const,
          user: agentName,
        },
      ],
    });
    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
      if (refreshed) setSelectedCase({ ...refreshed });
      setSelectedDocIds(new Set());
      toast.success(isUrdu
        ? `${names.length} دستاویزات ${newStatus === "verified" ? "تصدیق" : "مسترد"} ہو گئیں`
        : `${names.length} document${names.length > 1 ? "s" : ""} ${newStatus}`
      );
      AuditLogService.log({
        action: newStatus === "verified" ? "document_verified" : "document_rejected",
        entityType: "document",
        entityId: Array.from(selectedDocIds).join(","),
        userId: agentId,
        userName: agentName,
        details: `${agentName} bulk ${newStatus} ${names.length} documents in case ${selectedCase.id}`,
      });
    }
  }, [selectedCase, selectedDocIds, agentId, agentName, isUrdu]);

  // Live countdown timer - refresh overdue labels every 60s
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-notify agent about their overdue cases
  useEffect(() => {
    const agentOverdue = cases.filter(c => getOverdueInfo(c).isOverdue);
    if (agentOverdue.length === 0) return;
    const AGENT_OVERDUE_KEY = `crm_agent_overdue_notified_${agentId}`;
    const notifiedRaw = localStorage.getItem(AGENT_OVERDUE_KEY);
    const notifiedIds: string[] = notifiedRaw ? JSON.parse(notifiedRaw) : [];
    const newlyOverdue = agentOverdue.filter(c => !notifiedIds.includes(c.id));
    if (newlyOverdue.length > 0) {
      newlyOverdue.forEach(c => {
        const oi = getOverdueInfo(c);
        NotificationService.addNotification({
          type: "deadline",
          priority: (oi.hoursOverdue && oi.hoursOverdue > 48) ? "critical" : "high",
          title: "Your Case is Overdue",
          titleUrdu: "آپ کا کیس تاخیر شدہ ہے",
          message: `Case ${c.id} (${c.customerName}) is ${oi.timeLabel} at stage ${getStageLabel(c.status)}`,
          messageUrdu: `کیس ${c.id} (${c.customerName}) ${oi.timeLabel} — مرحلہ: ${getStageLabel(c.status, true)}`,
          actionable: true,
          actionUrl: "/agent/cases",
          actionLabel: "View Case",
          targetRole: "agent",
          targetUserId: agentId,
          metadata: { caseId: c.id, overdueHours: oi.hoursOverdue },
        });
      });
      const updatedIds = [...notifiedIds, ...newlyOverdue.map(c => c.id)];
      localStorage.setItem(AGENT_OVERDUE_KEY, JSON.stringify(updatedIds.slice(-100)));
    }
  }, [cases, agentId]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesSearch =
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [cases, searchTerm, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: cases.length,
    active: cases.filter((c) => !["completed", "rejected"].includes(c.status)).length,
    completed: cases.filter((c) => c.status === "completed").length,
    revenue: cases.reduce((sum, c) => sum + c.paidAmount, 0),
    pending: cases.filter((c) => c.status === "document_collection" || c.status === "selection_call").length,
  }), [cases]);

  const getStatusColor = (status: string) => {
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

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700",
      medium: dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700",
      high: dc ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700",
      urgent: dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700",
    };
    return colors[priority] || colors.medium;
  };

  // ==================== HANDLERS ====================

  const resetNewCaseForm = () => {
    setNewCase({
      customerName: "", fatherName: "", phone: "", email: "", cnic: "", passport: "",
      dateOfBirth: "", maritalStatus: "single", address: "", city: "Lahore",
      country: "Saudi Arabia", jobType: "Driver", jobDescription: "", education: "High School",
      experience: "", emergencyContactName: "", emergencyContactPhone: "",
      emergencyContactRelation: "father", totalFee: 50000, priority: "medium", uploadedDocs: [],
    });
    setCurrentStep(1);
    // Clean up file previews
    uploadedFiles.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setUploadedFiles([]);
  };

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!newCase.customerName.trim()) { toast.error(isUrdu ? "نام ضروری ہے" : "Customer name is required"); return false; }
      if (!newCase.phone.trim()) { toast.error(isUrdu ? "فون نمبر ضروری ہے" : "Phone number is required"); return false; }
      if (newCase.phone.trim().length < 8) { toast.error(isUrdu ? "درست ��ون نمبر درج کریں" : "Please enter a valid phone number"); return false; }
      return true;
    }
    if (step === 2) {
      if (!newCase.country) { toast.error(isUrdu ? "ملک منتخب کریں" : "Please select a country"); return false; }
      if (!newCase.jobType) { toast.error(isUrdu ? "ملازمت کی قسم منتخب کریں" : "Please select a job type"); return false; }
      return true;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleCreateCase = async () => {
    if (!newCase.customerName.trim() || !newCase.phone.trim()) {
      toast.error(isUrdu ? "براہ کرم تمام مطلوبہ فیلڈز بھریں" : "Please fill all required fields (Name & Phone)");
      return;
    }
    if (newCase.totalFee <= 0) {
      toast.error(isUrdu ? "درست فیس درج کریں" : "Please enter a valid fee amount");
      return;
    }

    setIsLoading(true);
    const lt = toast.loading(isUrdu ? "نیا کیس بنایا جا رہا ہے..." : "Creating new case...");

    const created = await createCase({
      customerName: newCase.customerName.trim(),
      fatherName: newCase.fatherName.trim(),
      phone: newCase.phone.trim(),
      email: newCase.email.trim(),
      cnic: newCase.cnic.trim(),
      passport: newCase.passport.trim(),
      dateOfBirth: newCase.dateOfBirth,
      maritalStatus: newCase.maritalStatus,
      address: newCase.address.trim(),
      city: newCase.city,
      country: newCase.country,
      jobType: newCase.jobType,
      jobDescription: newCase.jobDescription.trim(),
      education: newCase.education,
      experience: newCase.experience.trim(),
      emergencyContact: {
        name: newCase.emergencyContactName.trim(),
        phone: newCase.emergencyContactPhone.trim(),
        relationship: newCase.emergencyContactRelation,
      },
      agentId: agentId,
      agentName: agentName,
      assignedStaffId: agentId,
      assignedStaffName: agentName,
      assignedAt: new Date().toISOString(),
      totalFee: newCase.totalFee,
      priority: newCase.priority,
      // Dual pipeline — new cases start in Lead Pipeline
      pipelineType: "lead" as const,
      pipelineStageKey: "new_lead",
      status: "new_lead",
      currentStage: 1,
      stageStartedAt: new Date().toISOString(),
      stageDeadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isOverdue: false,
      documentChecklist: {},
      documentChecklistFiles: {},
      documents: [
        // Checklist-marked documents
        ...newCase.uploadedDocs.map((doc, i) => ({
          id: `DOC-${Date.now()}-${i}`,
          name: doc,
          type: doc.toLowerCase().replace(/[^a-z]/g, "_"),
          uploadDate: new Date().toISOString(),
          status: "pending" as const,
          url: "#",
        })),
        // Actually uploaded files
        ...uploadedFiles.map((uf, i) => ({
          id: `DOC-UPLOAD-${Date.now()}-${i}`,
          name: `${uf.category}: ${uf.file.name}`,
          type: uf.file.type || "unknown",
          uploadDate: new Date().toISOString(),
          status: "pending" as const,
          url: uf.preview || "#",
          notes: `Size: ${formatFileSize(uf.file.size)} | Category: ${uf.category}`,
        })),
      ],
      timeline: [
        {
          id: `TL-${Date.now()}`,
          date: new Date().toISOString(),
          title: "Case Created",
          description: `New case created by agent ${agentName}`,
          type: "status" as const,
          user: agentName,
        },
      ],
    });

    toast.dismiss(lt);
    if (created) {
      toast.success(
        isUrdu
          ? `کیس ${created.id} کامیابی سے بنایا گیا!`
          : `Case ${created.id} created successfully!`
      );

      // Audit log: agent created case
      AuditLogService.logCaseCreated(agentName, "agent", created.id, newCase.customerName);
      DataSyncService.markModified(created.id, agentId, agentName, "agent");

      // Fire notifications for admin
      NotificationService.notifyCaseCreated(created.id, newCase.customerName, agentName);

      // Also notify admin specifically about agent-created case
      NotificationService.addNotification({
        type: "agent",
        priority: "medium",
        title: "Agent Created New Case",
        titleUrdu: "ایجنٹ نے نیا کیس بنایا",
        message: `${agentName} created case ${created.id} for ${newCase.customerName} (${newCase.country} - ${newCase.jobType}). Fee: PKR ${newCase.totalFee.toLocaleString()}`,
        messageUrdu: `${agentName} نے کیس ${created.id} بنایا - ${newCase.customerName} (${newCase.country} - ${newCase.jobType})۔ فیس: PKR ${newCase.totalFee.toLocaleString()}`,
        actionable: true,
        actionUrl: "/admin/cases",
        actionLabel: "View in Cases",
        targetRole: "admin",
      });

      setShowNewCaseModal(false);
      resetNewCaseForm();
      loadCases();
    } else {
      toast.error(isUrdu ? "کیس بنانے میں ناکامی" : "Failed to create case");
    }
    setIsLoading(false);
  };

  const handleRecordPayment = async () => {
    if (!selectedCase || newPaymentAmount <= 0) {
      toast.error(isUrdu ? "درست رقم درج کریں" : "Enter a valid amount");
      return;
    }

    setIsLoading(true);
    const receiptNumber = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
    const success = await addPayment(selectedCase.id, {
      amount: newPaymentAmount,
      method: newPaymentMethod as Payment["method"],
      date: new Date().toISOString(),
      receiptNumber,
      description: newPaymentDesc || `Payment collected by ${agentName}`,
      collectedBy: agentName,
      approvalStatus: "pending",
      submittedByRole: "agent",
    });

    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
      if (refreshed) setSelectedCase(refreshed);

      toast.success(
        isUrdu
          ? `PKR ${newPaymentAmount.toLocaleString()} جمع کرایا گیا! ایڈمن منظوری کا انتظار — رسید: ${receiptNumber}`
          : `PKR ${newPaymentAmount.toLocaleString()} submitted! Pending Admin Approval — Receipt: ${receiptNumber}`
      );

      AuditLogService.logPaymentAction(agentName, "agent", "payment_added", selectedCase.id, newPaymentAmount);
      DataSyncService.markModified(selectedCase.id, agentId, agentName, "agent");
      NotificationService.notifyPaymentPendingApproval(agentName, selectedCase.id, selectedCase.customerName, newPaymentAmount);

      setNewPaymentAmount(0);
      setNewPaymentMethod("cash");
      setNewPaymentDesc("");
      loadCases();
    } else {
      toast.error(isUrdu ? "ادائیگی ریکارڈ نہیں ہو سکی" : "Failed to record payment");
    }
    setIsLoading(false);
  };

  const handleAddNote = async () => {
    if (!selectedCase || !newNote.trim()) {
      toast.error(isUrdu ? "نوٹ درج کریں" : "Enter a note");
      return;
    }
    const success = await addNote(selectedCase.id, {
      text: newNote,
      author: agentName,
      date: new Date().toISOString(),
      important: false,
    });
    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
      if (refreshed) setSelectedCase(refreshed);
      AuditLogService.log({
        userId: agentId, userName: agentName, role: "agent",
        action: "note_added", category: "case",
        description: `Added note to case ${selectedCase.id}`,
        metadata: { caseId: selectedCase.id },
      });
      DataSyncService.markModified(selectedCase.id, agentId, agentName, "agent");
      toast.success(isUrdu ? "نوٹ شامل ہو گیا!" : "Note added!");
      setNewNote("");
      loadCases();
    } else {
      toast.error(isUrdu ? "نوٹ شامل نہیں ہو سکا" : "Failed to add note");
    }
  };

  const handleUpdateStatus = async (status: Case["status"]) => {
    if (!selectedCase) return;
    const old = selectedCase.status;

    // Use pipelineApi for stage advancement (server validates hard-locks)
    try {
      const res = await pipelineApi.advanceStage(selectedCase.id, status, agentId, agentName);
      if (!res.success) {
        // Show blockers if stage is locked
        if (res.blockers && Array.isArray(res.blockers)) {
          toast.error(isUrdu ? "مرحلہ مقفل ہے" : "Stage locked — requirements not met");
          res.blockers.forEach((b: string) => toast.error(b));
        } else {
          toast.error(res.error || "Stage update failed");
        }
        return;
      }
    } catch {
      // Fallback to local update if server unavailable
    }

    const success = await updateCaseStatus(selectedCase.id, status);
    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
      if (refreshed) setSelectedCase(refreshed);
      AuditLogService.logCaseStageChanged(agentName, "agent", selectedCase.id, old, status);
      DataSyncService.markModified(selectedCase.id, agentId, agentName, "agent");
      toast.success(isUrdu ? `حالت ${status} میں تبدیل ہو گئی` : `Status updated to ${status}`);
      NotificationService.notifyCaseStatusChanged(selectedCase.id, selectedCase.customerName, old, status);
      const { customerEmail, agentEmail } = extractEmailsFromCase(selectedCase);
      sendCaseStatusEmail({
        caseId: selectedCase.id,
        customerName: selectedCase.customerName,
        customerEmail,
        agentName: selectedCase.agentName,
        agentEmail,
        oldStatus: old,
        newStatus: status,
        phone: selectedCase.phone,
        country: selectedCase.country,
      });

      // Auto-migrate lead to visa pipeline when hitting "agreement"
      if (shouldAutoMigrateToVisa(status)) {
        try {
          await pipelineApi.migrateToVisa(selectedCase.id);
          toast.success(isUrdu ? "کیس خودکار طور پر ویزا پائپ لائن میں منتقل ہو گیا" : "Case auto-migrated to Visa Pipeline!");
        } catch (err) {
          console.error("Auto-migration failed:", err);
        }
      }

      loadCases();
    } else {
      toast.error(isUrdu ? "حالت اپڈیٹ نہیں ہو سکی" : "Failed to update status");
    }
  };

  const openDelayModal = () => {
    setSelectedDelayReason("");
    setDelayNote("");
    setDelayStep("reason");
    setShowDelayModal(true);
  };

  const handleReportDelay = () => {
    if (!selectedCase || !selectedDelayReason) {
      toast.error(isUrdu ? "براہ کرم تاخیر کی وجہ منتخب کریں" : "Please select a delay reason");
      return;
    }
    const updated = reportDelay(selectedCase.id, selectedDelayReason, delayNote || undefined);
    if (updated) {
      setSelectedCase(updated);
      AuditLogService.log({
        userId: agentId, userName: agentName, role: "agent",
        action: "case_updated", category: "case",
        description: `Reported delay for case ${selectedCase.id}: ${getDelayReasonLabel(selectedDelayReason)}`,
        metadata: { caseId: selectedCase.id, reason: selectedDelayReason, note: delayNote },
      });
      DataSyncService.markModified(selectedCase.id, agentId, agentName, "agent");
      toast.success(isUrdu ? "تاخیر کی وجہ محفوظ ہو گئی!" : `Delay reported: ${getDelayReasonLabel(selectedDelayReason)}`);
      setShowDelayModal(false);
      setSelectedDelayReason("");
      setDelayNote("");
      setDelayStep("reason");
      loadCases();
    }
  };

  // ==================== RENDER ====================

  const formSteps = [
    { num: 1, label: isUrdu ? "ذاتی" : "Personal", icon: User },
    { num: 2, label: isUrdu ? "ملازمت" : "Job Info", icon: Briefcase },
    { num: 3, label: isUrdu ? "دستاویزات" : "Docs & Fee", icon: FileText },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AgentSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AgentHeader />}

        <main className="p-3 sm:p-4 md:p-6">
          {/* Header with New Case button */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div>
              <h1 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>{t("agentCases.title")}</h1>
              <p className={sub}>{isUrdu ? `${agentName} - آپ کے تفویض کردہ کیسز` : `${agentName} - Your assigned cases`}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setShowNewCaseModal(true); resetNewCaseForm(); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl hover:from-blue-700 hover:to-indigo-600 transition-all shadow-lg hover:shadow-xl font-semibold min-h-[44px]"
            >
              <Plus className="w-5 h-5" />
              {isUrdu ? "نیا کیس بنائیں" : "New Case"}
            </motion.button>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: isUrdu ? "کل کیسز" : "Total Cases", value: stats.total, icon: FileText, color: "text-blue-600" },
              { label: isUrdu ? "فعال" : "Active", value: stats.active, icon: Clock, color: "text-orange-600" },
              { label: isUrdu ? "مکمل" : "Completed", value: stats.completed, icon: CheckCircle2, color: "text-green-600" },
              { label: isUrdu ? "آمدنی" : "Revenue", value: `PKR ${(stats.revenue / 1000).toFixed(0)}K`, icon: DollarSign, color: "text-blue-600" },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <motion.div key={idx} variants={staggerItem} whileHover={{ y: -4 }} className={`${card} rounded-2xl shadow-lg p-4 border ${brd}`}>
                  <Icon className={`w-7 h-7 ${stat.color} mb-2`} />
                  <h3 className={`text-xl md:text-2xl font-bold mb-0.5 ${txt}`}>{stat.value}</h3>
                  <p className={`text-xs ${sub}`}>{stat.label}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Search & Filters */}
          <div className={`${card} rounded-xl shadow-sm p-4 mb-6`}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isUrdu ? "نام، کیس آئی ڈی، فون سے تلاش کریں..." : "Search by name, case ID, phone..."}
                  className={`${inputCls} pl-10`}
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls} style={{ maxWidth: 200 }}>
                <option value="all">{isUrdu ? "تمام حالات" : "All Status"}</option>
                <optgroup label={isUrdu ? "لیڈ پائپ لائن" : "Lead Pipeline"}>
                  {LEAD_PIPELINE_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>{s.stageNumber > 0 ? `${s.stageNumber}. ` : ""}{isUrdu ? s.labelUrdu : s.label}</option>
                  ))}
                </optgroup>
                <optgroup label={isUrdu ? "ویزا پائپ لائن" : "Visa Pipeline"}>
                  {VISA_PIPELINE_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>{s.stageNumber > 0 ? `${s.stageNumber}. ` : ""}{isUrdu ? s.labelUrdu : s.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Cases Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* New Case Card - always first */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4, scale: 1.02 }}
              onClick={() => { setShowNewCaseModal(true); resetNewCaseForm(); }}
              className={`rounded-xl shadow-sm p-5 border-2 border-dashed cursor-pointer transition-all hover:shadow-md flex flex-col items-center justify-center min-h-[220px] ${dc ? "border-blue-700 bg-blue-900/10 hover:bg-blue-900/20" : "border-blue-300 bg-blue-50/50 hover:bg-blue-50"}`}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${dc ? "bg-blue-800/50" : "bg-blue-100"}`}>
                <Plus className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className={`font-semibold mb-1 ${dc ? "text-blue-400" : "text-blue-700"}`}>
                {isUrdu ? "نیا کیس بنائیں" : "Create New Case"}
              </h3>
              <p className={`text-xs text-center ${dc ? "text-blue-500/70" : "text-blue-600/70"}`}>
                {isUrdu ? "نئے کسٹمر کا کیس رجسٹر کریں" : "Register a new customer case"}
              </p>
            </motion.div>

            {filteredCases.map((c, idx) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                whileHover={{ y: -4 }}
                className={`${card} rounded-xl shadow-sm p-4 md:p-5 hover:shadow-md transition-all border ${brd}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {c.customerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold truncate ${txt}`}>{c.customerName}</h3>
                    <p className={`text-xs font-mono ${sub}`}>{c.id}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getPriorityColor(c.priority)}`}>{c.priority}</span>
                </div>

                <div className={`flex items-center gap-2 text-sm ${sub} mb-2`}>
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{c.country}</span>
                  <span>-</span>
                  <span>{c.jobType}</span>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(c.status)}`}>{getStageLabel(c.status, isUrdu)}</span>
                  {(() => {
                    const oi = getOverdueInfo(c);
                    if (oi.isOverdue) return (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-[10px] font-bold">{oi.timeLabel}</span>
                      </motion.span>
                    );
                    if (oi.hasDeadline && oi.hoursRemaining !== null && oi.hoursRemaining < 6) return (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
                        <Timer className="w-3 h-3" />
                        <span className="text-[10px] font-semibold">{oi.timeLabel}</span>
                      </span>
                    );
                    return null;
                  })()}
                  <span className={`text-xs ${sub}`}>{new Date(c.createdDate).toLocaleDateString()}</span>
                </div>

                {/* Payment bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className={sub}>{isUrdu ? "ادائیگی" : "Payment"}</span>
                    <span className={txt}>PKR {c.paidAmount.toLocaleString()} / {c.totalFee.toLocaleString()}</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min((c.paidAmount / c.totalFee) * 100, 100)}%` }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setSelectedCase(c); setActiveTab("info"); setSelectedDocIds(new Set()); setExpandedHistoryIds(new Set()); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] border rounded-lg text-sm ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                    <Eye className="w-4 h-4" /> {isUrdu ? "دیکھیں" : "View"}
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { window.open(`tel:${c.phone}`); toast.info(`${isUrdu ? "کال کر رہے ہیں" : "Calling"} ${c.customerName}`); }}
                    className={`px-3 py-2.5 min-h-[44px] border rounded-lg ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                    <Phone className="w-4 h-4" />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { window.open(`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`); toast.info(`WhatsApp: ${c.customerName}`); }}
                    className="px-3 py-2.5 min-h-[44px] bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <MessageCircle className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredCases.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center py-12 ${card} rounded-xl shadow-sm mt-4`}>
              <AlertCircle className={`w-12 h-12 mx-auto mb-3 ${sub}`} />
              <p className={sub}>{isUrdu ? "کوئی کیس نہیں ملا" : "No cases found matching your criteria"}</p>
            </motion.div>
          )}
        </main>
      </div>

      {/* ========== NEW CASE MODAL (Multi-step) ========== */}
      <AnimatePresence>
        {showNewCaseModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowNewCaseModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()} className={`${dc ? "bg-gray-800" : "bg-white"} sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto`}>

              {/* Header */}
              <div className={`flex items-center justify-between p-4 sm:p-6 border-b sticky top-0 z-10 ${dc ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"} sm:rounded-t-2xl`}>
                <div>
                  <h2 className={`text-xl font-bold ${txt}`}>{isUrdu ? "نیا کیس بنائیں" : "Create New Case"}</h2>
                  <p className={`text-sm ${sub}`}>{isUrdu ? `ایجنٹ: ${agentName}` : `Agent: ${agentName}`}</p>
                </div>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowNewCaseModal(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Step Indicator */}
              <div className={`px-6 py-4 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <div className="flex items-center justify-between">
                  {formSteps.map((step, idx) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.num;
                    const isDone = currentStep > step.num;
                    return (
                      <div key={step.num} className="flex items-center gap-2 flex-1">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          onClick={() => { if (isDone || isActive) setCurrentStep(step.num); }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                            isActive ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            isDone ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            dc ? "text-gray-500" : "text-gray-400"
                          }`}
                        >
                          {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                          <span className="text-sm font-medium">{step.label}</span>
                        </motion.button>
                        {idx < formSteps.length - 1 && <div className={`flex-1 h-0.5 mx-2 rounded ${isDone ? "bg-blue-400" : dc ? "bg-gray-600" : "bg-gray-200"}`} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-5">
                <AnimatePresence mode="wait">
                  {/* Step 1: Personal Information */}
                  {currentStep === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-5 h-5 text-blue-600" />
                        <h3 className={`font-semibold ${txt}`}>{isUrdu ? "ذاتی معلومات" : "Personal Information"}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>{isUrdu ? "نام *" : "Full Name *"}</label>
                          <input type="text" value={newCase.customerName} onChange={(e) => setNewCase({ ...newCase, customerName: e.target.value })} className={inputCls} placeholder={isUrdu ? "مکمل نام" : "Customer full name"} />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "والد کا نام" : "Father's Name"}</label>
                          <input type="text" value={newCase.fatherName} onChange={(e) => setNewCase({ ...newCase, fatherName: e.target.value })} className={inputCls} placeholder={isUrdu ? "والد کا نام" : "Father's name"} />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "فون نمبر *" : "Phone Number *"}</label>
                          <input type="tel" value={newCase.phone} onChange={(e) => setNewCase({ ...newCase, phone: e.target.value })} className={inputCls} placeholder="+92 3XX XXXXXXX" />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "ای میل" : "Email"}</label>
                          <input type="email" value={newCase.email} onChange={(e) => setNewCase({ ...newCase, email: e.target.value })} className={inputCls} placeholder="email@example.com" />
                        </div>
                        <div>
                          <label className={labelCls}>CNIC</label>
                          <input type="text" value={newCase.cnic} onChange={(e) => setNewCase({ ...newCase, cnic: e.target.value })} className={inputCls} placeholder="XXXXX-XXXXXXX-X" />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "پاسپورٹ" : "Passport"}</label>
                          <input type="text" value={newCase.passport} onChange={(e) => setNewCase({ ...newCase, passport: e.target.value })} className={inputCls} placeholder="e.g. AB1234567" />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "تاریخ پیدائش" : "Date of Birth"}</label>
                          <input type="date" value={newCase.dateOfBirth} onChange={(e) => setNewCase({ ...newCase, dateOfBirth: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "ازدواجی حیثیت" : "Marital Status"}</label>
                          <select value={newCase.maritalStatus} onChange={(e) => setNewCase({ ...newCase, maritalStatus: e.target.value as Case["maritalStatus"] })} className={inputCls}>
                            {[["single", "Single"], ["married", "Married"], ["divorced", "Divorced"], ["widowed", "Widowed"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Address */}
                      <div className="flex items-center gap-2 mb-1 pt-2">
                        <Home className="w-5 h-5 text-blue-600" />
                        <h3 className={`font-semibold ${txt}`}>{isUrdu ? "پتہ" : "Address"}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className={labelCls}>{isUrdu ? "مکمل پتہ" : "Full Address"}</label>
                          <input type="text" value={newCase.address} onChange={(e) => setNewCase({ ...newCase, address: e.target.value })} className={inputCls} placeholder={isUrdu ? "مکان، گلی، علاقہ" : "House #, Street, Area"} />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "شہر" : "City"}</label>
                          <select value={newCase.city} onChange={(e) => setNewCase({ ...newCase, city: e.target.value })} className={inputCls}>
                            {["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Other"].map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Job & Destination */}
                  {currentStep === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                        <h3 className={`font-semibold ${txt}`}>{isUrdu ? "ملازمت اور منزل" : "Job & Destination"}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <SearchableCountrySelect value={newCase.country} onChange={(v) => setNewCase({ ...newCase, country: v })} label="Destination Country *" labelUrdu="منزل ملک *" darkMode={dc} isUrdu={isUrdu} />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "نوکری کی قسم *" : "Job Type *"}</label>
                          <select value={newCase.jobType} onChange={(e) => setNewCase({ ...newCase, jobType: e.target.value })} className={inputCls}>
                            {["Driver", "Construction Worker", "Hospitality", "Healthcare", "Security Guard", "Factory Worker", "Cleaner", "Electrician", "Plumber", "Mechanic", "Other"].map((j) => <option key={j} value={j}>{j}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>{isUrdu ? "نوکری کی تفصیل / مہارت" : "Job Description / Skills"}</label>
                          <textarea value={newCase.jobDescription} onChange={(e) => setNewCase({ ...newCase, jobDescription: e.target.value })} className={`${inputCls} min-h-[70px]`} placeholder={isUrdu ? "متعلقہ مہارتیں اور تجربہ بیان کریں..." : "Describe relevant skills and experience..."} />
                        </div>
                      </div>

                      {/* Education */}
                      <div className="flex items-center gap-2 mb-1 pt-2">
                        <GraduationCap className="w-5 h-5 text-blue-600" />
                        <h3 className={`font-semibold ${txt}`}>{isUrdu ? "تعلیم اور تجربہ" : "Education & Experience"}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>{isUrdu ? "تعلیم" : "Education Level"}</label>
                          <select value={newCase.education} onChange={(e) => setNewCase({ ...newCase, education: e.target.value })} className={inputCls}>
                            {["Primary", "Middle", "High School", "Intermediate", "Graduate", "Postgraduate", "Technical/Diploma", "None"].map((ed) => <option key={ed} value={ed}>{ed}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "تجربہ" : "Work Experience"}</label>
                          <input type="text" value={newCase.experience} onChange={(e) => setNewCase({ ...newCase, experience: e.target.value })} className={inputCls} placeholder={isUrdu ? "مثلاً 5 سال ڈرائیونگ" : "e.g. 5 years driving"} />
                        </div>
                      </div>

                      {/* Emergency Contact */}
                      <div className="flex items-center gap-2 mb-1 pt-2">
                        <Heart className="w-5 h-5 text-red-500" />
                        <h3 className={`font-semibold ${txt}`}>{isUrdu ? "ہنگامی رابطہ" : "Emergency Contact"}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={labelCls}>{isUrdu ? "نام" : "Contact Name"}</label>
                          <input type="text" value={newCase.emergencyContactName} onChange={(e) => setNewCase({ ...newCase, emergencyContactName: e.target.value })} className={inputCls} placeholder={isUrdu ? "نام" : "Name"} />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "فون" : "Contact Phone"}</label>
                          <input type="tel" value={newCase.emergencyContactPhone} onChange={(e) => setNewCase({ ...newCase, emergencyContactPhone: e.target.value })} className={inputCls} placeholder="+92 3XX XXXXXXX" />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "رشتہ" : "Relationship"}</label>
                          <select value={newCase.emergencyContactRelation} onChange={(e) => setNewCase({ ...newCase, emergencyContactRelation: e.target.value })} className={inputCls}>
                            {[["father", "Father"], ["mother", "Mother"], ["spouse", "Spouse"], ["brother", "Brother"], ["sister", "Sister"], ["friend", "Friend"], ["other", "Other"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Documents & Fee */}
                  {currentStep === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                      {/* Documents Checklist */}
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        <h3 className={`font-semibold ${txt}`}>{isUrdu ? "دستاویزات چیک لسٹ" : "Documents Checklist"}</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {["Passport Copy", "CNIC Front", "CNIC Back", "Photos (4x6)", "Educational Cert", "Experience Letter", "Police Character Cert"].map((doc) => {
                          const isSel = newCase.uploadedDocs.includes(doc);
                          return (
                            <motion.button key={doc} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => {
                              if (isSel) setNewCase({ ...newCase, uploadedDocs: newCase.uploadedDocs.filter(d => d !== doc) });
                              else { setNewCase({ ...newCase, uploadedDocs: [...newCase.uploadedDocs, doc] }); toast.success(`${doc} ${isUrdu ? "نشان زد" : "marked"}`); }
                            }} className={`p-3 rounded-xl border-2 text-left transition-all ${isSel ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : dc ? "border-gray-600 hover:border-gray-500" : "border-gray-200 hover:border-gray-300"}`}>
                              <div className="flex items-center gap-2">
                                {isSel ? <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" /> : <FileText className={`w-4 h-4 flex-shrink-0 ${sub}`} />}
                                <span className={`text-xs font-medium ${isSel ? "text-blue-700 dark:text-blue-400" : sub}`}>{doc}</span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* File Upload Zone */}
                      <div className="flex items-center gap-2 mb-1 pt-2">
                        <CloudUpload className="w-5 h-5 text-blue-600" />
                        <h3 className={`font-semibold ${txt}`}>{isUrdu ? "فائلز اپ لوڈ کریں" : "Upload Files"}</h3>
                        <span className={`text-xs ${sub} ml-auto`}>{uploadedFiles.length}/{MAX_FILES}</span>
                      </div>

                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ALLOWED_EXTENSIONS}
                        onChange={handleFileSelect}
                        className="hidden"
                      />

                      {/* Drag & Drop Zone */}
                      <motion.div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                          isDragOver
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]"
                            : dc
                            ? "border-gray-600 hover:border-blue-600 hover:bg-gray-700/30"
                            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/30"
                        }`}
                      >
                        <motion.div
                          animate={isDragOver ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <CloudUpload className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? "text-blue-500" : sub}`} />
                          <p className={`text-sm font-medium mb-1 ${isDragOver ? (dc ? "text-blue-400" : "text-blue-700") : txt}`}>
                            {isDragOver
                              ? (isUrdu ? "فائلز یہاں چھوڑیں" : "Drop files here")
                              : (isUrdu ? "فائلز یہاں ڈریگ کریں یا کلک کریں" : "Drag & drop files here, or click to browse")}
                          </p>
                          <p className={`text-xs ${sub}`}>
                            {isUrdu ? "صرف JPG, PNG, PDF — زیادہ سے زیادہ 5MB فی فائل" : "JPG, PNG, PDF only — Max 5MB per file"}
                          </p>
                        </motion.div>
                      </motion.div>

                      {/* Uploaded Files List */}
                      <AnimatePresence>
                        {uploadedFiles.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2"
                          >
                            {uploadedFiles.map((uf) => {
                              const Icon = getFileIcon(uf.file.type);
                              return (
                                <motion.div
                                  key={uf.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 20, height: 0 }}
                                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${dc ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"}`}
                                >
                                  {/* Thumbnail / Icon */}
                                  {uf.preview ? (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600 cursor-pointer hover:ring-2 hover:ring-blue-500 transition"
                                      onClick={() => { setLightboxSrc(uf.preview); setLightboxAlt(uf.file.name); }}>
                                      <img src={uf.preview} alt={uf.file.name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                                      <Icon className={`w-6 h-6 ${uf.file.type === "application/pdf" ? "text-red-500" : sub}`} />
                                    </div>
                                  )}

                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${txt}`}>{uf.file.name}</p>
                                    <p className={`text-xs ${sub}`}>{formatFileSize(uf.file.size)}</p>
                                  </div>

                                  {/* Category Selector */}
                                  <select
                                    value={uf.category}
                                    onChange={(e) => updateFileCategory(uf.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`text-xs px-2 py-1.5 rounded-lg border flex-shrink-0 max-w-[120px] ${dc ? "bg-gray-600 border-gray-500 text-gray-200" : "bg-white border-gray-300 text-gray-700"}`}
                                  >
                                    {DOC_CATEGORIES.map((cat) => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>

                                  {/* Remove */}
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => removeFile(uf.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </motion.button>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {uploadedFiles.length > 0 && (
                        <div className={`flex items-center gap-2 text-xs ${sub}`}>
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>
                            {isUrdu
                              ? `${uploadedFiles.length} فائل(ز) شامل — کل سائز: ${formatFileSize(uploadedFiles.reduce((sum, f) => sum + f.file.size, 0))}`
                              : `${uploadedFiles.length} file(s) attached — Total: ${formatFileSize(uploadedFiles.reduce((sum, f) => sum + f.file.size, 0))}`}
                          </span>
                        </div>
                      )}

                      {/* Case Settings */}
                      <div className="flex items-center gap-2 mb-1 pt-2">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                        <h3 className={`font-semibold ${txt}`}>{isUrdu ? "کیس ترتیبات" : "Case Settings"}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>{isUrdu ? "کل فیس (PKR) *" : "Total Fee (PKR) *"}</label>
                          <input type="number" value={newCase.totalFee} onChange={(e) => setNewCase({ ...newCase, totalFee: Number(e.target.value) })} className={inputCls} min={0} />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "ترجیح" : "Priority"}</label>
                          <select value={newCase.priority} onChange={(e) => setNewCase({ ...newCase, priority: e.target.value as Case["priority"] })} className={inputCls}>
                            {[["low", isUrdu ? "کم" : "Low"], ["medium", isUrdu ? "درمیانی" : "Medium"], ["high", isUrdu ? "زیادہ" : "High"], ["urgent", isUrdu ? "فوری" : "Urgent"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Preview Summary */}
                      <div className={`p-4 rounded-xl border ${dc ? "border-blue-800 bg-blue-900/10" : "border-blue-200 bg-blue-50"}`}>
                        <h4 className={`text-sm font-semibold mb-2 ${dc ? "text-blue-400" : "text-blue-700"}`}>{isUrdu ? "خلاصہ" : "Summary"}</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className={sub}>{isUrdu ? "نام:" : "Name:"}</span> <span className={`font-semibold ${txt}`}>{newCase.customerName || "-"}</span></div>
                          <div><span className={sub}>{isUrdu ? "فون:" : "Phone:"}</span> <span className={`font-semibold ${txt}`}>{newCase.phone || "-"}</span></div>
                          <div><span className={sub}>{isUrdu ? "ملک:" : "Country:"}</span> <span className={`font-semibold ${txt}`}>{newCase.country}</span></div>
                          <div><span className={sub}>{isUrdu ? "نوکری:" : "Job:"}</span> <span className={`font-semibold ${txt}`}>{newCase.jobType}</span></div>
                          <div><span className={sub}>{isUrdu ? "فیس:" : "Fee:"}</span> <span className="font-semibold text-blue-600">PKR {newCase.totalFee.toLocaleString()}</span></div>
                          <div><span className={sub}>{isUrdu ? "ایجنٹ:" : "Agent:"}</span> <span className={`font-semibold ${txt}`}>{agentName}</span></div>
                          <div><span className={sub}>{isUrdu ? "چیک لسٹ:" : "Checklist:"}</span> <span className={`font-semibold ${txt}`}>{newCase.uploadedDocs.length} {isUrdu ? "نشان زد" : "marked"}</span></div>
                          <div><span className={sub}>{isUrdu ? "فائلز:" : "Files:"}</span> <span className={`font-semibold ${txt}`}>{uploadedFiles.length} {isUrdu ? "اپ لوڈ" : "uploaded"}</span></div>
                          <div><span className={sub}>{isUrdu ? "ترجیح:" : "Priority:"}</span> <span className={`font-semibold ${txt}`}>{newCase.priority}</span></div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer Buttons */}
              <div className={`flex gap-3 p-6 border-t sticky bottom-0 rounded-b-2xl ${dc ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
                {currentStep > 1 && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setCurrentStep(currentStep - 1)}
                    className={`px-5 py-3 rounded-xl border font-medium ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                    {isUrdu ? "واپس" : "Back"}
                  </motion.button>
                )}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowNewCaseModal(false)}
                  className={`px-5 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                  {isUrdu ? "منسوخ" : "Cancel"}
                </motion.button>
                <div className="flex-1" />
                {currentStep < 3 ? (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleNextStep}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow-lg">
                    {isUrdu ? "اگلا" : "Next"} &rarr;
                  </motion.button>
                ) : (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCreateCase} disabled={isLoading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl hover:from-blue-700 hover:to-indigo-600 disabled:opacity-50 font-semibold shadow-lg">
                    {isLoading ? (isUrdu ? "بنایا جا رہا ہے..." : "Creating...") : (isUrdu ? "کیس بنائیں" : "Create Case")}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== CASE DETAIL MODAL ========== */}
      <AnimatePresence>
        {selectedCase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={() => setSelectedCase(null)}>
            <motion.div
              variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto ${deepLinked ? "animate-notif-ring" : ""}`}
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
              <div className={`flex items-center justify-between p-6 border-b sticky top-0 z-10 ${dc ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                <div>
                  <h2 className={`text-xl font-bold ${txt}`}>{selectedCase.customerName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-sm font-mono ${sub}`}>{selectedCase.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(selectedCase.status)}`}>{getStageLabel(selectedCase.status, isUrdu)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getPriorityColor(selectedCase.priority)}`}>{selectedCase.priority}</span>
                    <RealtimeIndicator caseId={selectedCase.id} onRefresh={async () => {
                      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                      if (data) {
                        setSelectedCase(mapSupabaseCaseToLocal(data, profile));
                        toast.success(isUrdu ? "کیس تازہ ترین ہو گیا" : "Case refreshed");
                      }
                    }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { const url = `${window.location.origin}/agent/cases/${selectedCase.id}`; copyToClipboard(url).then(() => { setLinkCopied(true); toast.success(isUrdu ? "لنک کاپی ہو گیا!" : `Link copied: ${selectedCase.id}`); setTimeout(() => setLinkCopied(false), 2000); }).catch(() => {}); }} className={`p-2 rounded-lg transition-colors ${linkCopied ? "text-green-500 bg-green-50 dark:bg-green-900/20" : dc ? "text-gray-400 hover:bg-gray-700 hover:text-blue-400" : "text-gray-400 hover:bg-blue-50 hover:text-blue-600"}`} title={isUrdu ? "لنک کاپی" : "Copy Link"}>{linkCopied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}</motion.button>
                  <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setSelectedCase(null)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X className="w-5 h-5" /></motion.button>
                </div>
              </div>

              {/* Conflict Warning Banner — Real-time Polling */}
              <AnimatePresence>
                {conflictState.hasConflict && conflictState.record && !conflictState.dismissed && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className={`mx-6 mt-3 p-3 rounded-xl border flex items-start gap-3 ${dc ? "bg-amber-900/20 border-amber-700/50 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"}`}
                  >
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{isUrdu ? "ڈیٹا کہیں اور اپ ڈیٹ ہوا!" : "Data Updated Elsewhere!"}</p>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded ${dc ? "bg-amber-800/40 text-amber-400" : "bg-amber-200/60 text-amber-700"}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          LIVE
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${dc ? "text-amber-400/80" : "text-amber-700"}`}>
                        {isUrdu
                          ? `${conflictState.record.lastModifiedByName} (${conflictState.record.lastModifiedByRole}) نے اس کیس میں تبدیلی کی — ${conflictState.timeSince}`
                          : `${conflictState.record.lastModifiedByName} (${conflictState.record.lastModifiedByRole}) modified this case ${conflictState.timeSince}`}
                      </p>
                      {conflictState.record.changeDescription && (
                        <p className={`text-[10px] mt-1 italic ${dc ? "text-amber-500/70" : "text-amber-600"}`}>{conflictState.record.changeDescription}</p>
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
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${dc ? "bg-amber-800/50 text-amber-300 hover:bg-amber-700/60" : "bg-amber-100 text-amber-800 hover:bg-amber-200"}`}>
                        {isUrdu ? "ریفریش" : "Refresh"}
                      </button>
                      <button onClick={conflictState.dismiss}
                        className={`px-2.5 py-1 rounded-lg text-[10px] ${dc ? "text-gray-500 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"}`}>
                        {isUrdu ? "بند" : "Dismiss"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Last modified indicator (when no active conflict) */}
              {!conflictState.hasConflict && (() => {
                const lastMod = DataSyncService.getLastModifier(selectedCase.id);
                if (lastMod && lastMod.lastModifiedBy !== agentId) {
                  return (
                    <div className={`mx-6 mt-2 flex items-center gap-1.5 text-[10px] ${dc ? "text-gray-500" : "text-gray-400"}`}>
                      <Clock className="w-3 h-3" />
                      {isUrdu
                        ? `آخری تبدیلی: ${lastMod.lastModifiedByName} (${lastMod.lastModifiedByRole})`
                        : `Last updated by ${lastMod.lastModifiedByName} (${lastMod.lastModifiedByRole})`}
                    </div>
                  );
                }
                return null;
              })()}

              <div className={`flex border-b px-6 overflow-x-auto ${dc ? "border-gray-700" : "border-gray-200"}`}>
                {[
                  { id: "info", label: isUrdu ? "معلومات" : "Info", icon: FileText },
                  { id: "timeline", label: isUrdu ? "ٹائم لائن" : "Timeline", icon: Timer },
                  { id: "documents", label: isUrdu ? "دستاویزات" : "Documents", icon: Paperclip },
                  { id: "payments", label: isUrdu ? "ادائیگی جمع" : "Submit Payment", icon: DollarSign },
                  { id: "medical", label: isUrdu ? "میڈیکل" : "Medical", icon: Stethoscope },
                  { id: "notes", label: isUrdu ? "نوٹس" : "Notes", icon: Send },
                  { id: "video", label: isUrdu ? "ویڈیو" : "Video", icon: MessageSquare },
                  { id: "status", label: isUrdu ? "حالت" : "Status", icon: Clock },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${activeTab === tab.id ? "border-blue-500 text-blue-600" : `border-transparent ${sub}`}`}><Icon className="w-4 h-4" />{tab.label}</button>
                  );
                })}
              </div>

              <div className="p-6">
                {activeTab === "info" && (
                  <EditableCaseFields
                    caseData={selectedCase}
                    darkMode={dc}
                    isUrdu={isUrdu}
                    userName={agentName}
                    userRole="agent"
                    compact
                    onUpdate={(updated) => {
                      setSelectedCase(updated);
                      loadCases();
                    }}
                  />
                )}

                {activeTab === "timeline" && selectedCase && (
                  <VisualTimelineStepper
                    caseData={selectedCase}
                  />
                )}

                {activeTab === "documents" && (
                  <div className="space-y-4">
                    {/* Mandatory Document Verification Checklist */}
                    {selectedCase.pipelineType === "visa" && (
                      <MandatoryDocumentChecklist
                        caseId={selectedCase.id}
                        caseData={selectedCase}
                        darkMode={dc}
                        isUrdu={isUrdu}
                        userRole="agent"
                        userName={agentName}
                        userId={agentId}
                        onUpdate={async () => {
                          await loadCases();
                          const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                          const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
                          if (refreshed) setSelectedCase(refreshed);
                        }}
                      />
                    )}

                    {/* Privacy notice — agents cannot view existing documents */}
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${dc ? "bg-amber-900/20 border-amber-700/30" : "bg-amber-50 border-amber-200"}`}
                    >
                      <ShieldCheck className={`w-5 h-5 mt-0.5 flex-shrink-0 ${dc ? "text-amber-400" : "text-amber-600"}`} />
                      <div>
                        <p className={`text-sm font-semibold ${dc ? "text-amber-300" : "text-amber-800"}`}>
                          {isUrdu ? "سیکیورٹی پالیسی" : "Security Policy"}
                        </p>
                        <p className={`text-xs mt-0.5 ${dc ? "text-amber-400/80" : "text-amber-700/80"}`}>
                          {isUrdu
                            ? "موجودہ دستاویزات دیکھنے کی اجازت نہیں۔ آپ صرف نئی دستاویزات اپ لوڈ کر سکتے ہیں جو ایڈمن کی منظوری کے لیے قطار میں جائیں گی۔"
                            : "You do not have access to view existing documents. You may only upload new documents, which will enter a queue for Admin approval."}
                        </p>
                      </div>
                    </motion.div>

                    {/* Upload New Documents */}
                    <div>
                      <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${txt}`}>
                        <CloudUpload className="w-4 h-4 text-blue-500" />
                        {isUrdu ? "نئی دستاویزات اپ لوڈ کریں" : "Upload New Documents"}
                      </h4>

                      {/* Drop zone */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ALLOWED_EXTENSIONS}
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <motion.div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        animate={isDragOver ? { scale: 1.02 } : { scale: 1 }}
                        className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                          isDragOver
                            ? "border-blue-500 bg-blue-500/10"
                            : dc
                            ? "border-gray-600 hover:border-gray-500 hover:bg-gray-700/30"
                            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                        }`}
                      >
                        <CloudUpload className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? "text-blue-500" : sub}`} />
                        <p className={`text-sm font-medium mb-1 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                          {isDragOver
                            ? (isUrdu ? "یہاں چھوڑیں" : "Drop files here")
                            : (isUrdu ? "فائلز ڈریگ کریں یا کلک کریں" : "Drag & drop files or click to browse")}
                        </p>
                        <p className={`text-xs ${sub}`}>
                          JPG, PNG, PDF | Max 5MB | {isUrdu ? "زیادہ سے زیادہ" : "Up to"} {MAX_FILES} {isUrdu ? "فائلز" : "files"}
                        </p>
                      </motion.div>
                    </div>

                    {/* Staged files ready to upload */}
                    <AnimatePresence mode="popLayout">
                      {uploadedFiles.map((file) => {
                        const FIcon = getFileIcon(file.file.type);
                        return (
                          <motion.div
                            key={file.id}
                            layout
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -80 }}
                            className={`flex items-center gap-3 p-3 rounded-xl border ${dc ? "bg-gray-700/30 border-gray-600" : "bg-gray-50 border-gray-100"}`}
                          >
                            {file.preview ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-500 transition"
                                onClick={() => { setLightboxSrc(file.preview); setLightboxAlt(file.file.name); }}>
                                <img src={file.preview} alt="" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                                <FIcon className={`w-5 h-5 ${sub}`} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${txt}`}>{file.file.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs ${sub}`}>{formatFileSize(file.file.size)}</span>
                                <select
                                  value={file.category}
                                  onChange={(e) => updateFileCategory(file.id, e.target.value)}
                                  className={`text-xs px-2 py-0.5 rounded-lg border ${dc ? "bg-gray-600 border-gray-500 text-gray-300" : "bg-white border-gray-200 text-gray-700"}`}
                                >
                                  {DOC_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => removeFile(file.id)}
                              className={`p-1.5 rounded-lg ${dc ? "hover:bg-red-900/30 text-gray-400 hover:text-red-400" : "hover:bg-red-50 text-gray-400 hover:text-red-500"}`}
                            >
                              <X className="w-4 h-4" />
                            </motion.button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {/* Submit Upload Button */}
                    {uploadedFiles.length > 0 && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          if (!selectedCase) return;
                          const lt = toast.loading(isUrdu ? "اپ لوڈ ہو رہا ہے..." : "Uploading documents...");
                          const newDocs: any[] = [];
                          for (const uf of uploadedFiles) {
                            const docId = `DOC-UPLOAD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                            let storagePath: string | undefined;
                            try {
                              const uploadRes = await documentUploadApi.uploadForm(uf.file, selectedCase.id, docId, {
                                checklistKey: uf.category, uploadedBy: agentName, uploadedByRole: "agent",
                              });
                              if (uploadRes.success && uploadRes.data?.storagePath) storagePath = uploadRes.data.storagePath;
                            } catch { await DocumentFileStore.storeFile(docId, uf.file, agentName); }
                            newDocs.push({
                              id: docId,
                              name: `${uf.category}: ${uf.file.name}`,
                              type: uf.file.type || "unknown",
                              uploadDate: new Date().toISOString(),
                              status: "pending" as const,
                              url: "#",
                              storagePath: storagePath || `${selectedCase.id}/${docId}/${uf.file.name}`,
                              mimeType: uf.file.type,
                              fileSize: uf.file.size,
                              uploadedByRole: "agent",
                              notes: `Size: ${formatFileSize(uf.file.size)} | Uploaded by: ${agentName}`,
                            });
                          }
                          const success = await updateCase(selectedCase.id, {
                            documents: [...(selectedCase.documents || []), ...newDocs],
                            timeline: [
                              ...selectedCase.timeline,
                              {
                                id: `TL-${Date.now()}`,
                                date: new Date().toISOString(),
                                title: `${newDocs.length} document(s) uploaded by agent`,
                                description: `${agentName} uploaded: ${newDocs.map(d => d.name).join(", ")}`,
                                type: "document" as const,
                                user: agentName,
                              },
                            ],
                          });
                          if (success) {
                            const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                            const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
                            if (refreshed) setSelectedCase(refreshed);
                            // Notify admin
                            newDocs.forEach(doc => {
                              NotificationService.notifyDocumentUploaded(
                                selectedCase.id,
                                doc.name,
                                selectedCase.customerName
                              );
                            });
                            AuditLogService.log({
                              userId: agentId,
                              userName: agentName,
                              role: "agent",
                              action: "document_uploaded",
                              category: "document",
                              description: `Uploaded ${newDocs.length} document(s) for case ${selectedCase.id}: ${newDocs.map(d => d.name).join(", ")}`,
                              metadata: { caseId: selectedCase.id, customerName: selectedCase.customerName, docCount: newDocs.length },
                            });
                          }
                          toast.dismiss(lt);
                          toast.success(
                            isUrdu
                              ? `${newDocs.length} دستاویزات کامیابی سے اپ لوڈ ہو گئیں! ایڈمن کو مطلع کر دیا گیا`
                              : `${newDocs.length} document(s) uploaded successfully! Admin notified for review.`
                          );
                          uploadedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
                          setUploadedFiles([]);
                        }}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                      >
                        <Upload className="w-4 h-4" />
                        {isUrdu
                          ? `${uploadedFiles.length} دستاویزات اپ لوڈ کریں`
                          : `Upload ${uploadedFiles.length} Document(s)`}
                      </motion.button>
                    )}

                    {/* Info notice */}
                    <div className={`p-3 rounded-xl border ${dc ? "border-blue-800/30 bg-blue-900/10" : "border-blue-200 bg-blue-50"}`}>
                      <p className={`text-xs flex items-center gap-2 ${dc ? "text-blue-400" : "text-blue-700"}`}>
                        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                        {isUrdu
                          ? "اپ لوڈ شدہ دستاویزات 'زیر التوا' حالت میں شامل ہوں گی۔ ایڈمن تصدیق کرے گا۔"
                          : "Uploaded documents will be in 'Pending' status. Admin will verify them."}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "payments" && selectedCase && (
                  <div className="space-y-5">
                    {/* Info banner */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${dc ? "border-amber-800/40 bg-amber-900/15" : "border-amber-200 bg-amber-50"}`}
                    >
                      <ShieldCheck className={`w-5 h-5 mt-0.5 flex-shrink-0 ${dc ? "text-amber-400" : "text-amber-600"}`} />
                      <div>
                        <p className={`text-sm font-semibold ${dc ? "text-amber-300" : "text-amber-800"}`}>
                          {isUrdu ? "ادائیگی ایڈمن منظوری سے مشروط ہے" : "Payments require Admin Approval"}
                        </p>
                        <p className={`text-xs mt-0.5 ${dc ? "text-amber-400/70" : "text-amber-700/70"}`}>
                          {isUrdu
                            ? "آپ ادائیگی جمع کر سکتے ہیں۔ ایڈمن تصدیق کے بعد یہ بیلنس میں شامل ہو گی۔"
                            : "You can submit a payment entry. Once approved by Admin, it will be credited to the balance."}
                        </p>
                      </div>
                    </motion.div>

                    {/* Payment Submission Form */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-5 rounded-xl border ${dc ? "border-blue-800/40 bg-blue-900/10" : "border-blue-200 bg-blue-50/50"}`}
                    >
                      <h4 className={`font-semibold mb-4 flex items-center gap-2 ${dc ? "text-blue-400" : "text-blue-700"}`}>
                        <DollarSign className="w-5 h-5" />
                        {isUrdu ? "نئی ادائیگی جمع کریں" : "Submit New Payment"}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className={labelCls}>{isUrdu ? "رقم (PKR)" : "Amount (PKR)"} *</label>
                          <input
                            type="number"
                            min={1}
                            value={newPaymentAmount || ""}
                            onChange={(e) => setNewPaymentAmount(Number(e.target.value))}
                            placeholder={isUrdu ? "رقم درج کریں" : "Enter amount"}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>{isUrdu ? "ادائیگی کا طریقہ" : "Payment Method"}</label>
                          <select
                            value={newPaymentMethod}
                            onChange={(e) => setNewPaymentMethod(e.target.value)}
                            className={inputCls}
                          >
                            <option value="cash">{isUrdu ? "نقد" : "Cash"}</option>
                            <option value="bank">{isUrdu ? "بینک ٹرانسفر" : "Bank Transfer"}</option>
                            <option value="easypaisa">EasyPaisa</option>
                            <option value="jazzcash">JazzCash</option>
                            <option value="card">{isUrdu ? "کارڈ" : "Card"}</option>
                          </select>
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className={labelCls}>{isUrdu ? "تفصیل (اختیاری)" : "Description (Optional)"}</label>
                        <input
                          type="text"
                          value={newPaymentDesc}
                          onChange={(e) => setNewPaymentDesc(e.target.value)}
                          placeholder={isUrdu ? "ادائیگی کی تفصیل..." : "Payment description..."}
                          className={inputCls}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleRecordPayment}
                        disabled={isLoading || !newPaymentAmount || newPaymentAmount <= 0}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl hover:from-blue-700 hover:to-indigo-600 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      >
                        <Send className="w-4 h-4" />
                        {isLoading
                          ? (isUrdu ? "جمع ہو رہا ہے..." : "Submitting...")
                          : (isUrdu ? "ادائیگی جمع کریں — ایڈمن منظوری درکار" : "Submit Payment — Requires Admin Approval")}
                      </motion.button>
                    </motion.div>
                  </div>
                )}

                {activeTab === "medical" && (
                  <div>
                    {selectedCase.medical ? (
                      <div className={`p-4 border rounded-xl ${dc ? "bg-orange-900/20 border-orange-800" : "bg-orange-50 border-orange-200"}`}>
                        <h4 className={`font-semibold mb-2 ${dc ? "text-orange-300" : "text-orange-900"}`}>{isUrdu ? "شیڈول شدہ اپائنٹمنٹ" : "Scheduled Appointment"}</h4>
                        <p className={`text-sm ${dc ? "text-orange-200" : "text-orange-800"}`}>{isUrdu ? "مرکز:" : "Center:"} {selectedCase.medical.center}</p>
                        <p className={`text-sm ${dc ? "text-orange-200" : "text-orange-800"}`}>{isUrdu ? "تاریخ:" : "Date:"} {new Date(selectedCase.medical.appointmentDate).toLocaleDateString()}</p>
                        <p className={`text-sm ${dc ? "text-orange-200" : "text-orange-800"}`}>{isUrdu ? "وقت:" : "Time:"} {selectedCase.medical.appointmentTime}</p>
                        <p className={`text-sm ${dc ? "text-orange-200" : "text-orange-800"}`}>{isUrdu ? "حالت:" : "Status:"} {selectedCase.medical.status}</p>
                      </div>
                    ) : (
                      <div className={`text-center py-8 ${sub}`}>
                        <Stethoscope className={`w-12 h-12 mx-auto mb-3 ${sub}`} />
                        <p className="mb-3">{isUrdu ? "کوئی میڈیکل اپائنٹمنٹ شیڈول نہیں" : "No medical appointment scheduled"}</p>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => toast.success(isUrdu ? "میڈیکل اپائنٹمنٹ کی درخواست بھیج دی گئی!" : "Medical appointment scheduling request sent to admin!")} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          {isUrdu ? "اپائنٹمنٹ شیڈول کریں" : "Request Appointment"}
                        </motion.button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "notes" && (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={isUrdu ? "نوٹ لکھیں..." : "Add a note..."} className={`${inputCls} flex-1`} onKeyDown={(e) => e.key === "Enter" && handleAddNote()} />
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAddNote} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 min-h-[44px]"><Send className="w-4 h-4" /></motion.button>
                    </div>
                    {selectedCase.notes.length === 0 ? <p className={`text-center py-6 ${sub}`}>{isUrdu ? "ابھی کوئی نوٹ نہیں" : "No notes yet"}</p> : selectedCase.notes.map((n) => (
                      <div key={n.id} className={`p-3 rounded-xl border-l-4 ${n.important ? "border-red-500" : "border-blue-500"} ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                        <p className={`text-sm ${txt}`}>{n.text}</p>
                        <p className={`text-xs mt-1 ${sub}`}>{n.author} - {new Date(n.date).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "video" && (
                  <div>
                    <VideoGenerator
                      customerName={selectedCase.customerName}
                      stageName={getStageLabel(selectedCase.status, isUrdu)}
                      nextStage={(() => {
                        const currentNum = getStageNumber(selectedCase.status);
                        const pStages = getPipelineStages(selectedCase.pipelineType || "visa");
                        const nextStage = pStages.find(s => s.stageNumber === currentNum + 1);
                        return nextStage ? (isUrdu ? nextStage.labelUrdu : nextStage.label) : undefined;
                      })()}
                      isUrdu={isUrdu}
                    />
                  </div>
                )}

                {activeTab === "status" && (
                  <div>
                    <p className={`text-sm mb-3 ${sub}`}>{isUrdu ? "کیس کی حالت اپ ڈیٹ کریں:" : "Update case status:"}</p>
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <div className="relative flex-1 w-full sm:max-w-xs">
                        <select
                          value={selectedCase.status}
                          onChange={(e) => handleUpdateStatus(e.target.value as Case["status"])}
                          className={`w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                            dc
                              ? "bg-gray-700 border-gray-600 text-gray-200 hover:border-blue-500/50"
                              : "bg-white border-gray-200 text-gray-800 hover:border-blue-400"
                          }`}
                        >
                          {(() => {
                            const pType = selectedCase.pipelineType || "visa";
                            const stages = getPipelineStages(pType);
                            return (
                              <>
                                <optgroup label={pType === "lead" ? (isUrdu ? "لیڈ پائپ لائن" : "Lead Pipeline") : (isUrdu ? "ویزا پائپ لائن" : "Visa Pipeline")}>
                                  {stages.map((s) => (
                                    <option key={s.key} value={s.key}>
                                      {s.stageNumber > 0 ? `${s.stageNumber}. ` : "✕ "}{isUrdu ? s.labelUrdu : s.label}
                                    </option>
                                  ))}
                                </optgroup>
                              </>
                            );
                          })()}
                        </select>
                        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${sub}`} />
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(selectedCase.status)}`}>
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {getStageLabel(selectedCase.status, isUrdu)}
                      </span>
                    </div>

                    {/* Overdue / Deadline Alert */}
                    {(() => {
                      const oi = getOverdueInfo(selectedCase);
                      if (!oi.hasDeadline) return null;
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          className={`mt-4 relative overflow-hidden rounded-xl p-3.5 border-2 ${
                            oi.isOverdue
                              ? "border-red-500/50 bg-gradient-to-r " + (dc ? "from-red-950/40 to-red-900/20" : "from-red-50 to-orange-50")
                              : oi.hoursRemaining !== null && oi.hoursRemaining < 6
                                ? "border-amber-500/50 bg-gradient-to-r " + (dc ? "from-amber-950/30 to-yellow-900/10" : "from-amber-50 to-yellow-50")
                                : "border-green-500/30 bg-gradient-to-r " + (dc ? "from-green-950/20 to-green-900/10" : "from-green-50 to-green-50")
                          }`}
                        >
                          {oi.isOverdue && (
                            <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-red-500/5" />
                          )}
                          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <motion.div
                                animate={oi.isOverdue ? { rotate: [0, -10, 10, -10, 0] } : {}}
                                transition={{ duration: 0.6, repeat: oi.isOverdue ? Infinity : 0, repeatDelay: 3 }}
                                className={`p-2 rounded-xl flex-shrink-0 ${oi.isOverdue ? "bg-red-500/20" : oi.hoursRemaining! < 6 ? "bg-amber-500/20" : "bg-green-500/20"}`}
                              >
                                {oi.isOverdue ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <Timer className={`w-4 h-4 ${oi.hoursRemaining! < 6 ? "text-amber-500" : "text-green-500"}`} />}
                              </motion.div>
                              <div>
                                <p className={`text-sm font-bold ${oi.isOverdue ? "text-red-600 dark:text-red-400" : oi.hoursRemaining! < 6 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                                  {oi.isOverdue ? (isUrdu ? "ڈیڈ لائن گزر چکی!" : "Overdue!") : oi.hoursRemaining! < 6 ? (isUrdu ? "جلدی کریں!" : "Hurry!") : (isUrdu ? "وقت باقی" : "On Track")}
                                </p>
                                <p className={`text-xs ${sub}`}>
                                  <span className="font-bold">{oi.timeLabel}</span>
                                </p>
                                {selectedCase.delayReason && (
                                  <p className="flex items-center gap-1 mt-1 text-xs text-orange-600 dark:text-orange-400 font-semibold">
                                    <MessageSquare className="w-3 h-3" />
                                    {getDelayReasonLabel(selectedCase.delayReason, isUrdu)}
                                  </p>
                                )}
                              </div>
                            </div>
                            {oi.isOverdue && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={openDelayModal}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-red-500/20 flex-shrink-0"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {selectedCase.delayReason ? (isUrdu ? "اپ ڈیٹ" : "Update") : (isUrdu ? "تاخیر رپورٹ" : "Report Delay")}
                              </motion.button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })()}

                    <div className="mt-6">
                      <h4 className={`font-semibold mb-3 ${txt}`}>{isUrdu ? "ٹائم لائن" : "Timeline"}</h4>
                      {selectedCase.timeline.length === 0 ? (
                        <p className={`text-center py-4 ${sub}`}>{isUrdu ? "ابھی کوئی واقعہ نہیں" : "No events yet"}</p>
                      ) : selectedCase.timeline.map((ev, idx) => (
                        <div key={ev.id} className="flex gap-3 mb-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-2.5 h-2.5 rounded-full ${ev.type === "status" ? "bg-green-500" : ev.type === "payment" ? "bg-blue-500" : "bg-gray-400"}`} />
                            {idx < selectedCase.timeline.length - 1 && <div className={`w-0.5 flex-1 ${dc ? "bg-gray-600" : "bg-gray-200"}`} />}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${txt}`}>{ev.title}</p>
                            <p className={`text-xs ${sub}`}>{ev.description}</p>
                            <p className={`text-xs ${sub}`}>{new Date(ev.date).toLocaleString()} - {ev.user}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== DELAY REASON MODAL ========== */}
      <AnimatePresence>
        {showDelayModal && selectedCase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowDelayModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden`}
            >
              {/* Header */}
              <div className="relative overflow-hidden">
                <motion.div
                  animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10"
                  style={{ backgroundSize: "200% 100%" }}
                />
                <div className={`relative flex items-center justify-between p-5 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: [0, -15, 15, -15, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 4 }}
                      className="p-2 bg-red-500/20 rounded-xl"
                    >
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </motion.div>
                    <div>
                      <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "تاخیر کی اطلاع" : "Report Delay"}</h2>
                      <p className={`text-xs ${sub}`}>{selectedCase.id} — {selectedCase.customerName}</p>
                    </div>
                  </div>
                  <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowDelayModal(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              {/* Stage info */}
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`mx-5 mt-4 p-3 rounded-xl flex items-center justify-between ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                <div>
                  <p className={`text-xs ${sub}`}>{isUrdu ? "موجودہ مرحلہ" : "Current Stage"}</p>
                  <p className={`text-sm font-bold ${txt}`}>{getStageLabel(selectedCase.status, isUrdu)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs ${sub}`}>{isUrdu ? "حالت" : "Status"}</p>
                  <p className="text-sm font-bold text-red-500">{getOverdueInfo(selectedCase).timeLabel}</p>
                </div>
              </motion.div>

              {/* Steps */}
              <div className="flex items-center gap-2 px-5 mt-4">
                <motion.div
                  animate={delayStep === "reason" ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 1, repeat: delayStep === "reason" ? Infinity : 0, repeatDelay: 2 }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${delayStep === "reason" ? "bg-red-500 text-white" : "bg-blue-500 text-white"}`}
                >
                  {delayStep === "note" ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[10px]">1</span>}
                  {isUrdu ? "وجہ" : "Reason"}
                </motion.div>
                <ChevronRight className={`w-4 h-4 ${sub}`} />
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${delayStep === "note" ? "bg-red-500 text-white" : dc ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"}`}>
                  <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[10px]">2</span>
                  {isUrdu ? "تفصیل" : "Details"}
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  {delayStep === "reason" ? (
                    <motion.div
                      key="step-reason"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <p className={`text-sm font-semibold mb-3 ${txt}`}>{isUrdu ? "تاخیر کی وجہ منتخب کریں:" : "Select delay reason:"}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {DELAY_REASONS.map((reason, idx) => (
                          <motion.button
                            key={reason.value}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                            whileHover={{ scale: 1.02, x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { setSelectedDelayReason(reason.value); setTimeout(() => setDelayStep("note"), 200); }}
                            className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all border-2 ${
                              selectedDelayReason === reason.value
                                ? "border-red-500 " + (dc ? "bg-red-950/30" : "bg-red-50")
                                : dc ? "border-gray-700 bg-gray-700/30 hover:border-gray-600" : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <motion.div
                              animate={selectedDelayReason === reason.value ? { scale: [1, 1.2, 1] } : {}}
                              transition={{ duration: 0.3 }}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                selectedDelayReason === reason.value ? "border-red-500 bg-red-500" : dc ? "border-gray-500" : "border-gray-300"
                              }`}
                            >
                              {selectedDelayReason === reason.value && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 rounded-full bg-white" />}
                            </motion.div>
                            <p className={`text-sm font-semibold flex-1 ${selectedDelayReason === reason.value ? "text-red-600 dark:text-red-400" : txt}`}>
                              {isUrdu ? reason.labelUrdu : reason.label}
                            </p>
                            <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${selectedDelayReason === reason.value ? "text-red-500 translate-x-1" : sub}`} />
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="step-note"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${dc ? "bg-red-950/30 border border-red-900/50" : "bg-red-50 border border-red-200"}`}>
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <div className="flex-1">
                          <p className={`text-xs ${sub}`}>{isUrdu ? "منتخب وجہ:" : "Selected reason:"}</p>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">{getDelayReasonLabel(selectedDelayReason, isUrdu)}</p>
                        </div>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setDelayStep("reason")} className={`text-xs px-2 py-1 rounded-lg ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"}`}>
                          {isUrdu ? "تبدیل" : "Change"}
                        </motion.button>
                      </motion.div>
                      <p className={`text-sm font-semibold mb-2 ${txt}`}>{isUrdu ? "اضافی تفصیل (اختیاری):" : "Additional notes (optional):"}</p>
                      <motion.textarea
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        value={delayNote}
                        onChange={(e) => setDelayNote(e.target.value)}
                        rows={3}
                        placeholder={isUrdu ? "تفصیلات یہاں لکھیں..." : "Describe the delay situation..."}
                        className={`${inputCls} resize-none`}
                      />
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className={`mt-3 p-3 rounded-xl ${dc ? "bg-gray-700/50" : "bg-amber-50"}`}>
                        <p className={`text-xs ${dc ? "text-amber-400" : "text-amber-700"} flex items-start gap-2`}>
                          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          {isUrdu ? "یہ نوٹ کیس ٹائم لائن میں شامل ہو جائے گا۔" : "This will be logged in the case timeline."}
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`flex gap-3 p-5 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                {delayStep === "note" && (
                  <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setDelayStep("reason")} className={`px-5 py-2.5 rounded-xl border text-sm font-medium ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                    {isUrdu ? "واپس" : "Back"}
                  </motion.button>
                )}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowDelayModal(false)} className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                  {isUrdu ? "منسوخ" : "Cancel"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={delayStep === "reason" ? () => { if (selectedDelayReason) setDelayStep("note"); else toast.error(isUrdu ? "وجہ منتخب کریں" : "Select a reason first"); } : handleReportDelay}
                  disabled={delayStep === "note" && !selectedDelayReason}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                  {delayStep === "reason" ? (
                    <>{isUrdu ? "اگلا" : "Next"} <ChevronRight className="w-4 h-4" /></>
                  ) : (
                    <>{isUrdu ? "تاخیر رپورٹ کریں" : "Submit Delay Report"}</>
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxSrc}
        alt={lightboxAlt}
        onClose={() => { setLightboxSrc(null); setLightboxAlt(""); }}
      />

      {/* Rejection Confirmation Modal */}
      <AnimatePresence>
        {rejectModalDocId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setRejectModalDocId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${dc ? "bg-gray-800 border border-gray-700" : "bg-white"}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${dc ? "bg-red-900/30" : "bg-red-50"}`}>
                  <XCircle className={`w-5 h-5 ${dc ? "text-red-400" : "text-red-600"}`} />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${txt}`}>
                    {isUrdu ? "دستاویز مسترد کریں" : rejectModalDocId === "__bulk__" ? `Reject ${selectedDocIds.size} Document${selectedDocIds.size > 1 ? "s" : ""}` : "Reject Document"}
                  </h3>
                  <p className={`text-xs ${sub}`}>
                    {isUrdu ? "کیا آپ واقعی مسترد کرنا چاہتے ہیں؟" : "Are you sure you want to reject?"}
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <label className={`text-xs font-medium ${txt} block mb-1.5`}>
                  {isUrdu ? "مسترد کرنے کی وجہ (اختیاری)" : "Rejection reason (optional)"}
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={isUrdu ? "وجہ لکھیں..." : "e.g., Document is blurry, wrong document type..."}
                  className={`w-full px-3 py-2 rounded-xl border text-sm resize-none h-20 focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none transition-all ${
                    dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                  }`}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setRejectModalDocId(null)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {isUrdu ? "منسوخ" : "Cancel"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const reason = rejectionReason.trim() || undefined;
                    if (rejectModalDocId === "__bulk__") {
                      handleBulkVerification("rejected", reason);
                    } else {
                      handleDocVerification(rejectModalDocId, "rejected", reason);
                    }
                    setRejectModalDocId(null);
                    setRejectionReason("");
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors ${
                    dc ? "bg-red-600 hover:bg-red-500" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  {isUrdu ? "مسترد کریں" : "Confirm Reject"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
