/**
 * AdminDocumentCenter — Unified Document Management
 *
 * Replaces both AdminDocuments.tsx and AdminAllDocuments.tsx with a single
 * view that supports:
 *   • Case-wise dropdown filtering & full-text search
 *   • Real file uploads to Supabase Storage
 *   • Live thumbnails via signed URLs from Supabase
 *   • Verify / reject / delete workflows
 */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { usePortalPrefix } from "../../lib/usePortalPrefix";
import {
  FolderOpen, Search, Download, Eye, FileText, Image as ImageIcon,
  File as FileIcon, Package, CheckCircle2, Clock, XCircle, RefreshCw,
  Upload, Plus, X, MoreVertical, Trash2, Shield, ChevronDown, Filter,
  Loader2, ExternalLink, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { CRMDataStore, Case, Document } from "../../lib/mockData";
import { toast } from "../../lib/toast";
import { documentUploadApi, documentStorageApi } from "../../lib/api";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { AuditLogService } from "../../lib/auditLog";

// ── Types ───────────────────────────────────────────────────
interface DocWithMeta extends Document {
  caseId: string;
  customerName: string;
  country: string;
}

type StatusFilter = "all" | "pending" | "verified" | "rejected";

// ── Helpers ─────────────────────────────────────────────────
function fileIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("image") || t.includes("photo") || t.includes("jpg") || t.includes("png")) return ImageIcon;
  if (t.includes("pdf")) return FileText;
  return FileIcon;
}

