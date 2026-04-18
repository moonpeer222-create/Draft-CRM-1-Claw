import { Case, Payment, WORKFLOW_STAGES, getStageLabel, getStageNumber, DELAY_REASONS, getOverdueInfo, getDelayReasonLabel, reportDelay, LEAD_PIPELINE_STAGES, VISA_PIPELINE_STAGES, getPipelineStages, shouldAutoMigrateToVisa } from "../../lib/mockData";
import { ALL_COUNTRIES, POPULAR_COUNTRIES } from "../../constants/countries";
import { SearchableCountrySelect } from "../../components/SearchableCountrySelect";
import { pipelineApi } from "../../lib/api";
import { MandatoryDocumentChecklist } from "../../components/MandatoryDocumentChecklist";
import { NotificationService } from "../../lib/notifications";
import { sendCaseStatusEmail, extractEmailsFromCase } from "../../lib/emailService";
import { AuditLogService } from "../../lib/auditLog";
import { DataSyncService } from "../../lib/dataSync";
import { useConflictPolling } from "../../lib/useConflictPolling";
import { useCrossTabRefresh } from "../../lib/useCrossTabRefresh";
import { useOptimisticMutation } from "../../lib/optimisticMutation";
import { pushCases } from "../../lib/syncService";
import { copyToClipboard } from "../../lib/clipboard";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { createCase, updateCase, updateCaseStatus, addPayment, addNote, deleteCase, bulkDeleteCases } from "../../lib/caseApi";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ImageLightbox } from "../../components/ImageLightbox";
import { RealtimeIndicator } from "../../components/RealtimeIndicator";

import { toast } from "../../lib/toast";
import { modalVariants, staggerContainer, staggerItem } from "../../lib/animations";
import { useTheme } from "../../lib/ThemeContext";
import { VisualTimelineStepper } from "../../components/VisualTimelineStepper";
import { WhatsAppActions } from "../../components/WhatsAppActions";
import { DocumentUploadInterface } from "../../components/DocumentUploadInterface";
import { DocumentFileStore } from "../../lib/documentStore";
import { PaymentConfirmationModal } from "../../components/PaymentConfirmationModal";
import { EmojiMoodTracker } from "../../components/visaverse/EmojiMoodTracker";
import { ARScannerButton } from "../../components/visaverse/ARScanner";
import { visaverseApi } from "../../lib/api";
import { SirAtifApprovalButton } from "../../components/SirAtifApprovalButton";
import { CancellationReopenModal } from "../../components/CancellationReopenModal";
import { EditableCaseFields } from "../../components/EditableCaseFields";
import { LiveDocumentThumbnail } from "../../components/LiveDocumentThumbnail";
import { AddStaffModal } from "../../components/AddStaffModal";
import {
  Search, Filter, Plus, Phone, MessageCircle, Download, ChevronDown,
  FileText, Clock, CheckCircle2, DollarSign, TrendingUp, AlertCircle,
  Eye, Edit, X, Trash2, Send, MapPin, Calendar, User, Briefcase,
  Upload, Heart, GraduationCap, ShieldCheck, Home, UserPlus,
  CloudUpload, Image, File as FileIcon, Paperclip, AlertTriangle, Timer, ChevronRight, MessageSquare, Link2, Check,
  RotateCcw, XCircle
} from "lucide-react";

