import { useState, useRef, useCallback } from "react";
import {
  FileText, Search, X, Upload, Download, Check, Eye, Loader2, Clock, CheckCircle, XCircle, RotateCcw, ShieldCheck, Filter, LayoutGrid, LayoutList, Camera, FolderPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../../lib/toast";
import { type Case } from "../../../lib/mockData";
import { updateCase } from "../../../lib/caseApi";
import { supabase } from "../../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../../lib/caseMappers";
import { uploadFile, getSignedUrl } from "../../../lib/storageService";
import { ImageLightbox } from "../../../components/ImageLightbox";

interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

type DocViewMode = "list" | "grid";

function isImageDoc(doc: { type: string; name: string }) {
  return doc.type === "image" || ["image", "photos", "photo"].includes(doc.type.toLowerCase()) || !!doc.name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i);
}

export function DocumentsSection({ u, dc, card, txt, sub, inputCls, bigBtn, cases, addNotification, onCaseUpdated }: any) {
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [caseSearch, setCaseSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");
  const [docTypeFilter, setDocTypeFilter] = useState<"all" | "image" | "document">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<DocViewMode>("list");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brd = dc ? "border-gray-700" : "border-gray-200";
  const isUploading = uploadQueue.some(q => q.status === "uploading" || q.status === "queued");

  const filteredCases = (cases as Case[]).filter((c: Case) =>
    !caseSearch || c.customerName.toLowerCase().includes(caseSearch.toLowerCase()) || c.id.toLowerCase().includes(caseSearch.toLowerCase())
  );

  const selectedCase = (cases as Case[]).find((c: Case) => c.id === selectedCaseId);

  // ── Filtered documents within the selected case ──
  const filteredDocs = selectedCase?.documents.filter(doc => {
    if (docSearch && !doc.name.toLowerCase().includes(docSearch.toLowerCase()) && !doc.type.toLowerCase().includes(docSearch.toLowerCase())) return false;
    if (docStatusFilter !== "all" && doc.status !== docStatusFilter) return false;
    if (docTypeFilter !== "all") {
      const isImg = isImageDoc(doc);
      if (docTypeFilter === "image" && !isImg) return false;
      if (docTypeFilter === "document" && isImg) return false;
    }
    return true;
  }) || [];

  const statusCounts = selectedCase ? {
    all: selectedCase.documents.length,
    pending: selectedCase.documents.filter(d => d.status === "pending").length,
    verified: selectedCase.documents.filter(d => d.status === "verified").length,
    rejected: selectedCase.documents.filter(d => d.status === "rejected").length,
  } : { all: 0, pending: 0, verified: 0, rejected: 0 };

  // ── Upload a single file (shared by processQueue & retrySingle) ──
  const uploadSingleFile = useCallback(async (item: UploadQueueItem, currentDocs: any[]) => {
    setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "uploading", progress: 0, error: undefined } : q));
    try {
      const result = await uploadFile(selectedCaseId, item.file.name, item.file, (pct) => {
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: pct } : q));
      });
      if (result.success && result.path) {
        const newDoc = {
          id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.file.name,
          type: item.file.type.startsWith("image/") ? "image" : "document",
          uploadDate: new Date().toISOString().split("T")[0],
          status: "pending" as const,
          url: result.path,
          notes: "Uploaded by Operator via Documents tab",
        };
        const updatedDocs = [...currentDocs, newDoc];
        await updateCase(selectedCaseId, { documents: updatedDocs });
        const { data } = await supabase.from('cases').select('*').eq('id', selectedCaseId).single();
        const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "done", progress: 100 } : q));
        return { success: true, docs: refreshed ? refreshed.documents : updatedDocs };
      } else {
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "error", error: result.error || "Upload failed" } : q));
        return { success: false, docs: currentDocs };
      }
    } catch (err: any) {
      setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "error", error: err?.message || "Unknown error" } : q));
      return { success: false, docs: currentDocs };
    }
  }, [selectedCaseId]);

  // ── Batch upload handler ──
  const processQueue = useCallback(async (files: File[]) => {
    if (!selectedCaseId) { toast.error(u("Select a case first", "پہلے کیس منتخب کریں")); return; }
    if (files.length === 0) return;

    const items: UploadQueueItem[] = files.map((f, i) => ({
      id: `UQ-${Date.now()}-${i}`,
      file: f,
      progress: 0,
      status: "queued" as const,
    }));
    setUploadQueue(prev => [...prev, ...items]);

    let successCount = 0;
    let currentDocs = (cases as Case[]).find((c: Case) => c.id === selectedCaseId)?.documents || [];

    for (const item of items) {
      const result = await uploadSingleFile(item, currentDocs);
      if (result.success) {
        successCount++;
        currentDocs = result.docs;
      }
    }

    if (successCount > 0) {
      toast.success(successCount === 1
        ? u("Document uploaded!", "دستاویز اپلوڈ ہو گئی!")
        : `${successCount} ${u("documents uploaded!", "دستاویزات اپلوڈ ہو گئیں!")}`
      );
      addNotification(
        `Operator uploaded ${successCount} file(s) to ${selectedCaseId}`,
        `آپریٹر نے ${successCount} فائل(یں) ${selectedCaseId} میں اپلوڈ کیں`,
        "status"
      );
      if (onCaseUpdated) onCaseUpdated();
    }
    setTimeout(() => { setUploadQueue(prev => prev.filter(q => q.status !== "done")); }, 3000);
  }, [selectedCaseId, cases, addNotification, onCaseUpdated, u, uploadSingleFile]);

  // ── Retry all failed uploads ──
  const retryAllFailed = useCallback(async () => {
    const failedItems = uploadQueue.filter(q => q.status === "error");
    if (failedItems.length === 0) return;
    let successCount = 0;
    let currentDocs = (cases as Case[]).find((c: Case) => c.id === selectedCaseId)?.documents || [];
    for (const item of failedItems) {
      const result = await uploadSingleFile(item, currentDocs);
      if (result.success) { successCount++; currentDocs = result.docs; }
    }
    if (successCount > 0) {
      toast.success(`${successCount} ${u("retried successfully!", "دوبارہ کامیاب!")}`);
      if (onCaseUpdated) onCaseUpdated();
    }
    setTimeout(() => { setUploadQueue(prev => prev.filter(q => q.status !== "done")); }, 3000);
  }, [uploadQueue, selectedCaseId, cases, uploadSingleFile, onCaseUpdated, u]);

  // ── Retry single failed upload ──
  const retrySingle = useCallback(async (itemId: string) => {
    const item = uploadQueue.find(q => q.id === itemId);
    if (!item || item.status !== "error") return;
    let currentDocs = (cases as Case[]).find((c: Case) => c.id === selectedCaseId)?.documents || [];
    const result = await uploadSingleFile(item, currentDocs);
    if (result.success) {
      toast.success(u("Retry successful!", "دوبارہ کوشش کامیاب!"));
      if (onCaseUpdated) onCaseUpdated();
    }
    setTimeout(() => { setUploadQueue(prev => prev.filter(q => q.status !== "done")); }, 3000);
  }, [uploadQueue, selectedCaseId, cases, uploadSingleFile, onCaseUpdated, u]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processQueue(files);
    e.target.value = "";
  }, [processQueue]);

  // ── Drag-and-drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === "image/jpeg" || f.type === "image/png" || f.type === "application/pdf"
    );
    if (files.length === 0) { toast.error(u("Unsupported file type", "غیر تعاون شدہ فائل")); return; }
    processQueue(files);
  }, [processQueue, u]);

  const clearQueue = useCallback(() => {
    setUploadQueue(prev => prev.filter(q => q.status === "uploading" || q.status === "queued"));
  }, []);

  // ── View document (lightbox) ──
  const viewDocument = async (doc: { url: string; name: string; id: string }) => {
    setLoadingUrl(doc.id);
    try {
      const result = await getSignedUrl(selectedCaseId, doc.name);
      if (result.success && result.signedUrl) { setLightboxSrc(result.signedUrl); }
      else { setLightboxSrc(doc.url); }
    } catch { setLightboxSrc(doc.url); }
    finally { setLoadingUrl(null); }
  };

  // ── Load thumbnail URL for grid view ──
  const loadThumbnail = useCallback(async (doc: { url: string; name: string; id: string }) => {
    if (thumbnailUrls[doc.id]) return;
    try {
      const result = await getSignedUrl(selectedCaseId, doc.name);
      if (result.success && result.signedUrl) {
        setThumbnailUrls(prev => ({ ...prev, [doc.id]: result.signedUrl! }));
      } else {
        setThumbnailUrls(prev => ({ ...prev, [doc.id]: doc.url }));
      }
    } catch {
      setThumbnailUrls(prev => ({ ...prev, [doc.id]: doc.url }));
    }
  }, [selectedCaseId, thumbnailUrls]);

  // ── Bulk selection helpers ──
  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedDocIds.size === filteredDocs.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredDocs.map(d => d.id)));
    }
  }, [filteredDocs, selectedDocIds]);

  const clearSelection = useCallback(() => setSelectedDocIds(new Set()), []);

  // ── Bulk status change ──
  const bulkChangeStatus = useCallback(async (newStatus: "verified" | "rejected" | "pending") => {
    if (!selectedCase || selectedDocIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const updatedDocs = selectedCase.documents.map(d =>
        selectedDocIds.has(d.id) ? { ...d, status: newStatus } : d
      );
      const ok = await updateCase(selectedCaseId, { documents: updatedDocs });
      if (ok) {
        const { data } = await supabase.from('cases').select('*').eq('id', selectedCaseId).single();
        const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
        const statusLabel = newStatus === "verified" ? u("Verified", "تصدیق شدہ") : newStatus === "rejected" ? u("Rejected", "مسترد") : u("Pending", "زیر التواء");
        toast.success(`${selectedDocIds.size} ${u("documents marked as", "دستاویزات کی حالت")} ${statusLabel}`);
        addNotification(
          `Operator bulk-changed ${selectedDocIds.size} docs to "${newStatus}" in ${selectedCaseId}`,
          `آپریٹر نے ${selectedDocIds.size} دستاویزات کی حالت "${statusLabel}" میں تبدیل کی — ${selectedCaseId}`,
          "status"
        );
        setSelectedDocIds(new Set());
        if (onCaseUpdated) onCaseUpdated();
      }
    } catch (err) {
      toast.error(u("Failed to update status", "حالت تبدیل نہیں ہو سکی"));
    } finally {
      setBulkProcessing(false);
    }
  }, [selectedCase, selectedCaseId, selectedDocIds, addNotification, onCaseUpdated, u]);

  const totalQueueProgress = uploadQueue.length > 0
    ? Math.round(uploadQueue.reduce((sum, q) => sum + q.progress, 0) / uploadQueue.length)
    : 0;
  const doneCount = uploadQueue.filter(q => q.status === "done").length;
  const errorCount = uploadQueue.filter(q => q.status === "error").length;
  const allSelected = filteredDocs.length > 0 && selectedDocIds.size === filteredDocs.length;

  // Helper: status badge
  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
      status === "verified" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
      : status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    }`}>
      {status === "verified" ? u("Verified", "تصدیق شدہ") : status === "rejected" ? u("Rejected", "مسترد") : u("Pending", "زیر التواء")}
    </span>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <h3 className={`text-base font-bold flex items-center gap-2 ${txt}`}>
        <FileText className="w-5 h-5 text-emerald-500" /> {u("Document Management", "دستاویزات کا نظام")}
      </h3>

      {/* ── Case selector ── */}
      <div className="space-y-2">
        <div className="relative">
          <Search className={`absolute ${u("left-3", "right-3")} top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
          <input value={caseSearch} onChange={e => setCaseSearch(e.target.value)} placeholder={u("Search case by name or ID...", "نام یا آئی ڈی سے کیس تلاش کریں...")} className={`${inputCls} ${u("pl-10", "pr-10")}`} />
        </div>
        <select value={selectedCaseId} onChange={e => { setSelectedCaseId(e.target.value); setSelectedDocIds(new Set()); setThumbnailUrls({}); }} className={inputCls}>
          <option value="">{u("— Select a case —", "— کیس منتخب کریں —")}</option>
          {filteredCases.map((c: Case) => <option key={c.id} value={c.id}>{c.id} — {c.customerName} ({c.agentName})</option>)}
        </select>
      </div>

      {selectedCase ? (
        <div className="space-y-3">
          {/* ── Case header + stats ── */}
          <div className={`rounded-xl border p-4 ${card}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`text-sm font-bold ${txt}`}>{selectedCase.customerName}</p>
                <p className={`text-[10px] font-mono ${sub}`}>{selectedCase.id} · {selectedCase.agentName}</p>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { key: "verified" as const, icon: CheckCircle, color: "text-green-500", count: statusCounts.verified },
                  { key: "pending" as const, icon: Clock, color: "text-amber-500", count: statusCounts.pending },
                  { key: "rejected" as const, icon: XCircle, color: "text-red-500", count: statusCounts.rejected },
                ].map(s => (
                  <span key={s.key} className={`flex items-center gap-0.5 text-[10px] font-bold ${s.color}`} title={s.key}>
                    <s.icon className="w-3 h-3" /> {s.count}
                  </span>
                ))}
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${dc ? "bg-emerald-900/30 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>
                  {selectedCase.documents.length} {u("total", "کل")}
                </span>
              </div>
            </div>

            {/* ── Drag-and-drop / batch upload zone ── */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${isUploading ? "opacity-60 cursor-wait" : ""} ${
                dragOver
                  ? (dc ? "border-emerald-400 bg-emerald-900/20 scale-[1.01]" : "border-emerald-500 bg-emerald-50 scale-[1.01]")
                  : (dc ? "border-gray-600 hover:border-emerald-500/50 bg-gray-800/50" : "border-gray-300 hover:border-emerald-400 bg-gray-50")
              }`}
            >
              {dragOver ? (
                <>
                  <Download className="w-10 h-10 mx-auto mb-2 text-emerald-500 animate-bounce" />
                  <p className="text-sm font-bold text-emerald-500">{u("Drop files here!", "فائلیں یہاں چھوڑیں!")}</p>
                </>
              ) : (
                <>
                  <Upload className={`w-8 h-8 mx-auto mb-2 ${sub}`} />
                  <p className={`text-sm font-medium ${txt}`}>{u("Click or drag files to upload", "اپلوڈ کے لیے فائلیں کلک یا ڈریگ کریں")}</p>
                  <p className={`text-[10px] mt-1 ${sub}`}>{u("Supports batch upload — select multiple files at once", "ایک ساتھ کئی فائلیں منتخب کر سکتے ہیں")}</p>
                  <p className={`text-[10px] ${sub}`}>{u("JPG, PNG, PDF only", "صرف JPG، PNG، PDF")}</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileInput} />
          </div>

          {/* ── Upload queue / progress ── */}
          <AnimatePresence>
            {uploadQueue.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`rounded-xl border overflow-hidden ${card}`}
              >
                <div className={`px-4 py-3 border-b ${brd} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-500" />
                    <h4 className={`text-sm font-bold ${txt}`}>
                      {u("Upload Queue", "اپلوڈ قطار")}
                      <span className={`ml-2 text-xs font-normal ${sub}`}>
                        {doneCount}/{uploadQueue.length} {u("complete", "مکمل")}
                        {errorCount > 0 && <span className="text-red-500 ml-1">· {errorCount} {u("failed", "ناکام")}</span>}
                      </span>
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Retry all failed button */}
                    {errorCount > 0 && !isUploading && (
                      <button
                        onClick={retryAllFailed}
                        className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-colors ${dc ? "bg-amber-900/30 text-amber-300 hover:bg-amber-900/50" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                        title={u("Retry all failed", "سب ناکام دوبارہ")}
                      >
                        <RotateCcw className="w-3 h-3" />
                        {u("Retry all", "سب دوبارہ")} ({errorCount})
                      </button>
                    )}
                    {isUploading && (
                      <span className={`text-[10px] font-bold ${sub}`}>{totalQueueProgress}%</span>
                    )}
                    {!isUploading && (
                      <button onClick={clearQueue} className={`p-1.5 rounded-lg transition-colors ${dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`} title={u("Clear queue", "قطار صاف کریں")}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {isUploading && (
                  <div className={`h-1 ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                    <motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${totalQueueProgress}%` }} transition={{ ease: "easeOut" }} />
                  </div>
                )}
                <div className={`max-h-48 overflow-y-auto divide-y ${dc ? "divide-gray-700" : "divide-gray-100"}`}>
                  {uploadQueue.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      {item.status === "uploading" && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-emerald-500" />}
                      {item.status === "queued" && <Clock className="w-4 h-4 shrink-0 text-gray-400" />}
                      {item.status === "done" && <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />}
                      {item.status === "error" && <XCircle className="w-4 h-4 shrink-0 text-red-500" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${txt}`}>{item.file.name}</p>
                        <div className="flex items-center gap-2">
                          <p className={`text-[10px] ${sub}`}>{(item.file.size / 1024).toFixed(0)} KB</p>
                          {item.status === "error" && item.error && (
                            <p className="text-[10px] text-red-400 truncate max-w-[120px]">{item.error}</p>
                          )}
                        </div>
                      </div>
                      {item.status === "uploading" && (
                        <div className={`w-16 h-1.5 rounded-full overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                      {item.status === "error" && !isUploading && (
                        <button
                          onClick={() => retrySingle(item.id)}
                          className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg shrink-0 transition-colors ${dc ? "text-amber-300 hover:bg-amber-900/30" : "text-amber-600 hover:bg-amber-50"}`}
                          title={u("Retry", "دوبارہ")}
                        >
                          <RotateCcw className="w-3 h-3" />
                          {u("Retry", "دوبارہ")}
                        </button>
                      )}
                      {item.status === "error" && isUploading && (
                        <span className="text-[10px] text-red-500 shrink-0">{u("Failed", "ناکام")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Document search & filter bar ── */}
          {selectedCase.documents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className={`absolute ${u("left-3", "right-3")} top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${sub}`} />
                  <input
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    placeholder={u("Search documents...", "دستاویز تلاش کریں...")}
                    className={`w-full px-3 py-2.5 ${u("pl-9", "pr-9")} rounded-lg border text-xs ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-300 placeholder-gray-400"} focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                  />
                  {docSearch && (
                    <button onClick={() => setDocSearch("")} className={`absolute ${u("right-2", "left-2")} top-1/2 -translate-y-1/2`}>
                      <X className={`w-3.5 h-3.5 ${sub} hover:text-red-400`} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                    showFilters || docStatusFilter !== "all" || docTypeFilter !== "all"
                      ? (dc ? "bg-emerald-900/30 border-emerald-700 text-emerald-300" : "bg-emerald-50 border-emerald-300 text-emerald-700")
                      : (dc ? "bg-gray-700 border-gray-600 text-gray-300" : "bg-gray-50 border-gray-300 text-gray-600")
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {u("Filter", "فلٹر")}
                  {(docStatusFilter !== "all" || docTypeFilter !== "all") && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
                {/* View mode toggle */}
                <div className={`flex items-center rounded-lg border overflow-hidden ${dc ? "border-gray-600" : "border-gray-300"}`}>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2.5 transition-colors ${viewMode === "list" ? (dc ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-50 text-emerald-700") : (dc ? "bg-gray-700 text-gray-400 hover:text-gray-200" : "bg-gray-50 text-gray-400 hover:text-gray-600")}`}
                    title={u("List view", "فہرست")}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2.5 transition-colors ${viewMode === "grid" ? (dc ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-50 text-emerald-700") : (dc ? "bg-gray-700 text-gray-400 hover:text-gray-200" : "bg-gray-50 text-gray-400 hover:text-gray-600")}`}
                    title={u("Grid view", "گرڈ")}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={`flex flex-wrap gap-2 p-3 rounded-xl border ${dc ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                      <div className="space-y-1">
                        <p className={`text-[10px] font-bold uppercase ${sub}`}>{u("Status", "حالت")}</p>
                        <div className="flex flex-wrap gap-1">
                          {([
                            ["all", u("All", "سب"), ""],
                            ["pending", u("Pending", "زیر التواء"), ""],
                            ["verified", u("Verified", "تصدیق شدہ"), ""],
                            ["rejected", u("Rejected", "مسترد"), ""],
                          ] as const).map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => setDocStatusFilter(key as any)}
                              className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                                docStatusFilter === key
                                  ? (dc ? "bg-emerald-800 text-emerald-200 ring-1 ring-emerald-500" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400")
                                  : (dc ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200")
                              }`}
                            >
                              {label} {key !== "all" && <span className="opacity-60">({statusCounts[key]})</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className={`text-[10px] font-bold uppercase ${sub}`}>{u("Type", "قسم")}</p>
                        <div className="flex flex-wrap gap-1">
                          {([
                            ["all", u("All", "سب")],
                            ["image", u("Images", "تصاویر")],
                            ["document", u("Documents", "دستاویزات")],
                          ] as const).map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => setDocTypeFilter(key as any)}
                              className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                                docTypeFilter === key
                                  ? (dc ? "bg-emerald-800 text-emerald-200 ring-1 ring-emerald-500" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400")
                                  : (dc ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200")
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(docStatusFilter !== "all" || docTypeFilter !== "all" || docSearch) && (
                        <button
                          onClick={() => { setDocStatusFilter("all"); setDocTypeFilter("all"); setDocSearch(""); }}
                          className={`text-[10px] px-2.5 py-1 rounded-full font-medium self-end ${dc ? "text-red-400 hover:bg-red-900/20" : "text-red-500 hover:bg-red-50"}`}
                        >
                          {u("Clear all", "سب صاف کریں")} ✕
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Bulk action bar (appears when docs are selected) ── */}
          <AnimatePresence>
            {selectedDocIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`rounded-xl border p-3 flex flex-wrap items-center gap-2 ${dc ? "bg-emerald-900/20 border-emerald-800" : "bg-emerald-50 border-emerald-200"}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className={`text-xs font-bold ${txt}`}>
                    {selectedDocIds.size} {u("selected", "منتخب")}
                  </span>
                  <button onClick={clearSelection} className={`text-[10px] ${sub} hover:text-red-400 underline`}>
                    {u("Clear", "صاف")}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => bulkChangeStatus("verified")}
                    disabled={bulkProcessing}
                    className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      bulkProcessing ? "opacity-50 cursor-wait" : ""
                    } ${dc ? "bg-green-900/40 text-green-300 hover:bg-green-900/60" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
                  >
                    {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    {u("Verify", "تصدیق")}
                  </button>
                  <button
                    onClick={() => bulkChangeStatus("rejected")}
                    disabled={bulkProcessing}
                    className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      bulkProcessing ? "opacity-50 cursor-wait" : ""
                    } ${dc ? "bg-red-900/40 text-red-300 hover:bg-red-900/60" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                  >
                    {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                    {u("Reject", "مسترد")}
                  </button>
                  <button
                    onClick={() => bulkChangeStatus("pending")}
                    disabled={bulkProcessing}
                    className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      bulkProcessing ? "opacity-50 cursor-wait" : ""
                    } ${dc ? "bg-amber-900/40 text-amber-300 hover:bg-amber-900/60" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}
                  >
                    {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                    {u("Pending", "زیر التواء")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Document list / grid ── */}
          {selectedCase.documents.length > 0 ? (
            <div className={`rounded-xl border overflow-hidden ${card}`}>
              <div className={`px-4 py-3 border-b ${brd} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  {/* Select all checkbox */}
                  <button onClick={toggleSelectAll} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    allSelected
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : selectedDocIds.size > 0
                        ? (dc ? "bg-emerald-900/30 border-emerald-600" : "bg-emerald-50 border-emerald-400")
                        : (dc ? "border-gray-600 hover:border-gray-500" : "border-gray-300 hover:border-gray-400")
                  }`}>
                    {allSelected && <Check className="w-3 h-3" />}
                    {!allSelected && selectedDocIds.size > 0 && <div className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />}
                  </button>
                  <h4 className={`text-sm font-bold ${txt}`}>
                    {u("Documents", "دستاویزات")}
                    {filteredDocs.length !== selectedCase.documents.length && (
                      <span className={`ml-2 text-xs font-normal ${sub}`}>
                        {u(`Showing ${filteredDocs.length} of ${selectedCase.documents.length}`, `${selectedCase.documents.length} میں سے ${filteredDocs.length} دکھائے جا رہے ہیں`)}
                      </span>
                    )}
                  </h4>
                </div>
              </div>

              {filteredDocs.length > 0 ? (
                viewMode === "list" ? (
                  /* ── LIST VIEW ── */
                  <div className={`divide-y ${dc ? "divide-gray-700" : "divide-gray-100"}`}>
                    {filteredDocs.map(doc => (
                      <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${selectedDocIds.has(doc.id) ? (dc ? "bg-emerald-900/15" : "bg-emerald-50/60") : ""} ${dc ? "hover:bg-gray-700/30" : "hover:bg-gray-50"}`}>
                        {/* Checkbox */}
                        <button onClick={() => toggleDocSelection(doc.id)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          selectedDocIds.has(doc.id)
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : (dc ? "border-gray-600 hover:border-emerald-500" : "border-gray-300 hover:border-emerald-400")
                        }`}>
                          {selectedDocIds.has(doc.id) && <Check className="w-3 h-3" />}
                        </button>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isImageDoc(doc)
                            ? (dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-500")
                            : (dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500")
                        }`}>
                          {isImageDoc(doc) ? <Camera className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${txt}`}>{doc.name}</p>
                          <p className={`text-[10px] ${sub}`}>{doc.type} · {doc.uploadDate}</p>
                        </div>
                        <StatusBadge status={doc.status} />
                        <button onClick={() => viewDocument(doc)} disabled={loadingUrl === doc.id} className={`p-2 rounded-lg transition-colors shrink-0 ${dc ? "hover:bg-gray-700 text-emerald-400" : "hover:bg-gray-100 text-emerald-600"}`} title={u("View", "دیکھیں")}>
                          {loadingUrl === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ── GRID / THUMBNAIL VIEW ── */
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredDocs.map(doc => {
                      const isImg = isImageDoc(doc);
                      const thumbUrl = thumbnailUrls[doc.id];
                      // Lazy load thumbnail
                      if (isImg && !thumbUrl) { loadThumbnail(doc); }
                      return (
                        <div
                          key={doc.id}
                          className={`rounded-xl border overflow-hidden transition-all group relative ${
                            selectedDocIds.has(doc.id) ? (dc ? "ring-2 ring-emerald-500 border-emerald-600" : "ring-2 ring-emerald-400 border-emerald-300") : brd
                          } ${dc ? "bg-gray-800 hover:bg-gray-750" : "bg-white hover:shadow-md"}`}
                        >
                          {/* Thumbnail area */}
                          <div className={`relative w-full h-28 flex items-center justify-center overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                            {isImg && thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={doc.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : isImg && !thumbUrl ? (
                              <Loader2 className={`w-6 h-6 animate-spin ${sub}`} />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <FileText className={`w-8 h-8 ${sub}`} />
                                <span className={`text-[9px] font-mono uppercase ${sub}`}>
                                  {doc.name.split(".").pop() || "DOC"}
                                </span>
                              </div>
                            )}
                            {/* Selection checkbox overlay */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleDocSelection(doc.id); }}
                              className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                selectedDocIds.has(doc.id)
                                  ? "bg-emerald-500 border-emerald-500 text-white scale-100"
                                  : "border-white/80 bg-black/20 text-transparent hover:border-white hover:bg-black/40 group-hover:scale-100 scale-0"
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            {/* View button overlay */}
                            <button
                              onClick={(e) => { e.stopPropagation(); viewDocument(doc); }}
                              disabled={loadingUrl === doc.id}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                            >
                              {loadingUrl === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                          {/* Info area */}
                          <div className="p-2.5 space-y-1.5">
                            <p className={`text-[11px] font-medium truncate ${txt}`}>{doc.name}</p>
                            <div className="flex items-center justify-between">
                              <p className={`text-[9px] ${sub}`}>{doc.uploadDate}</p>
                              <StatusBadge status={doc.status} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className={`text-center py-6 ${sub}`}>
                  <Search className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs">{u("No documents match your filters", "فلٹر سے کوئی دستاویز نہیں ملی")}</p>
                  <button
                    onClick={() => { setDocStatusFilter("all"); setDocTypeFilter("all"); setDocSearch(""); }}
                    className="text-[10px] text-emerald-500 mt-1 hover:underline"
                  >
                    {u("Clear filters", "فلٹر صاف کریں")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={`text-center py-8 rounded-xl border ${card}`}>
              <FileText className={`w-8 h-8 mx-auto mb-2 opacity-30 ${sub}`} />
              <p className={`text-sm ${sub}`}>{u("No documents uploaded yet", "ابھی کوئی دستاویز نہیں")}</p>
              <p className={`text-[10px] mt-1 ${sub}`}>{u("Drag and drop files above or click to browse", "اوپر فائلیں ڈریگ کریں یا کلک کر کے منتخب کریں")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className={`text-center py-12 rounded-xl border ${card}`}>
          <FolderPlus className={`w-10 h-10 mx-auto mb-3 opacity-30 ${sub}`} />
          <p className={`text-sm font-medium ${txt}`}>{u("Select a case to manage documents", "دستاویزات کے لیے کیس منتخب کریں")}</p>
          <p className={`text-xs mt-1 ${sub}`}>{u("Choose from the dropdown above", "اوپر ڈراپ ڈاؤن سے چنیں")}</p>
        </div>
      )}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="Document" onClose={() => setLightboxSrc(null)} />}
    </motion.div>
  );
}