function statusBadge(s: Document["status"], dc: boolean) {
  if (s === "verified") return { cls: dc ? "bg-green-900/40 text-green-400 border-green-700/30" : "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 };
  if (s === "rejected") return { cls: dc ? "bg-red-900/40 text-red-400 border-red-700/30" : "bg-red-50 text-red-700 border-red-200", icon: XCircle };
  return { cls: dc ? "bg-yellow-900/40 text-yellow-400 border-yellow-700/30" : "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock };
}

// ═════════════════════════════════════════════════════════════
export function AdminDocumentCenter() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const prefix = usePortalPrefix();
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const inputBg = dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400";

  // ── State ─────────────────────────────────────────────────
  const [cases, setCases] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCaseId, setUploadCaseId] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [actionDocId, setActionDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load cases ────────────────────────────────────────────
  const loadCases = useCallback(() => {
    setCases(CRMDataStore.getCases());
  }, []);

  useEffect(() => {
    loadCases();
    const iv = setInterval(loadCases, 15000);
    return () => clearInterval(iv);
  }, [loadCases]);

  // ── Flatten docs with case metadata ───────────────────────
  const allDocs: DocWithMeta[] = useMemo(() => {
    const result: DocWithMeta[] = [];
    for (const c of cases) {
      if (!c.documents || c.documents.length === 0) continue;
      for (const doc of c.documents) {
        result.push({
          ...doc,
          caseId: c.id,
          customerName: c.customerName,
          country: c.country || "",
        });
      }
    }
    return result.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  }, [cases]);

  // ── Filtered docs ─────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    return allDocs.filter(d => {
      if (selectedCaseId !== "all" && d.caseId !== selectedCaseId) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return d.name.toLowerCase().includes(q) ||
          d.caseId.toLowerCase().includes(q) ||
          d.customerName.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allDocs, selectedCaseId, statusFilter, searchTerm]);

  // ── Unique cases for dropdown ─────────────────────────────
  const casesWithDocs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const d of allDocs) {
      const existing = map.get(d.caseId);
      if (existing) existing.count++;
      else map.set(d.caseId, { id: d.caseId, name: d.customerName, count: 1 });
    }
    return Array.from(map.values());
  }, [allDocs]);

  // ── Fetch signed URLs for visible docs ────────────────────
  const fetchSignedUrls = useCallback(async () => {
    const paths: string[] = [];
    for (const d of filteredDocs) {
      if (d.storagePath && !signedUrls[d.id]) paths.push(d.storagePath);
    }
    if (paths.length === 0) return;

    setLoadingUrls(true);
    try {
      const res = await documentUploadApi.batchSignedUrls(paths);
      if (res.success && res.data) {
        const newUrls: Record<string, string> = {};
        for (const d of filteredDocs) {
          if (d.storagePath && (res.data as any)[d.storagePath]) {
            newUrls[d.id] = (res.data as any)[d.storagePath];
          }
        }
        setSignedUrls(prev => ({ ...prev, ...newUrls }));
      }
    } catch (err) {
      console.error("Failed to fetch signed URLs:", err);
    } finally {
      setLoadingUrls(false);
    }
  }, [filteredDocs, signedUrls]);

  useEffect(() => {
    fetchSignedUrls();
  }, [filteredDocs.length]);

  // ── Get real preview URL for a doc ────────────────────────
  const getPreviewUrl = (doc: DocWithMeta): string | null => {
    if (signedUrls[doc.id]) return signedUrls[doc.id];
    if (doc.storageSignedUrl && doc.signedUrlExpiresAt && new Date(doc.signedUrlExpiresAt) > new Date()) return doc.storageSignedUrl;
    const url = doc.url;
    if (url && url !== "#" && url.trim() !== "" && (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:"))) return url;
    return null;
  };

  // ── Upload handler ────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadCaseId) { toast.error("Select a case first"); return; }
    if (uploadFiles.length === 0) { toast.error("Choose at least one file"); return; }

    setUploading(true);
    setUploadProgress(0);
    let successCount = 0;

    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i];
      setUploadProgress(Math.round(((i) / uploadFiles.length) * 100));

      const docId = `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      try {
        // 1. Upload to Supabase Storage
        const uploadRes = await documentUploadApi.uploadForm(file, uploadCaseId, docId, {
          uploadedBy: "admin",
          uploadedByRole: "admin",
        });

        if (!uploadRes.success) {
          toast.error(`Failed to upload ${file.name}: ${uploadRes.error}`);
          continue;
        }

        // 2. Add document metadata to case
        const storagePath = uploadRes.data?.storagePath || `${uploadCaseId}/${docId}/${file.name}`;
        const signedUrl = uploadRes.data?.signedUrl || "";

        // Directly push to the case documents array to preserve all metadata
        const allCases = CRMDataStore.getCases();
        const caseIdx = allCases.findIndex(c => c.id === uploadCaseId);
        if (caseIdx !== -1) {
          if (!allCases[caseIdx].documents) allCases[caseIdx].documents = [];
          allCases[caseIdx].documents.push({
            id: docId,
            name: file.name,
            type: file.type || "application/octet-stream",
            uploadDate: new Date().toISOString(),
            status: "pending",
            url: signedUrl || "#",
            storagePath,
            storageSignedUrl: signedUrl,
            signedUrlExpiresAt: signedUrl ? new Date(Date.now() + 3600 * 1000).toISOString() : undefined,
            mimeType: file.type,
            fileSize: file.size,
            uploadedByRole: "admin",
          } as any);
          allCases[caseIdx].updatedDate = new Date().toISOString();
          CRMDataStore.saveCases(allCases);
        }

        // Cache the signed URL
        if (signedUrl) {
          setSignedUrls(prev => ({ ...prev, [docId]: signedUrl }));
        }

        successCount++;
      } catch (err) {
        console.error(`Upload error for ${file.name}:`, err);
        toast.error(`Error uploading ${file.name}`);
      }
    }

    setUploadProgress(100);

    if (successCount > 0) {
      AuditLogService.log({
        userId: "admin", userName: "Admin", role: "admin",
        action: "document_uploaded",
        category: "document",
        description: `Uploaded ${successCount} document(s) to case ${uploadCaseId}`,
        metadata: { caseId: uploadCaseId, count: successCount },
      });
      toast.success(`${successCount} file(s) uploaded to Supabase Storage`);
      loadCases();
    }

    setShowUploadModal(false);
    setUploadFiles([]);
    setUploadCaseId("");
    setUploading(false);
  };

  // ── Verify / Reject / Delete handlers ─────────────────────
  const handleVerify = (caseId: string, docId: string) => {
    const allCases = CRMDataStore.getCases();
    const c = allCases.find(c => c.id === caseId);
    if (!c) return;
    const doc = c.documents?.find(d => d.id === docId);
    if (!doc) return;
    doc.status = "verified";
    doc.verifiedBy = "Admin";
    doc.verifiedAt = new Date().toISOString();
    CRMDataStore.saveCases(allCases);
    toast.success(`${doc.name} verified`);
    setActionDocId(null);
    loadCases();
  };

  const handleReject = (caseId: string, docId: string) => {
    const allCases = CRMDataStore.getCases();
    const c = allCases.find(c => c.id === caseId);
    if (!c) return;
    const doc = c.documents?.find(d => d.id === docId);
    if (!doc) return;
    doc.status = "rejected";
    doc.rejectionReason = "Document not meeting requirements";
    CRMDataStore.saveCases(allCases);
    toast.success(`${doc.name} rejected`);
    setActionDocId(null);
    loadCases();
  };

  const handleDelete = async (caseId: string, docId: string) => {
    const allCases = CRMDataStore.getCases();
    const c = allCases.find(c => c.id === caseId);
    if (!c || !c.documents) return;
    const doc = c.documents.find(d => d.id === docId);
    if (!doc) return;

    // Delete from Supabase Storage if path exists
    if (doc.storagePath) {
      try {
        const parts = doc.storagePath.split("/");
        if (parts.length >= 2) {
          await documentStorageApi.remove(parts.slice(0, -1).join("/"), parts[parts.length - 1]);
        }
      } catch (err) {
        console.error("Storage delete error:", err);
      }
    }

    c.documents = c.documents.filter(d => d.id !== docId);
    CRMDataStore.saveCases(allCases);
    toast.success(`${doc.name} deleted`);
    setActionDocId(null);
    loadCases();
  };

  // ── Download via signed URL ───────────────────────────────
  const handleDownload = async (doc: DocWithMeta) => {
    const url = getPreviewUrl(doc);
    if (url) {
      window.open(url, "_blank");
      return;
    }
    // Try to get fresh signed URL
    if (doc.storagePath) {
      const parts = doc.storagePath.split("/");
      if (parts.length >= 2) {
        const res = await documentStorageApi.getSignedUrl(parts.slice(0, -1).join("/"), parts[parts.length - 1]);
        if (res.success && res.data?.signedUrl) {
          window.open(res.data.signedUrl, "_blank");
          return;
        }
      }
    }
    toast.error("No downloadable file found");
  };

  // ── Preview / Lightbox ────────────────────────────────────
  const handlePreview = async (doc: DocWithMeta) => {
    let url = getPreviewUrl(doc);
    if (!url && doc.storagePath) {
      const parts = doc.storagePath.split("/");
      if (parts.length >= 2) {
        const res = await documentStorageApi.getSignedUrl(parts.slice(0, -1).join("/"), parts[parts.length - 1]);
        if (res.success && res.data?.signedUrl) {
          url = res.data.signedUrl;
          setSignedUrls(prev => ({ ...prev, [doc.id]: res.data!.signedUrl! }));
        }
      }
    }
    if (url) {
      const mimeType = (doc.mimeType || doc.type || "").toLowerCase();
      if (mimeType.includes("image") || mimeType.includes("jpg") || mimeType.includes("png") || mimeType.includes("jpeg")) {
        setLightboxSrc(url);
        setLightboxAlt(doc.name);
      } else {
        window.open(url, "_blank");
      }
    } else {
      toast.error("Preview unavailable — file not yet in storage");
    }
  };

  // ── Stats ─────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: allDocs.length,
    pending: allDocs.filter(d => d.status === "pending").length,
    verified: allDocs.filter(d => d.status === "verified").length,
    rejected: allDocs.filter(d => d.status === "rejected").length,
  }), [allDocs]);

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <div className={`${isUrdu ? fontClass : ""} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      <main className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
          <div>
            <h1 className={`text-xl md:text-2xl font-bold ${txt}`}>
              {isUrdu ? "📄 دستاویز مرکز" : "📄 Document Center"}
            </h1>
            <p className={`text-sm ${sub} mt-0.5`}>
              {isUrdu ? "تمام کیسز کی دستاویزات ایک جگہ" : "All case documents in one place — real Supabase Storage"}
            </p>
          </div>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={loadCases}
              className={`p-2.5 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl shadow-lg text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              {isUrdu ? "اپلوڈ" : "Upload Document"}
            </motion.button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total", value: stats.total, cls: "from-blue-500 to-blue-600" },
            { label: "Pending", value: stats.pending, cls: "from-yellow-500 to-yellow-600" },
            { label: "Verified", value: stats.verified, cls: "from-green-500 to-green-600" },
            { label: "Rejected", value: stats.rejected, cls: "from-red-500 to-red-600" },
          ].map(s => (
            <div key={s.label} className={`${card} rounded-xl border ${brd} p-4`}>
              <p className={`text-xs ${sub} mb-1`}>{s.label}</p>
              <p className={`text-2xl font-bold bg-gradient-to-r ${s.cls} bg-clip-text text-transparent`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters Bar */}
        <div className={`${card} rounded-xl border ${brd} p-3 sm:p-4 mb-5`}>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={isUrdu ? "نام، کیس آئی ڈی، قسم..." : "Search name, case ID, type..."}
                className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm ${inputBg} focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
              />
            </div>

            {/* Case dropdown */}
            <div className="relative min-w-[200px]">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={selectedCaseId}
                onChange={e => setSelectedCaseId(e.target.value)}
                className={`w-full pl-9 pr-8 py-2.5 border rounded-xl text-sm appearance-none ${inputBg} focus:ring-2 focus:ring-emerald-500`}
              >
                <option value="all">{isUrdu ? "تمام کیسز" : `All Cases (${allDocs.length})`}</option>
                {casesWithDocs.map(c => (
                  <option key={c.id} value={c.id}>{c.id} — {c.name} ({c.count})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Status filter */}
            <div className="flex gap-1.5">
              {(["all", "pending", "verified", "rejected"] as StatusFilter[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-emerald-600 text-white"
                      : (dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                  }`}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Document Grid */}
        {filteredDocs.length === 0 ? (
          <div className={`${card} rounded-xl border ${brd} p-12 text-center`}>
            <Package className={`w-12 h-12 mx-auto mb-3 ${sub}`} />
            <p className={`text-lg font-semibold ${txt}`}>{isUrdu ? "کوئی دستاویز نہیں ملی" : "No documents found"}</p>
            <p className={`text-sm ${sub} mt-1`}>
              {selectedCaseId !== "all" || searchTerm
                ? (isUrdu ? "فلٹرز تبدیل کریں" : "Try adjusting your filters")
                : (isUrdu ? "کیس بنائیں اور دستاویزات اپلوڈ کریں" : "Create a case and upload documents to get started")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocs.map(doc => {
              const Icon = fileIcon(doc.mimeType || doc.type);
              const badge = statusBadge(doc.status, dc);
              const BadgeIcon = badge.icon;
              const previewUrl = getPreviewUrl(doc);
              const isImage = (doc.mimeType || doc.type || "").toLowerCase().match(/image|jpg|jpeg|png|gif|webp/);

              return (
                <motion.div key={`${doc.caseId}-${doc.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${card} rounded-xl border ${brd} overflow-hidden hover:shadow-lg transition-shadow group relative`}
                >
                  {/* Thumbnail / Preview Area */}
                  <div
                    className={`h-36 relative flex items-center justify-center cursor-pointer overflow-hidden ${
                      dc ? "bg-gray-700/50" : "bg-gray-100"
                    }`}
                    onClick={() => handlePreview(doc)}
                  >
                    {previewUrl && isImage ? (
                      <img
                        src={previewUrl}
                        alt={doc.name}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : previewUrl && !isImage ? (
                      <div className="flex flex-col items-center gap-2">
                        <Icon className={`w-10 h-10 ${dc ? "text-gray-400" : "text-gray-500"}`} />
                        <span className={`text-[10px] font-medium ${sub}`}>Click to open</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Icon className={`w-10 h-10 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                        <span className={`text-[10px] ${sub}`}>No preview</span>
                      </div>
                    )}

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>

                    {/* Status badge */}
                    <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.cls}`}>
                      <BadgeIcon className="w-3 h-3" />
                      {doc.status}
                    </div>

                    {/* Supabase Storage indicator */}
                    {doc.storagePath && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-600/80 text-white text-[9px] font-bold flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" /> Supabase
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className={`text-sm font-semibold truncate ${txt}`} title={doc.name}>{doc.name}</p>
                    <p className={`text-xs ${sub} mt-0.5 truncate`}>
                      {doc.caseId} — {doc.customerName}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] ${sub}`}>
                        {new Date(doc.uploadDate).toLocaleDateString()}
                        {doc.fileSize ? ` · ${(doc.fileSize / 1024).toFixed(0)} KB` : ""}
                      </span>

                      {/* Actions */}
                      <div className="relative">
                        <button
                          onClick={e => { e.stopPropagation(); setActionDocId(actionDocId === doc.id ? null : doc.id); }}
                          className={`p-1 rounded-lg ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>

                        <AnimatePresence>
                          {actionDocId === doc.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className={`absolute right-0 bottom-full mb-1 ${dc ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"} border rounded-xl shadow-xl z-20 py-1.5 w-40`}
                            >
                              <button onClick={() => handlePreview(doc)} className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${dc ? "hover:bg-gray-600 text-gray-200" : "hover:bg-gray-50 text-gray-700"}`}>
                                <Eye className="w-3.5 h-3.5" /> Preview
                              </button>
                              <button onClick={() => handleDownload(doc)} className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${dc ? "hover:bg-gray-600 text-gray-200" : "hover:bg-gray-50 text-gray-700"}`}>
                                <Download className="w-3.5 h-3.5" /> Download
                              </button>
                              {doc.status !== "verified" && (
                                <button onClick={() => handleVerify(doc.caseId, doc.id)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-green-600 hover:bg-green-50">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                                </button>
                              )}
                              {doc.status !== "rejected" && (
                                <button onClick={() => handleReject(doc.caseId, doc.id)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-orange-600 hover:bg-orange-50">
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              )}
                              <hr className={dc ? "border-gray-600" : "border-gray-100"} />
                              <button onClick={() => handleDelete(doc.caseId, doc.id)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-600 hover:bg-red-50">
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Upload Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !uploading && setShowUploadModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-lg`}
            >
              <div className={`flex items-center justify-between p-5 border-b ${brd}`}>
                <h2 className={`text-lg font-bold ${txt}`}>
                  {isUrdu ? "دستاویز اپلوڈ — سوپا بیس سٹوریج" : "Upload to Supabase Storage"}
                </h2>
                <button onClick={() => !uploading && setShowUploadModal(false)} className={`p-2 rounded-xl ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Case Selection */}
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${dc ? "text-gray-300" : "text-gray-600"}`}>
                    {isUrdu ? "کیس منتخب کریں" : "Select Case *"}
                  </label>
                  <select
                    value={uploadCaseId}
                    onChange={e => setUploadCaseId(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm ${inputBg} focus:ring-2 focus:ring-emerald-500`}
                  >
                    <option value="">{isUrdu ? "کیس منتخب کریں..." : "Choose a case..."}</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.id} — {c.customerName}</option>
                    ))}
                  </select>
                </div>

                {/* File Selection */}
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${dc ? "text-gray-300" : "text-gray-600"}`}>
                    {isUrdu ? "فائلز" : "Files *"}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={e => setUploadFiles(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                      uploadFiles.length > 0
                        ? (dc ? "border-emerald-600 bg-emerald-900/10" : "border-emerald-400 bg-emerald-50")
                        : (dc ? "border-gray-600 hover:border-gray-500" : "border-gray-300 hover:border-gray-400")
                    }`}
                  >
                    {uploadFiles.length === 0 ? (
                      <>
                        <Upload className={`w-8 h-8 mx-auto mb-2 ${sub}`} />
                        <p className={`text-sm ${sub}`}>{isUrdu ? "یہاں کلک کریں — PNG, JPG, PDF" : "Click to select files — PNG, JPG, PDF"}</p>
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        {uploadFiles.map((f, i) => (
                          <div key={i} className={`flex items-center gap-2 text-xs ${txt}`}>
                            <FileText className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="truncate">{f.name}</span>
                            <span className={sub}>({(f.size / 1024).toFixed(0)} KB)</span>
                          </div>
                        ))}
                        <p className={`text-[10px] ${sub} mt-2`}>Click to change files</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Storage info */}
                <div className={`flex items-start gap-2 p-3 rounded-lg ${dc ? "bg-emerald-900/20 border border-emerald-700/30" : "bg-emerald-50 border border-emerald-200"}`}>
                  <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className={`text-xs ${dc ? "text-emerald-400" : "text-emerald-700"}`}>
                    {isUrdu
                      ? "فائلز براہ راست سوپا بیس سٹوریج بکٹ میں اپلوڈ ہوں گی۔ سائنڈ یو آر ایل سے پریویو اور ڈاؤن لوڈ ہوگا۔"
                      : "Files upload directly to Supabase Storage bucket. Preview & download use signed URLs."}
                  </p>
                </div>

                {/* Progress bar */}
                {uploading && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${sub}`}>Uploading...</span>
                      <span className="text-xs font-bold text-emerald-600">{uploadProgress}%</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                      <motion.div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={`p-5 border-t ${brd} flex gap-3 justify-end`}>
                <button
                  onClick={() => !uploading && setShowUploadModal(false)}
                  disabled={uploading}
                  className={`px-5 py-2.5 border rounded-xl text-sm ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"} disabled:opacity-50`}
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpload}
                  disabled={uploading || !uploadCaseId || uploadFiles.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading..." : (isUrdu ? "اپلوڈ شروع" : "Upload to Storage")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={lightboxAlt}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}