export function AdminCaseManagement() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  // Get current admin name from session
  const adminName = (() => {
    try {
      const raw = localStorage.getItem("emerald-admin-auth");
      if (raw) {
        const session = JSON.parse(raw);
        return session.fullName || "Admin";
      }
    } catch {}
    return "Admin";
  })();

  const [cases, setCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const { mutate: optimisticMutate } = useOptimisticMutation();
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showCaseDetail, setShowCaseDetail] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [linkCopied, setLinkCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDelayReason, setSelectedDelayReason] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delayStep, setDelayStep] = useState<"reason" | "note">("reason");
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [deepLinked, setDeepLinked] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Detect if master admin via URL path
  const isMasterAdmin = window.location.pathname.startsWith("/master");

  // Improvement #8: Bulk operations
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<Case["status"]>("document_collection");

  // Lightbox state for document previews
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  // Real-time conflict polling — active when case detail modal is open
  const conflictState = useConflictPolling({
    entityId: selectedCase?.id || null,
    currentUserId: "admin",
    enabled: showCaseDetail && !!selectedCase,
    intervalMs: 5000,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    country: "all",
    agent: "all",
    priority: "all",
    dateRange: "all",
  });

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
    agentName: "Faizan",
    totalFee: 50000,
    priority: "medium" as Case["priority"],
    uploadedDocs: [] as string[],
  });

  const [newPayment, setNewPayment] = useState({
    amount: 0,
    method: "cash" as Payment["method"],
    description: "",
    receiptNumber: "",
  });

  const [newNote, setNewNote] = useState({
    text: "",
    important: false,
  });

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

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
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
      toast.error(isUrdu ? `زیادہ سے زیادہ ${MAX_FILES} فائلز` : `Maximum ${MAX_FILES} files allowed`);
      return;
    }
    const toProcess = fileArray.slice(0, remaining);
    let added = 0;
    toProcess.forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Unsupported file type`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File exceeds 5MB limit`);
        return;
      }
      if (uploadedFiles.some((uf) => uf.file.name === file.name && uf.file.size === file.size)) {
        toast.error(`${file.name} already added`);
        return;
      }
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
      setUploadedFiles((prev) => [...prev, {
        id: `UF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        file, preview, category: "Other",
      }]);
      added++;
    });
    if (added > 0) toast.success(`${added} file(s) added`);
  }, [uploadedFiles, isUrdu]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) { processFiles(e.target.files); e.target.value = ""; }
  };
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);
  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => { const f = prev.find((x) => x.id === fileId); if (f?.preview) URL.revokeObjectURL(f.preview); return prev.filter((x) => x.id !== fileId); });
    toast.info("File removed");
  };
  const updateFileCategory = (fileId: string, category: string) => {
    setUploadedFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, category } : f)));
  };

  useEffect(() => {
    loadCases();
  }, []);

  // Deep-link: auto-open case from URL param (/admin/cases/:caseId?tab=payments&from=notification) or legacy location.state
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
          setShowCaseDetail(true);
          setActiveTab(tab || "overview");
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

  // Live countdown timer - refresh overdue info every 60s
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filters, cases, overdueFilter]);

  const loadCases = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error("Failed to load cases from server");
      console.error(error);
    } else {
      const mapped = (data || []).map((r: any) => mapSupabaseCaseToLocal(r));
      setCases(mapped);
      setFilteredCases(mapped);
    }
    setIsLoading(false);
  };

  // Auto-refresh when another tab modifies cases
  useCrossTabRefresh(["cases"], loadCases);

  const applyFilters = () => {
    let filtered = [...cases];
    if (searchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone.includes(searchTerm) ||
          c.passport.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filters.status !== "all") filtered = filtered.filter((c) => c.status === filters.status);
    if (filters.country !== "all") filtered = filtered.filter((c) => c.country === filters.country);
    if (filters.agent !== "all") filtered = filtered.filter((c) => c.agentName === filters.agent);
    if (filters.priority !== "all") filtered = filtered.filter((c) => c.priority === filters.priority);
    if (overdueFilter) filtered = filtered.filter((c) => getOverdueInfo(c).isOverdue);
    setFilteredCases(filtered);
  };

  const handleCreateCase = () => {
    if (!newCase.customerName || !newCase.phone) {
      toast.error(isUrdu ? "براہ کرم تمام مطلوبہ فیلڈز بھریں" : "Please fill all required fields (Name & Phone)");
      return;
    }
    setIsLoading(true);
    const lt = toast.loading(isUrdu ? "نیا کیس بنایا جا رہا ہے..." : "Creating new case...");

    // Map agent name to agent ID
    const agentNameToId: Record<string, string> = {
      "Faizan": "AGENT-1", "Imran": "AGENT-2", "Safeer": "AGENT-3", "Aynee": "AGENT-4",
    };
    const resolvedAgentId = agentNameToId[newCase.agentName] || "AGENT-1";

    setTimeout(async () => {
      const created = await createCase({
        customerName: newCase.customerName,
        fatherName: newCase.fatherName,
        phone: newCase.phone,
        email: newCase.email,
        cnic: newCase.cnic,
        passport: newCase.passport,
        dateOfBirth: newCase.dateOfBirth,
        maritalStatus: newCase.maritalStatus,
        address: newCase.address,
        city: newCase.city,
        country: newCase.country,
        jobType: newCase.jobType,
        jobDescription: newCase.jobDescription,
        education: newCase.education,
        experience: newCase.experience,
        emergencyContact: {
          name: newCase.emergencyContactName,
          phone: newCase.emergencyContactPhone,
          relationship: newCase.emergencyContactRelation,
        },
        agentName: newCase.agentName,
        totalFee: newCase.totalFee,
        priority: newCase.priority,
        status: "document_collection",
        currentStage: 1,
        stageStartedAt: new Date().toISOString(),
        stageDeadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        isOverdue: false,
        agentId: resolvedAgentId,
        documents: [
          ...newCase.uploadedDocs.map((doc, i) => ({
            id: `DOC-${i + 1}`,
            name: doc,
            type: doc.toLowerCase().replace(/[^a-z]/g, "_"),
            uploadDate: new Date().toISOString(),
            status: "pending" as const,
            url: "#",
          })),
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
      });
      toast.dismiss(lt);
      if (created) {
        toast.success(`Case ${created.id} created successfully!`);
        NotificationService.notifyCaseCreated(created.id, newCase.customerName, newCase.agentName);
        AuditLogService.logCaseCreated(adminName, "admin", created.id, newCase.customerName);
        DataSyncService.markModified(created.id, "admin", adminName, "admin", "case", "Case created by admin");
      } else {
        toast.error("Failed to create case in database");
      }
      setShowNewCaseModal(false);
      setNewCase({ customerName: "", fatherName: "", phone: "", email: "", cnic: "", passport: "", dateOfBirth: "", maritalStatus: "single", address: "", city: "Lahore", country: "Saudi Arabia", jobType: "Driver", jobDescription: "", education: "High School", experience: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "father", agentName: "Faizan", totalFee: 50000, priority: "medium", uploadedDocs: [] });
      uploadedFiles.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
      setUploadedFiles([]);
      loadCases();
      setIsLoading(false);
    }, 1200);
  };

  const handleAddPayment = async () => {
    if (!selectedCase || newPayment.amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    setIsLoading(true);

    const success = await addPayment(selectedCase.id, {
      ...newPayment,
      date: new Date().toISOString(),
      collectedBy: "Admin",
    });

    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
      if (refreshed) setSelectedCase(refreshed);
      toast.success(`Payment of PKR ${newPayment.amount.toLocaleString()} recorded!`);
      AuditLogService.logPaymentAction(adminName, "admin", "payment_added", selectedCase.id, newPayment.amount);
      DataSyncService.markModified(selectedCase.id, "admin", adminName, "admin", "case", `Payment PKR ${newPayment.amount.toLocaleString()} recorded`);
      NotificationService.notifyPaymentReceived(selectedCase.id, newPayment.amount, selectedCase.customerName);
      setShowPaymentModal(false);
      setNewPayment({ amount: 0, method: "cash", description: "", receiptNumber: "" });
      loadCases();
    } else {
      toast.error("Failed to record payment");
    }
    setIsLoading(false);
  };

  const handleAddNote = async () => {
    if (!selectedCase || !newNote.text) {
      toast.error("Please enter a note");
      return;
    }
    const success = await addNote(selectedCase.id, {
      ...newNote,
      author: "Admin",
      date: new Date().toISOString(),
    });
    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
      if (refreshed) setSelectedCase(refreshed);
      toast.success("Note added successfully!");
      setNewNote({ text: "", important: false });
      loadCases();
    } else {
      toast.error("Failed to add note");
    }
  };

  const handleUpdateStatus = async (caseId: string, status: Case["status"]) => {
    const currentCase = selectedCase;
    const snapshot = localStorage.getItem("crm_cases");

    // Use pipelineApi for stage advancement (server validates hard-locks)
    try {
      const res = await pipelineApi.advanceStage(caseId, status, "admin", adminName);
      if (!res.success) {
        if (res.blockers && Array.isArray(res.blockers)) {
          toast.error("Stage locked — requirements not met");
          res.blockers.forEach((b: string) => toast.error(b));
        } else {
          toast.error(res.error || "Stage update failed");
        }
        return;
      }
    } catch {
      // Fallback to local if server unavailable
    }

    const success = await updateCaseStatus(caseId, status);
    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', caseId).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
      if (refreshed) setSelectedCase(refreshed);
      toast.success(`Case status updated to ${status}!`);
      if (currentCase) {
        NotificationService.notifyCaseStatusChanged(caseId, currentCase.customerName, currentCase.status, status);
        AuditLogService.logCaseStageChanged(adminName, "admin", caseId, currentCase.status, status);
        DataSyncService.markModified(caseId, "admin", adminName, "admin", "case", `Status changed to ${status}`);
        const { customerEmail, agentEmail } = extractEmailsFromCase(currentCase);
        sendCaseStatusEmail({
          caseId,
          customerName: currentCase.customerName,
          customerEmail,
          agentName: currentCase.agentName,
          agentEmail,
          oldStatus: currentCase.status,
          newStatus: status,
          phone: currentCase.phone,
          country: currentCase.country,
        });
      }

      // Auto-migrate lead to visa pipeline
      if (shouldAutoMigrateToVisa(status)) {
        try {
          await pipelineApi.migrateToVisa(caseId);
          toast.success("Case auto-migrated to Visa Pipeline!");
        } catch (err) {
          console.error("Auto-migration failed:", err);
        }
      }

      loadCases();

      try {
        await pushCases();
      } catch (err) {
        if (snapshot) localStorage.setItem("crm_cases", snapshot);
        loadCases();
        if (currentCase) setSelectedCase(currentCase);
        toast.error(`Server sync failed — status change reverted. ${err}`);
      }
    }
  };

  const handleReportDelay = () => {
    if (!selectedCase || !selectedDelayReason) {
      toast.error(isUrdu ? "براہ کرم تاخیر کی وجہ منتخب کریں" : "Please select a delay reason");
      return;
    }
    setIsLoading(true);
    const lt = toast.loading(isUrdu ? "تاخیر کی اطلاع درج ہو رہی ہے..." : "Reporting delay...");
    setTimeout(() => {
      const updated = reportDelay(selectedCase.id, selectedDelayReason, delayNote || undefined);
      if (updated) {
        setSelectedCase(updated);
        toast.dismiss(lt);
        toast.success(isUrdu ? "تاخیر کی وجہ محفوظ ہو گئی!" : `Delay reported: ${getDelayReasonLabel(selectedDelayReason)}`);
        NotificationService.addNotification({
          type: "alert", priority: "high",
          title: isUrdu ? "تاخیر کی اطلاع" : "Delay Reported",
          message: `Case ${selectedCase.id} (${selectedCase.customerName}) delayed at ${getStageLabel(selectedCase.status)}. Reason: ${getDelayReasonLabel(selectedDelayReason)}${delayNote ? `. Note: ${delayNote}` : ""}`,
          actionable: true, actionUrl: "/admin/cases", actionLabel: "View Case", targetRole: "admin",
        });
        setShowDelayModal(false);
        setSelectedDelayReason("");
        setDelayNote("");
        setDelayStep("reason");
        loadCases();
      }
      setIsLoading(false);
    }, 800);
  };

  const openDelayModal = () => {
    setSelectedDelayReason("");
    setDelayNote("");
    setDelayStep("reason");
    setShowDelayModal(true);
  };

  const handleDeleteCase = (caseId: string) => {
    if (!confirm("Are you sure you want to delete this case?")) return;
    const lt = toast.loading("Deleting case...");
    setTimeout(async () => {
      const success = await deleteCase(caseId);
      if (success) {
        toast.dismiss(lt);
        toast.success("Case deleted successfully!");
        setShowCaseDetail(false);
        setSelectedCase(null);
        loadCases();
      } else {
        toast.dismiss(lt);
        toast.error("Failed to delete case");
      }
    }, 800);
  };

  const handleExport = () => {
    const lt = toast.loading("Exporting cases data...");
    setTimeout(() => {
      // Generate CSV
      const headers = "Case ID,Customer,Phone,Country,Job Type,Status,Priority,Agent,Total Fee,Paid,Created\n";
      const rows = filteredCases.map(c =>
        `${c.id},${c.customerName},${c.phone},${c.country},${c.jobType},${c.status},${c.priority},${c.agentName},${c.totalFee},${c.paidAmount},${new Date(c.createdDate).toLocaleDateString()}`
      ).join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emerald-cases-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(lt);
      toast.success(`${filteredCases.length} cases exported to CSV!`);
    }, 1000);
  };

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

  const stats = {
    total: filteredCases.length,
    active: filteredCases.filter((c) => !["completed", "rejected"].includes(c.status)).length,
    completed: filteredCases.filter((c) => c.status === "completed").length,
    revenue: filteredCases.reduce((sum, c) => sum + c.paidAmount, 0),
  };

  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const labelCls = `block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`;

  return (
    <div className={`${isUrdu ? fontClass : ""} min-h-full transition-colors duration-300`}>
        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div className="mx-[0px] my-[10px]">
              <h1 className={`text-xl md:text-3xl font-bold mb-1 ${txt}`}>{t("cases.title")}</h1>
              
            </div>
            <div className="flex gap-3">
              
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleExport} className={`flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm transition-all ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-white"}`}>
                <Download className="w-4 h-4" /> Export
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowAddStaffModal(true)} className={`flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm transition-all ${dc ? "border-emerald-600 text-emerald-400 hover:bg-emerald-900/20" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
                <UserPlus className="w-4 h-4" /> {isUrdu ? "نیا ایجنٹ" : "Add Agent"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowNewCaseModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl hover:from-blue-700 hover:to-indigo-600 transition-all shadow-lg">
                <Plus className="w-4 h-4" /> {isUrdu ? "نیا کیس" : "New Case"}
              </motion.button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col sm:flex-row gap-4 mb-6">
            {[
              { label: "Total Cases", value: stats.total, icon: FileText, color: "text-blue-600", bg: dc ? "bg-blue-900/20" : "bg-blue-50" },
              { label: "Active Cases", value: stats.active, icon: Clock, color: "text-orange-600", bg: dc ? "bg-orange-900/20" : "bg-orange-50" },
              { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-green-600", bg: dc ? "bg-green-900/20" : "bg-green-50" },
              { label: "Revenue", value: `PKR ${(stats.revenue / 1000).toFixed(0)}K`, icon: DollarSign, color: "text-blue-600", bg: dc ? "bg-blue-900/20" : "bg-blue-50" },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <motion.div key={idx} variants={staggerItem} whileHover={{ y: -4 }} className={`${card} flex-1 rounded-2xl shadow-lg p-4 md:p-5 border ${dc ? "border-gray-700" : "border-gray-100"} flex items-center gap-4`}>
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    {stat.label === "Revenue" ? (
                      <span className={`${stat.color} font-bold text-sm`}>PKR</span>
                    ) : (
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    )}
                  </div>
                  <div>
                    <p className={`text-xs ${sub} mb-0.5`}>{stat.label}</p>
                    <h3 className={`text-2xl font-bold ${txt}`}>{stat.value}</h3>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Search & Filters */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${card} rounded-2xl shadow-lg p-[10px] mx-[0px] mt-[0px] mb-[14px]`}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name, case ID, phone, passport..." className={`${inputCls} pl-12`} />
              </div>
              
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${showFilters ? (dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700") : `border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}`}>
                <Filter className="w-4 h-4" /> Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </motion.button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`mt-4 pt-4 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: "Status", key: "status", opts: ["all", ...LEAD_PIPELINE_STAGES.map(s => s.key), ...VISA_PIPELINE_STAGES.map(s => s.key)] },
                      { label: "Country", key: "country", opts: ["all", ...POPULAR_COUNTRIES, ...ALL_COUNTRIES.filter(c => !POPULAR_COUNTRIES.includes(c))] },
                      { label: "Agent", key: "agent", opts: ["all", "Faizan", "Imran", "Safeer", "Aynee"] },
                      { label: "Priority", key: "priority", opts: ["all", "urgent", "high", "medium", "low"] },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className={labelCls}>{f.label}</label>
                        <select value={(filters as any)[f.key]} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })} className={inputCls}>
                          {f.opts.map((o) => (
                            <option key={o} value={o}>{o === "all" ? `All ${f.label}s` : f.key === "status" ? getStageLabel(o as Case["status"]) : o.charAt(0).toUpperCase() + o.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <div className="flex items-end">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setFilters({ status: "all", country: "all", agent: "all", priority: "all", dateRange: "all" }); setSearchTerm(""); }} className={`w-full px-4 py-2.5 border rounded-xl ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-600" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                        Reset
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Cases Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${card} rounded-2xl shadow-lg overflow-hidden`}>
            {/* Bulk Action Bar */}
            <AnimatePresence>
              {bulkMode && bulkSelected.size > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${dc ? "bg-blue-900/20 border-blue-800/30" : "bg-blue-50 border-blue-200"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${dc ? "text-blue-300" : "text-blue-700"}`}>{bulkSelected.size} selected</span>
                    <button onClick={() => setBulkSelected(new Set(filteredCases.slice(0, 25).map(cs => cs.id)))} className={`text-xs px-2 py-1 rounded ${dc ? "text-blue-400 hover:bg-blue-900/30" : "text-blue-600 hover:bg-blue-100"}`}>Select All</button>
                    <button onClick={() => setBulkSelected(new Set())} className={`text-xs px-2 py-1 rounded ${dc ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}>Clear</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowBulkStatusModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                      <Edit className="w-3 h-3" /> Change Status
                    </button>
                    <button onClick={async () => {
                      if (!confirm(`Delete ${bulkSelected.size} cases? This cannot be undone.`)) return;
                      const ids = Array.from(bulkSelected);
                      const success = await bulkDeleteCases(ids);
                      if (success) {
                        toast.success(`${ids.length} cases deleted`);
                        setBulkSelected(new Set());
                        setBulkMode(false);
                        loadCases();
                      } else {
                        toast.error("Failed to delete cases");
                      }
                    }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${dc ? "bg-gray-700" : "bg-gray-50"} border-b ${dc ? "border-gray-600" : "border-gray-200"}`}>
                  <tr>
                    {bulkMode && (
                      <th className="py-4 px-3 w-10">
                        <input type="checkbox" checked={bulkSelected.size === Math.min(filteredCases.length, 25) && bulkSelected.size > 0} onChange={(e) => { if (e.target.checked) { setBulkSelected(new Set(filteredCases.slice(0, 25).map(cs => cs.id))); } else { setBulkSelected(new Set()); } }} className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                      </th>
                    )}
                    {["Case ID", "Customer", "Destination", "Status", "Priority", "Agent", "Payment", "Actions"].map((h) => (
                      <th key={h} className={`text-left py-4 px-3 md:px-5 text-xs font-semibold uppercase tracking-wider ${dc ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.slice(0, 25).map((c, idx) => (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }} className={`border-b cursor-pointer transition-colors ${bulkSelected.has(c.id) ? (dc ? "bg-blue-900/20" : "bg-blue-50") : ""} ${dc ? "border-gray-700/50 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50"}`} onClick={() => { if (bulkMode) { const next = new Set(bulkSelected); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); setBulkSelected(next); } else { setSelectedCase(c); setShowCaseDetail(true); setActiveTab("overview"); } }}>
                      {bulkMode && (
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={bulkSelected.has(c.id)} onChange={() => { const next = new Set(bulkSelected); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); setBulkSelected(next); }} className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                        </td>
                      )}
                      <td className="py-3 px-3 md:px-5 font-mono text-blue-600 font-semibold text-[10px]">{c.id}</td>
                      <td className="py-3 px-3 md:px-5">
                        <p className={`text-sm font-semibold ${txt}`}>{c.customerName}</p>
                        <p className={`text-xs ${sub}`}>{c.phone}</p>
                      </td>
                      <td className="py-3 px-3 md:px-5">
                        <p className={`text-sm ${dc ? "text-gray-300" : "text-gray-900"}`}>{c.country}</p>
                        <p className={`text-xs ${sub}`}>{c.jobType}</p>
                      </td>
                      <td className="py-3 px-3 md:px-5"></td>
                      <td className="py-3 px-3 md:px-5">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getPriorityColor(c.priority)}`}>{c.priority}</span>
                      </td>
                      <td className={`py-3 px-3 md:px-5 text-sm ${sub}`}>{c.agentName}</td>
                      <td className="py-3 px-3 md:px-5">
                        <p className={`text-sm font-semibold ${txt}`}>PKR {c.paidAmount.toLocaleString()}</p>
                        <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((c.paidAmount / c.totalFee) * 100, 100)}%` }} />
                        </div>
                      </td>
                      <td className="py-3 px-3 md:px-5">
                        <div className="flex gap-1">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); window.open(`tel:${c.phone}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                            <Phone className="w-4 h-4" />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`); toast.info(`Opening WhatsApp for ${c.customerName}`); }} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                            <MessageCircle className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCases.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
                <p className={sub}>No cases found matching your criteria</p>
              </div>
            )}
            {filteredCases.length > 25 && (
              <div className={`p-4 border-t text-center ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <p className={`text-sm ${sub}`}>Showing 25 of {filteredCases.length} cases</p>
              </div>
            )}
          </motion.div>
        </main>

      {/* ========== NEW CASE MODAL (Comprehensive) ========== */}
      <AnimatePresence>
        {showNewCaseModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNewCaseModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()} className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto`}>
              <div className={`flex items-center justify-between p-6 border-b sticky top-0 z-10 ${dc ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"} rounded-t-2xl`}>
                <h2 className={`text-xl font-bold ${txt}`}>{isUrdu ? "نیا کیس بنائیں" : "Create New Case"}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowNewCaseModal(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X className="w-5 h-5" /></motion.button>
              </div>
              <div className="p-6 space-y-6">
                {/* Section: Personal Info */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <h3 className={`font-semibold ${txt}`}>{isUrdu ? "ذاتی معلومات" : "Personal Information"}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className={labelCls}>{isUrdu ? "نام *" : "Full Name *"}</label><input type="text" value={newCase.customerName} onChange={(e) => setNewCase({ ...newCase, customerName: e.target.value })} className={inputCls} placeholder="Full name" /></div>
                    <div><label className={labelCls}>{isUrdu ? "والد کا نام" : "Father's Name"}</label><input type="text" value={newCase.fatherName} onChange={(e) => setNewCase({ ...newCase, fatherName: e.target.value })} className={inputCls} placeholder="Father's name" /></div>
                    <div><label className={labelCls}>{isUrdu ? "فون *" : "Phone *"}</label><input type="tel" value={newCase.phone} onChange={(e) => setNewCase({ ...newCase, phone: e.target.value })} className={inputCls} placeholder="+92 3XX XXXXXXX" /></div>
                    <div><label className={labelCls}>{isUrdu ? "ای میل" : "Email"}</label><input type="email" value={newCase.email} onChange={(e) => setNewCase({ ...newCase, email: e.target.value })} className={inputCls} placeholder="email@example.com" /></div>
                    <div><label className={labelCls}>CNIC</label><input type="text" value={newCase.cnic} onChange={(e) => setNewCase({ ...newCase, cnic: e.target.value })} className={inputCls} placeholder="XXXXX-XXXXXXX-X" /></div>
                    <div><label className={labelCls}>{isUrdu ? "پاسپورٹ" : "Passport"}</label><input type="text" value={newCase.passport} onChange={(e) => setNewCase({ ...newCase, passport: e.target.value })} className={inputCls} placeholder="e.g. AB1234567" /></div>
                    <div><label className={labelCls}>{isUrdu ? "تاریخ پیدائش" : "Date of Birth"}</label><input type="date" value={newCase.dateOfBirth} onChange={(e) => setNewCase({ ...newCase, dateOfBirth: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>{isUrdu ? "ازدواجی حیثیت" : "Marital Status"}</label>
                      <select value={newCase.maritalStatus} onChange={(e) => setNewCase({ ...newCase, maritalStatus: e.target.value as Case["maritalStatus"] })} className={inputCls}>
                        {[["single","Single"],["married","Married"],["divorced","Divorced"],["widowed","Widowed"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {/* Section: Address */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Home className="w-5 h-5 text-blue-600" />
                    <h3 className={`font-semibold ${txt}`}>{isUrdu ? "پتہ" : "Address"}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2"><label className={labelCls}>{isUrdu ? "مکمل پتہ" : "Full Address"}</label><input type="text" value={newCase.address} onChange={(e) => setNewCase({ ...newCase, address: e.target.value })} className={inputCls} placeholder="House #, Street, Area" /></div>
                    <div><label className={labelCls}>{isUrdu ? "شہر" : "City"}</label>
                      <select value={newCase.city} onChange={(e) => setNewCase({ ...newCase, city: e.target.value })} className={inputCls}>
                        {["Lahore","Karachi","Islamabad","Rawalpindi","Faisalabad","Multan","Peshawar","Quetta","Sialkot","Gujranwala","Other"].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {/* Section: Job & Destination */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    <h3 className={`font-semibold ${txt}`}>{isUrdu ? "ملازمت اور منزل" : "Job & Destination"}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <SearchableCountrySelect value={newCase.country} onChange={(v) => setNewCase({ ...newCase, country: v })} label="Destination Country" labelUrdu="ملک" darkMode={dc} isUrdu={isUrdu} />
                    </div>
                    <div><label className={labelCls}>{isUrdu ? "نوکری کی قسم" : "Job Type"}</label>
                      <select value={newCase.jobType} onChange={(e) => setNewCase({ ...newCase, jobType: e.target.value })} className={inputCls}>
                        {["Driver","Construction Worker","Hospitality","Healthcare","Security Guard","Factory Worker","Cleaner","Electrician","Plumber","Mechanic","Other"].map((j) => <option key={j} value={j}>{j}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2"><label className={labelCls}>{isUrdu ? "نوکری کی تفصیل / مہارت" : "Job Description / Skills"}</label><textarea value={newCase.jobDescription} onChange={(e) => setNewCase({ ...newCase, jobDescription: e.target.value })} className={`${inputCls} min-h-[60px]`} placeholder="Describe relevant skills and experience..." /></div>
                  </div>
                </div>
                {/* Section: Education & Experience */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                    <h3 className={`font-semibold ${txt}`}>{isUrdu ? "تعلیم اور تجربہ" : "Education & Experience"}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className={labelCls}>{isUrdu ? "تعلیم" : "Education Level"}</label>
                      <select value={newCase.education} onChange={(e) => setNewCase({ ...newCase, education: e.target.value })} className={inputCls}>
                        {["Primary","Middle","High School","Intermediate","Graduate","Postgraduate","Technical/Diploma","None"].map((ed) => <option key={ed} value={ed}>{ed}</option>)}
                      </select>
                    </div>
                    <div><label className={labelCls}>{isUrdu ? "تجربہ" : "Work Experience"}</label><input type="text" value={newCase.experience} onChange={(e) => setNewCase({ ...newCase, experience: e.target.value })} className={inputCls} placeholder="e.g. 5 years driving" /></div>
                  </div>
                </div>
                {/* Section: Emergency Contact */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="w-5 h-5 text-red-500" />
                    <h3 className={`font-semibold ${txt}`}>{isUrdu ? "ہنگامی رابطہ" : "Emergency Contact"}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className={labelCls}>{isUrdu ? "نام" : "Contact Name"}</label><input type="text" value={newCase.emergencyContactName} onChange={(e) => setNewCase({ ...newCase, emergencyContactName: e.target.value })} className={inputCls} placeholder="Name" /></div>
                    <div><label className={labelCls}>{isUrdu ? "فون" : "Contact Phone"}</label><input type="tel" value={newCase.emergencyContactPhone} onChange={(e) => setNewCase({ ...newCase, emergencyContactPhone: e.target.value })} className={inputCls} placeholder="+92 3XX XXXXXXX" /></div>
                    <div><label className={labelCls}>{isUrdu ? "رشتہ" : "Relationship"}</label>
                      <select value={newCase.emergencyContactRelation} onChange={(e) => setNewCase({ ...newCase, emergencyContactRelation: e.target.value })} className={inputCls}>
                        {[["father","Father"],["mother","Mother"],["spouse","Spouse"],["brother","Brother"],["sister","Sister"],["friend","Friend"],["other","Other"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {/* Section: Documents Checklist */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    <h3 className={`font-semibold ${txt}`}>{isUrdu ? "دستاویزات چیک لسٹ" : "Documents Checklist"}</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {["Passport Copy","CNIC Front","CNIC Back","Photos (4x6)","Educational Cert","Experience Letter","Police Character Cert"].map((doc) => {
                      const isSel = newCase.uploadedDocs.includes(doc);
                      return (
                        <motion.button key={doc} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => {
                          if (isSel) { setNewCase({ ...newCase, uploadedDocs: newCase.uploadedDocs.filter(d => d !== doc) }); }
                          else { setNewCase({ ...newCase, uploadedDocs: [...newCase.uploadedDocs, doc] }); toast.success(`${doc} marked`); }
                        }} className={`p-3 rounded-xl border-2 text-left transition-all ${isSel ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : dc ? "border-gray-600 hover:border-gray-500" : "border-gray-200 hover:border-gray-300"}`}>
                          <div className="flex items-center gap-2">
                            {isSel ? <CheckCircle2 className="w-4 h-4 text-blue-600" /> : <FileText className={`w-4 h-4 ${sub}`} />}
                            <span className={`text-xs font-medium ${isSel ? "text-blue-700 dark:text-blue-400" : sub}`}>{doc}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                {/* Section: File Upload */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CloudUpload className="w-5 h-5 text-blue-600" />
                    <h3 className={`font-semibold ${txt}`}>{isUrdu ? "فائلز اپ لوڈ کریں" : "Upload Files"}</h3>
                    <span className={`text-xs ${sub} ml-auto`}>{uploadedFiles.length}/{MAX_FILES}</span>
                  </div>

                  <input ref={fileInputRef} type="file" multiple accept={ALLOWED_EXTENSIONS} onChange={handleFileSelect} className="hidden" />

                  <motion.div
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                      isDragOver
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]"
                        : dc ? "border-gray-600 hover:border-blue-600 hover:bg-gray-700/30" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/30"
                    }`}
                  >
                    <motion.div animate={isDragOver ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300 }}>
                      <CloudUpload className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? "text-blue-500" : sub}`} />
                      <p className={`text-sm font-medium mb-1 ${isDragOver ? (dc ? "text-blue-400" : "text-blue-700") : txt}`}>
                        {isDragOver ? (isUrdu ? "فائلز یہاں چھوڑیں" : "Drop files here") : (isUrdu ? "فائلز یہاں ڈریگ کریں یا کلک کریں" : "Drag & drop files here, or click to browse")}
                      </p>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "صرف JPG, PNG, PDF — زیادہ سے زیادہ 5MB فی فائل" : "JPG, PNG, PDF only — Max 5MB per file"}</p>
                    </motion.div>
                  </motion.div>

                  <AnimatePresence>
                    {uploadedFiles.length > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2">
                        {uploadedFiles.map((uf) => {
                          const Icon = getFileIcon(uf.file.type);
                          return (
                            <motion.div key={uf.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0 }}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${dc ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"}`}>
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
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${txt}`}>{uf.file.name}</p>
                                <p className={`text-xs ${sub}`}>{formatFileSize(uf.file.size)}</p>
                              </div>
                              <select value={uf.category} onChange={(e) => updateFileCategory(uf.id, e.target.value)} onClick={(e) => e.stopPropagation()}
                                className={`text-xs px-2 py-1.5 rounded-lg border flex-shrink-0 max-w-[120px] ${dc ? "bg-gray-600 border-gray-500 text-gray-200" : "bg-white border-gray-300 text-gray-700"}`}>
                                {DOC_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeFile(uf.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0">
                                <Trash2 className="w-4 h-4" />
                              </motion.button>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {uploadedFiles.length > 0 && (
                    <div className={`flex items-center gap-2 text-xs mt-2 ${sub}`}>
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{uploadedFiles.length} file(s) attached — Total: {formatFileSize(uploadedFiles.reduce((sum, f) => sum + f.file.size, 0))}</span>
                    </div>
                  )}
                </div>
                {/* Section: Case Settings */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <h3 className={`font-semibold ${txt}`}>{isUrdu ? "کیس ترتیبات" : "Case Settings"}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className={labelCls}>{isUrdu ? "ایجنٹ" : "Assign Agent"}</label>
                      <select value={newCase.agentName} onChange={(e) => setNewCase({ ...newCase, agentName: e.target.value })} className={inputCls}>
                        {["Faizan","Imran","Safeer","Aynee"].map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div><label className={labelCls}>{isUrdu ? "کل فیس (PKR)" : "Total Fee (PKR)"}</label><input type="number" value={newCase.totalFee} onChange={(e) => setNewCase({ ...newCase, totalFee: Number(e.target.value) })} className={inputCls} /></div>
                    <div><label className={labelCls}>{isUrdu ? "ترجیح" : "Priority"}</label>
                      <select value={newCase.priority} onChange={(e) => setNewCase({ ...newCase, priority: e.target.value as Case["priority"] })} className={inputCls}>
                        {[["low","Low"],["medium","Medium"],["high","High"],["urgent","Urgent"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className={`flex gap-3 p-6 border-t sticky bottom-0 rounded-b-2xl ${dc ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowNewCaseModal(false)} className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{isUrdu ? "منسوخ" : "Cancel"}</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCreateCase} disabled={isLoading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold">{isLoading ? (isUrdu ? "بنایا جا رہا ہے..." : "Creating...") : (isUrdu ? "کیس بنائیں" : "Create Case")}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== CASE DETAIL MODAL ========== */}
      <AnimatePresence>
        {showCaseDetail && selectedCase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCaseDetail(false)}>
            <motion.div
              variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto ${deepLinked ? "animate-notif-ring" : ""}`}
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
              <div className={`flex items-center justify-between p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className={`text-xl font-bold ${txt}`}>{selectedCase.id}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedCase.status)}`}>{getStageLabel(selectedCase.status)}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedCase.priority)}`}>{selectedCase.priority}</span>
                    <RealtimeIndicator caseId={selectedCase.id} onRefresh={async () => {
                      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                      if (data) {
                        setSelectedCase(mapSupabaseCaseToLocal(data, profile));
                        toast.success(isUrdu ? "کیس تازہ ترین ہو گیا" : "Case refreshed");
                      }
                    }} />
                  </div>
                  <p className={`mt-1 ${sub}`}>{selectedCase.customerName} • {selectedCase.country} • {selectedCase.jobType}</p>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { const url = `${window.location.origin}/admin/cases/${selectedCase.id}`; copyToClipboard(url).then(() => { setLinkCopied(true); toast.success(isUrdu ? "لنک کاپی ہو گیا!" : `Link copied: ${selectedCase.id}`); setTimeout(() => setLinkCopied(false), 2000); }).catch(() => {}); }} className={`p-2 rounded-lg transition-colors ${linkCopied ? "text-green-500 bg-green-50 dark:bg-green-900/20" : dc ? "text-gray-400 hover:bg-gray-700 hover:text-blue-400" : "text-gray-400 hover:bg-blue-50 hover:text-blue-600"}`} title={isUrdu ? "لنک کاپی" : "Copy Link"}>{linkCopied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}</motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDeleteCase(selectedCase.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-5 h-5" /></motion.button>
                  <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowCaseDetail(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X className="w-5 h-5" /></motion.button>
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
                        {`${conflictState.record.lastModifiedByName} (${conflictState.record.lastModifiedByRole}) modified this case ${conflictState.timeSince}`}
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
                if (lastMod && lastMod.lastModifiedBy !== "admin") {
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

              {/* Tabs */}
              <div className={`flex border-b ${dc ? "border-gray-700" : "border-gray-200"} px-6`}>
                {["overview", "timeline", "documents", "payments", "notes"].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? "border-blue-500 text-blue-600" : `border-transparent ${sub} hover:text-blue-500`}`}>{tab}</button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* Editable Customer Info — all fields sync to Supabase */}
                    <EditableCaseFields
                      caseData={selectedCase}
                      darkMode={dc}
                      isUrdu={isUrdu}
                      userName={adminName}
                      userRole={isMasterAdmin ? "master_admin" : "admin"}
                      onUpdate={(updated) => {
                        setSelectedCase(updated);
                        loadCases();
                      }}
                    />
                    {/* Payment Summary */}
                    <div className={`p-4 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm ${sub}`}>{isUrdu ? "ادائیگی پیش رفت" : "Payment Progress"}</span>
                        <span className={`text-sm font-semibold ${txt}`}>PKR {selectedCase.paidAmount.toLocaleString()} / {selectedCase.totalFee.toLocaleString()}</span>
                      </div>
                      <div className={`w-full h-3 rounded-full ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min((selectedCase.paidAmount / selectedCase.totalFee) * 100, 100)}%` }} />
                      </div>
                      <p className={`text-xs mt-1 ${sub}`}>{isUrdu ? "باقی:" : "Outstanding:"} PKR {(selectedCase.totalFee - selectedCase.paidAmount).toLocaleString()}</p>
                    </div>
                    {/* Status Change */}
                    <div>
                      <label className={labelCls}>Update Status</label>
                      <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="relative flex-1 w-full sm:max-w-xs">
                          <select
                            value={selectedCase.status}
                            onChange={(e) => handleUpdateStatus(selectedCase.id, e.target.value as Case["status"])}
                            className={`w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                              dc
                                ? "bg-gray-700 border-gray-600 text-gray-200 hover:border-blue-500/50"
                                : "bg-white border-gray-200 text-gray-800 hover:border-blue-400"
                            }`}
                          >
                            {(() => {
                              const pType = selectedCase.pipelineType || "visa";
                              const stages = getPipelineStages(pType);
                              return stages.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.stageNumber > 0 ? `${s.stageNumber}. ` : "✕ "}{isUrdu ? s.labelUrdu : s.label}
                                </option>
                              ));
                            })()}
                          </select>
                          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${sub}`} />
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(selectedCase.status)}`}>
                          <span className="w-2 h-2 rounded-full bg-current" />
                          {getStageLabel(selectedCase.status)}
                        </span>
                      </div>
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
                          className={`relative overflow-hidden rounded-xl p-4 border-2 ${
                            oi.isOverdue
                              ? "border-red-500/50 bg-gradient-to-r " + (dc ? "from-red-950/40 to-red-900/20" : "from-red-50 to-orange-50")
                              : oi.hoursRemaining !== null && oi.hoursRemaining < 6
                                ? "border-amber-500/50 bg-gradient-to-r " + (dc ? "from-amber-950/30 to-yellow-900/10" : "from-amber-50 to-yellow-50")
                                : "border-blue-500/30 bg-gradient-to-r " + (dc ? "from-blue-950/20 to-cyan-900/10" : "from-blue-50 to-cyan-50")
                          }`}
                        >
                          {/* Animated pulse for overdue */}
                          {oi.isOverdue && (
                            <motion.div
                              animate={{ opacity: [0.3, 0.6, 0.3] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="absolute inset-0 bg-red-500/5"
                            />
                          )}
                          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <motion.div
                                animate={oi.isOverdue ? { rotate: [0, -10, 10, -10, 0] } : {}}
                                transition={{ duration: 0.6, repeat: oi.isOverdue ? Infinity : 0, repeatDelay: 3 }}
                                className={`p-2 rounded-xl flex-shrink-0 ${
                                  oi.isOverdue ? "bg-red-500/20" : oi.hoursRemaining! < 6 ? "bg-amber-500/20" : "bg-blue-500/20"
                                }`}
                              >
                                {oi.isOverdue ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <Timer className={`w-5 h-5 ${oi.hoursRemaining! < 6 ? "text-amber-500" : "text-blue-500"}`} />}
                              </motion.div>
                              <div>
                                <p className={`text-sm font-bold ${oi.isOverdue ? "text-red-600 dark:text-red-400" : oi.hoursRemaining! < 6 ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}>
                                  {oi.isOverdue ? (isUrdu ? "ڈیڈ لائن گزر چکی!" : "Deadline Exceeded!") : oi.hoursRemaining! < 6 ? (isUrdu ? "ڈیڈ لائن قریب!" : "Deadline Approaching!") : (isUrdu ? "وقت باقی ہے" : "On Track")}
                                </p>
                                <p className={`text-xs mt-0.5 ${sub}`}>
                                  {isUrdu ? "مرحلہ" : "Stage"}: {getStageLabel(selectedCase.status, isUrdu)} — <span className="font-bold">{oi.timeLabel}</span>
                                </p>
                                {selectedCase.delayReason && (
                                  <motion.p
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-1.5 mt-1.5"
                                  >
                                    <MessageSquare className="w-3 h-3 text-orange-500" />
                                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                                      {isUrdu ? "وجہ:" : "Reason:"} {getDelayReasonLabel(selectedCase.delayReason, isUrdu)}
                                    </span>
                                    {selectedCase.delayReportedAt && (
                                      <span className={`text-[10px] ${sub}`}>({new Date(selectedCase.delayReportedAt).toLocaleDateString()})</span>
                                    )}
                                  </motion.p>
                                )}
                              </div>
                            </div>
                            {oi.isOverdue && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={openDelayModal}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-500/20 flex-shrink-0"
                              >
                                <AlertTriangle className="w-4 h-4" />
                                {selectedCase.delayReason ? (isUrdu ? "وجہ اپ ڈیٹ" : "Update Reason") : (isUrdu ? "تاخیر کی وجہ" : "Report Delay")}
                              </motion.button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })()}

                    {/* Visual Timeline Stepper */}
                    <div className={`p-4 rounded-xl border ${dc ? "bg-gray-700/30 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                      <h4 className={`text-sm font-bold mb-3 ${txt}`}>{isUrdu ? "ورک فلو پیش رفت" : "Workflow Progress"}</h4>
                      <VisualTimelineStepper
                        caseData={selectedCase}
                        compact
                        onStageClick={(stageKey) => handleUpdateStatus(selectedCase.id, stageKey)}
                      />
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><DollarSign className="w-4 h-4" /> Record Payment</motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { window.open(`tel:${selectedCase.phone}`); }} className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}><Phone className="w-4 h-4" /> Call</motion.button>
                      <div className="relative">
                        <WhatsAppActions caseData={selectedCase} compact />
                      </div>
                      {!selectedCase.delayReason && getOverdueInfo(selectedCase).hasDeadline && (
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={openDelayModal} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"><AlertTriangle className="w-4 h-4" /> {isUrdu ? "تاخیر رپورٹ" : "Report Delay"}</motion.button>
                      )}
                    </div>

                    {/* Sir Atif Digital Approval — only for master admin on visa pipeline cases */}
                    {isMasterAdmin && selectedCase.pipelineType === "visa" && (
                      <SirAtifApprovalButton
                        caseData={selectedCase}
                        darkMode={dc}
                        isUrdu={isUrdu}
                        userName={adminName}
                        userId="master_admin"
                        onUpdate={async () => {
                          await loadCases();
                          const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                          const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
                          if (refreshed) setSelectedCase(refreshed);
                        }}
                      />
                    )}

                    {/* Cancel / Reopen Case Button */}
                    <div className="flex flex-wrap gap-3">
                      {selectedCase.status !== "visa_cancelled" && selectedCase.status !== "lead_cancelled" && selectedCase.status !== "rejected" ? (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowCancelModal(true)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            dc ? "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20" : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                          {isUrdu ? "کیس منسوخ کریں" : "Cancel Case"}
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowCancelModal(true)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            dc ? "bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/20" : "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                          }`}
                        >
                          <RotateCcw className="w-4 h-4" />
                          {isUrdu ? "کیس دوبارہ کھولیں" : "Reopen Case"}
                        </motion.button>
                      )}
                    </div>

                    {/* WhatsApp Templates Panel */}
                    <WhatsAppActions caseData={selectedCase} />

                    {/* VisaVerse: Admin Mood Feedback Per-Case */}
                    <EmojiMoodTracker
                      stageLabel={getStageLabel(selectedCase.status, isUrdu)}
                      caseId={selectedCase.id}
                      isUrdu={isUrdu}
                      onFeedback={(rating, cId, stage) => {
                        visaverseApi.saveMoodFeedback({
                          caseId: cId,
                          stage,
                          rating,
                          userId: "admin",
                          userRole: "admin",
                        });
                        visaverseApi.trackEvent({
                          featureKey: "emojiTracker",
                          action: "admin_feedback",
                          userId: "admin",
                          userRole: "admin",
                          caseId: cId,
                          metadata: { rating, stage },
                        });
                      }}
                    />
                  </div>
                )}

                {activeTab === "timeline" && (
                  <div className="space-y-6">
                    {/* Visual Workflow Stepper */}
                    <div className={`p-4 rounded-xl border ${dc ? "bg-gray-700/30 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                      <h4 className={`text-sm font-bold mb-4 ${txt}`}>{isUrdu ? "پائپ لائن ورک فلو" : "Pipeline Workflow"}</h4>
                      <VisualTimelineStepper
                        caseData={selectedCase}
                        onStageClick={(stageKey) => handleUpdateStatus(selectedCase.id, stageKey)}
                      />
                    </div>

                    {/* Event Timeline */}
                    <div>
                      <h4 className={`text-sm font-bold mb-3 ${txt}`}>{isUrdu ? "واقعات کی ٹائم لائن" : "Event Timeline"}</h4>
                      {selectedCase.timeline.length === 0 ? (
                        <p className={`text-center py-8 ${sub}`}>No timeline events yet</p>
                      ) : (
                        selectedCase.timeline.map((event, idx) => (
                          <div key={event.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full ${event.type === "status" ? "bg-blue-500" : event.type === "payment" ? "bg-blue-500" : "bg-gray-400"}`} />
                              {idx < selectedCase.timeline.length - 1 && <div className={`w-0.5 flex-1 ${dc ? "bg-gray-600" : "bg-gray-200"}`} />}
                            </div>
                            <div className={`pb-4 flex-1`}>
                              <p className={`text-sm font-semibold ${txt}`}>{event.title}</p>
                              <p className={`text-xs ${sub}`}>{event.description}</p>
                              <p className={`text-xs mt-1 ${sub}`}>{new Date(event.date).toLocaleString()} • {event.user}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
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
                        userRole="admin"
                        userName={adminName}
                        userId="admin"
                        onUpdate={async () => {
                          await loadCases();
                          const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                          const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
                          if (refreshed) setSelectedCase(refreshed);
                        }}
                      />
                    )}

                    {/* VisaVerse: AR Document Scanner */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <ARScannerButton
                        isUrdu={isUrdu}
                        onScanComplete={(quality) => {
                          visaverseApi.trackEvent({
                            featureKey: "arScanner",
                            action: `scan_${quality}`,
                            userId: "admin",
                            userRole: "admin",
                            caseId: selectedCase.id,
                            metadata: { quality },
                          });
                        }}
                      />
                    </div>
                  <DocumentUploadInterface
                    existingDocuments={selectedCase.documents}
                    onUpload={async (files) => {
                      const newDocs: any[] = [];
                      for (let i = 0; i < files.length; i++) {
                        const f = files[i];
                        const docId = `DOC-${Date.now()}-${i}`;
                        // Upload to Supabase Storage (production — real files)
                        try {
                          const uploadRes = await documentUploadApi.uploadForm(f.file, selectedCase.id, docId, {
                            checklistKey: f.category,
                            uploadedBy: adminName,
                            uploadedByRole: isMasterAdmin ? "master_admin" : "admin",
                          });
                          const storagePath = uploadRes.success && uploadRes.data?.storagePath ? uploadRes.data.storagePath : undefined;
                          const signedUrl = uploadRes.success && uploadRes.data?.signedUrl ? uploadRes.data.signedUrl : undefined;
                          newDocs.push({
                            id: docId,
                            name: `${f.category}: ${f.file.name}`,
                            type: f.file.type,
                            uploadDate: new Date().toISOString(),
                            status: "pending" as const,
                            url: signedUrl || "#",
                            storagePath,
                            storageSignedUrl: signedUrl,
                            signedUrlExpiresAt: signedUrl ? new Date(Date.now() + 3600 * 1000).toISOString() : undefined,
                            mimeType: f.file.type,
                            fileSize: f.file.size,
                            notes: `Category: ${f.category}`,
                          });
                        } catch {
                          await DocumentFileStore.storeFile(docId, f.file, adminName);
                          newDocs.push({
                            id: docId,
                            name: `${f.category}: ${f.file.name}`,
                            type: f.file.type,
                            uploadDate: new Date().toISOString(),
                            status: "pending" as const,
                            url: "#",
                            notes: `Category: ${f.category}`,
                          });
                        }
                      }
                      const success = await updateCase(selectedCase.id, {
                        documents: [...selectedCase.documents, ...newDocs],
                      });
                      if (success) {
                        const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                        const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
                        if (refreshed) setSelectedCase(refreshed);
                        newDocs.forEach(d => AuditLogService.logDocumentAction(adminName, "admin", "document_uploaded", selectedCase.id, d.name));
                        DataSyncService.markModified(selectedCase.id, "admin", adminName, "admin", "case", `${newDocs.length} document(s) uploaded`);
                        NotificationService.addNotification({
                          type: "document", priority: "medium",
                          title: "Documents Uploaded",
                          message: `${newDocs.length} document(s) uploaded for case ${selectedCase.id} (${selectedCase.customerName})`,
                          actionable: true, actionUrl: "/admin/cases", actionLabel: "View Case", targetRole: "all",
                        });
                        loadCases();
                      }
                    }}
                    onDocumentVerify={async (docId, status) => {
                      const updatedDocs = selectedCase.documents.map(d =>
                        d.id === docId ? { ...d, status } : d
                      );
                      const success = await updateCase(selectedCase.id, { documents: updatedDocs });
                      if (success) {
                        const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                        const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
                        if (refreshed) setSelectedCase(refreshed);
                        const doc = selectedCase.documents.find(d => d.id === docId);
                        AuditLogService.logDocumentAction(adminName, "admin", status === "verified" ? "document_verified" : "document_rejected", selectedCase.id, doc?.name || docId);
                        DataSyncService.markModified(selectedCase.id, "admin", adminName, "admin", "case", `Document ${status}`);
                        toast.success(`Document ${status === "verified" ? "verified" : "rejected"}!`);
                        loadCases();
                      }
                    }}
                  />
                  </div>
                )}

                {activeTab === "payments" && (
                  <div className="space-y-3">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowPaymentModal(true)} className="w-full py-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Add Payment
                    </motion.button>
                    {selectedCase.payments.length === 0 ? (
                      <p className={`text-center py-8 ${sub}`}>No payments recorded</p>
                    ) : (
                      selectedCase.payments.map((p) => (
                        <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                          <div>
                            <p className={`text-sm font-semibold ${txt}`}>PKR {p.amount.toLocaleString()}</p>
                            <p className={`text-xs ${sub}`}>{p.description} • {p.method} • {new Date(p.date).toLocaleDateString()}</p>
                          </div>
                          <span className="text-xs text-blue-600 font-mono">{p.receiptNumber}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "notes" && (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <input type="text" value={newNote.text} onChange={(e) => setNewNote({ ...newNote, text: e.target.value })} placeholder="Add a note..." className={`${inputCls} flex-1`} onKeyDown={(e) => e.key === "Enter" && handleAddNote()} />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newNote.important} onChange={(e) => setNewNote({ ...newNote, important: e.target.checked })} className="rounded" />
                        <span className={`text-xs ${sub}`}>Important</span>
                      </label>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAddNote} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"><Send className="w-4 h-4" /></motion.button>
                    </div>
                    {selectedCase.notes.length === 0 ? (
                      <p className={`text-center py-8 ${sub}`}>No notes yet</p>
                    ) : (
                      selectedCase.notes.map((n) => (
                        <div key={n.id} className={`p-3 rounded-xl border-l-4 ${n.important ? "border-red-500" : "border-blue-500"} ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                          <p className={`text-sm ${txt}`}>{n.text}</p>
                          <p className={`text-xs mt-1 ${sub}`}>{n.author} • {new Date(n.date).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== PAYMENT CONFIRMATION MODAL ========== */}
      {selectedCase && (
        <PaymentConfirmationModal
          caseData={selectedCase}
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onPaymentRecorded={(updatedCase) => {
            setSelectedCase(updatedCase);
            NotificationService.notifyPaymentReceived(updatedCase.id, updatedCase.paidAmount, updatedCase.customerName);
            loadCases();
          }}
        />
      )}

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
              {/* Header with animated gradient */}
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

              {/* Stage info bar */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`mx-5 mt-4 p-3 rounded-xl flex items-center justify-between ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}
              >
                <div>
                  <p className={`text-xs ${sub}`}>{isUrdu ? "موجودہ مرحلہ" : "Current Stage"}</p>
                  <p className={`text-sm font-bold ${txt}`}>{getStageLabel(selectedCase.status, isUrdu)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs ${sub}`}>{isUrdu ? "حالت" : "Status"}</p>
                  <p className="text-sm font-bold text-red-500">{getOverdueInfo(selectedCase).timeLabel}</p>
                </div>
              </motion.div>

              {/* Step indicator */}
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
                            onClick={() => {
                              setSelectedDelayReason(reason.value);
                              // Auto-advance to notes step
                              setTimeout(() => setDelayStep("note"), 200);
                            }}
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
                              {selectedDelayReason === reason.value && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </motion.div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${selectedDelayReason === reason.value ? "text-red-600 dark:text-red-400" : txt}`}>
                                {isUrdu ? reason.labelUrdu : reason.label}
                              </p>
                            </div>
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
                      {/* Selected reason summary */}
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${dc ? "bg-red-950/30 border border-red-900/50" : "bg-red-50 border border-red-200"}`}
                      >
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <div className="flex-1">
                          <p className={`text-xs ${sub}`}>{isUrdu ? "منتخب وجہ:" : "Selected reason:"}</p>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">
                            {getDelayReasonLabel(selectedDelayReason, isUrdu)}
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setDelayStep("reason")}
                          className={`text-xs px-2 py-1 rounded-lg ${dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
                        >
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
                        placeholder={isUrdu ? "تفصیلات یہاں لکھیں..." : "Describe the delay situation in detail..."}
                        className={`${inputCls} resize-none`}
                      />
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className={`mt-3 p-3 rounded-xl ${dc ? "bg-gray-700/50" : "bg-amber-50"}`}
                      >
                        <p className={`text-xs ${dc ? "text-amber-400" : "text-amber-700"} flex items-start gap-2`}>
                          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          {isUrdu
                            ? "یہ نوٹ کیس ٹائم لائن میں شامل ہو جائے گا اور ایجنٹ کو مطلع کیا جائے گا۔"
                            : "This will be logged in the case timeline and the assigned agent will be notified."
                          }
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`flex gap-3 p-5 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}
              >
                {delayStep === "note" && (
                  <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setDelayStep("reason")}
                    className={`px-5 py-2.5 rounded-xl border text-sm font-medium ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  >
                    {isUrdu ? "واپس" : "Back"}
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDelayModal(false)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {isUrdu ? "منسوخ" : "Cancel"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={delayStep === "reason" ? () => { if (selectedDelayReason) setDelayStep("note"); else toast.error(isUrdu ? "وجہ منتخب کریں" : "Select a reason first"); } : handleReportDelay}
                  disabled={delayStep === "note" && (isLoading || !selectedDelayReason)}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                  {delayStep === "reason" ? (
                    <>{isUrdu ? "اگلا" : "Next"} <ChevronRight className="w-4 h-4" /></>
                  ) : isLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
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

      {/* ========== BULK STATUS CHANGE MODAL (Improvement #8) ========== */}
      <AnimatePresence>
        {showBulkStatusModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowBulkStatusModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl shadow-2xl ${dc ? "bg-gray-800" : "bg-white"} overflow-hidden`}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-4 text-white">
                <h3 className="text-lg font-bold">Bulk Status Change</h3>
                <p className="text-sm text-white/80">{bulkSelected.size} cases selected</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${txt}`}>New Status</label>
                  <select
                    value={bulkTargetStatus}
                    onChange={(e) => setBulkTargetStatus(e.target.value as Case["status"])}
                    className={`w-full px-4 py-3 rounded-xl border ${dc ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                  >
                    <optgroup label="Lead Pipeline">
                      {LEAD_PIPELINE_STAGES.filter(s => s.stageNumber > 0).map(s => (
                        <option key={s.key} value={s.key}>{s.label} ({isUrdu ? s.labelUrdu : `Stage ${s.stageNumber}`})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Visa Pipeline">
                      {VISA_PIPELINE_STAGES.filter(s => s.stageNumber > 0).map(s => (
                        <option key={s.key} value={s.key}>{s.label} ({isUrdu ? s.labelUrdu : `Stage ${s.stageNumber}`})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={async () => {
                      const ids = Array.from(bulkSelected);
                      let updated = 0;
                      for (const cid of ids) {
                        const result = await updateCaseStatus(cid, bulkTargetStatus);
                        if (result) updated++;
                      }
                      toast.success(`${updated} cases updated to ${getStageLabel(bulkTargetStatus)}`);
                      setShowBulkStatusModal(false);
                      setBulkSelected(new Set());
                      setBulkMode(false);
                      loadCases();
                    }}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-sm"
                  >
                    Apply to {bulkSelected.size} Cases
                  </button>
                  <button
                    onClick={() => setShowBulkStatusModal(false)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium ${dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== CANCELLATION / REOPEN MODAL ========== */}
      {showCancelModal && selectedCase && (
        <CancellationReopenModal
          caseData={selectedCase}
          darkMode={dc}
          isUrdu={isUrdu}
          userName={adminName}
          userId={isMasterAdmin ? "master_admin" : "admin"}
          onClose={() => setShowCancelModal(false)}
          onUpdate={async () => {
            await loadCases();
            const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
            const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
            if (refreshed) setSelectedCase(refreshed);
          }}
        />
      )}

      {/* ========== ADD STAFF MODAL ========== */}
      <AddStaffModal
        isOpen={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        darkMode={dc}
        isUrdu={isUrdu}
        createdBy={adminName}
        createdByRole={isMasterAdmin ? "master_admin" : "admin"}
        onCreated={loadCases}
      />

    </div>
  );
}