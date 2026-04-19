import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { Document as CaseDocument } from "../lib/mockData";
import { DocumentFileStore } from "../lib/documentStore";
import { toast } from "../lib/toast";
import { documentStorageApi } from "../lib/api";
import {
  Upload, CloudUpload, X, FileText, Image, File as FileIcon, Check,
  Eye, Trash2, ChevronDown, AlertCircle, Paperclip, FolderOpen,
  Shield, Download, ZoomIn
} from "lucide-react";

const DOC_CATEGORIES = [
  { value: "passport_copy", label: "Passport Copy", labelUrdu: "پاسپورٹ کاپی", icon: "🛂", required: true },
  { value: "cnic_front", label: "CNIC Front", labelUrdu: "شناختی کارڈ سامنے", icon: "🪪", required: true },
  { value: "cnic_back", label: "CNIC Back", labelUrdu: "شناختی کارڈ پیچھے", icon: "🪪", required: true },
  { value: "photos", label: "Photos (4x6)", labelUrdu: "تصاویر", icon: "📷", required: true },
  { value: "educational", label: "Educational Certificate", labelUrdu: "تعلیمی سرٹیفکیٹ", icon: "🎓", required: false },
  { value: "experience", label: "Experience Letter", labelUrdu: "تجربے کا خط", icon: "💼", required: false },
  { value: "police_cert", label: "Police Character Certificate", labelUrdu: "پولیس کریکٹر سرٹیفکیٹ", icon: "👮", required: false },
  { value: "medical_report", label: "Medical Report", labelUrdu: "میڈیکل رپورٹ", icon: "🏥", required: false },
  { value: "bank_statement", label: "Bank Statement", labelUrdu: "بینک سٹیٹمنٹ", icon: "🏦", required: false },
  { value: "other", label: "Other", labelUrdu: "دیگر", icon: "📄", required: false },
];

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  category: string;
  status: "uploading" | "uploaded" | "error";
  progress: number;
}

interface Props {
  existingDocuments?: CaseDocument[];
  onUpload?: (files: { file: File; category: string }[]) => void;
  onDocumentVerify?: (docId: string, status: "verified" | "rejected") => void;
  maxFiles?: number;
  compact?: boolean;
  caseId?: string; // Optional case ID for tenant-scoped uploads
}

export function DocumentUploadInterface({
  existingDocuments = [],
  onUpload,
  onDocumentVerify,
  maxFiles = 10,
  compact = false,
  caseId,
}: Props) {
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "existing">("upload");
  const [docPreviews, setDocPreviews] = useState<Record<string, string | null>>({});
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Load tenant context on mount
  useEffect(() => {
    const loadTenant = async () => {
      const { getCachedTenantId } = await import("../lib/tenantContext");
      const tid = getCachedTenantId();
      setTenantId(tid);
    };
    loadTenant();
  }, []);

  // Load preview URLs for existing documents from Supabase Storage signed URLs
  useEffect(() => {
    let cancelled = false;
    const loadPreviews = async () => {
      const previews: Record<string, string | null> = {};
      for (const doc of existingDocuments) {
        if (cancelled) break;
        const docAny = doc as any;
        const mimeType = (docAny.mimeType || doc.type || "").toLowerCase();
        const isImage = mimeType.includes("image") || mimeType.includes("jpg") || mimeType.includes("jpeg") || mimeType.includes("png");

        // Use cached signed URL if still valid
        if (docAny.storageSignedUrl && docAny.signedUrlExpiresAt && new Date(docAny.signedUrlExpiresAt) > new Date()) {
          previews[doc.id] = isImage ? docAny.storageSignedUrl : null;
          continue;
        }

        // Fetch fresh signed URL from Supabase Storage
        if (docAny.storagePath) {
          try {
            const parts = (docAny.storagePath as string).split("/");
            if (parts.length >= 2) {
              const fileName = parts[parts.length - 1];
              const docIdPath = parts.slice(0, -1).join("/");
              const res = await documentStorageApi.getSignedUrl(docIdPath, fileName);
              if (res.success && res.data?.signedUrl) {
                previews[doc.id] = isImage ? res.data.signedUrl : res.data.signedUrl;
                continue;
              }
            }
          } catch { /* ignore */ }
        }

        // Fallback: try DocumentFileStore
        const stored = DocumentFileStore.getFile(doc.id);
        if (stored?.mimeType?.startsWith("image/")) {
          const localUrl = DocumentFileStore.getPreviewUrl(doc.id);
          if (localUrl) { previews[doc.id] = localUrl; continue; }
          const cloudUrl = await DocumentFileStore.getCloudPreviewUrl(doc.id);
          previews[doc.id] = cloudUrl;
        } else {
          previews[doc.id] = null;
        }
      }
      if (!cancelled) setDocPreviews(previews);
    };
    loadPreviews();
    return () => { cancelled = true; };
  }, [existingDocuments]);

  // Helper to check if a document is an image type
  const isImageDoc = (docId: string): boolean => {
    const stored = DocumentFileStore.getFile(docId);
    if (stored) return stored.mimeType?.startsWith("image/") || false;
    // Fallback: check the doc type field
    const doc = existingDocuments.find(d => d.id === docId);
    if (doc) {
      const t = doc.type.toLowerCase();
      return t.includes("image") || t.includes("jpeg") || t.includes("jpg") || t.includes("png");
    }
    return false;
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max
  const ALLOWED_TYPES = [
    "image/jpeg", "image/png",
    "application/pdf",
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return Image;
    if (type === "application/pdf") return FileText;
    return FileIcon;
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = maxFiles - uploadedFiles.length;
    if (remaining <= 0) {
      toast.error(isUrdu ? `زیادہ سے زیادہ ${maxFiles} فائلز` : `Maximum ${maxFiles} files allowed`);
      return;
    }

    const toProcess = fileArray.slice(0, remaining);
    toProcess.forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: ${isUrdu ? "غیر معاون فائل" : "Unsupported file type"}`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: ${isUrdu ? "فائل 5MB سے بڑی ہے" : "File exceeds 5MB limit"}`);
        return;
      }
      if (uploadedFiles.some(uf => uf.file.name === file.name && uf.file.size === file.size)) {
        toast.error(`${file.name} ${isUrdu ? "پہلے سے موجود" : "already added"}`);
        return;
      }

      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
      const newFile: UploadedFile = {
        id: `UF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        file,
        preview,
        category: "other",
        status: "uploading",
        progress: 0,
      };

      setUploadedFiles(prev => [...prev, newFile]);

      // Mark as ready immediately — the actual Supabase upload happens
      // in the parent's onUpload callback to avoid double uploads
      setUploadedFiles(prev =>
        prev.map(f => f.id === newFile.id ? { ...f, status: "uploaded", progress: 100 } : f)
      );
    });

    toast.success(`${toProcess.length} ${isUrdu ? "فائل(ز) شامل" : "file(s) added"}`);
  }, [uploadedFiles, maxFiles, isUrdu]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => {
      const f = prev.find(x => x.id === fileId);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter(x => x.id !== fileId);
    });
    toast.info(isUrdu ? "فائل ہٹا دی" : "File removed");
  };

  const updateCategory = (fileId: string, category: string) => {
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, category } : f));
  };

  const handleSubmitUpload = () => {
    const completedFiles = uploadedFiles.filter(f => f.status === "uploaded");
    if (completedFiles.length === 0) {
      toast.error(isUrdu ? "کوئی فائل نہیں ہے" : "No files to upload");
      return;
    }
    
    // Include tenant_id and case_id in upload metadata for tenant isolation
    const enrichedFiles = completedFiles.map(f => ({
      file: f.file,
      category: f.category,
      metadata: {
        tenantId: tenantId || "default",
        caseId: caseId || null,
        uploadedAt: new Date().toISOString(),
      }
    }));
    
    onUpload?.(enrichedFiles as any);
    toast.success(`${completedFiles.length} ${isUrdu ? "دستاویزات اپ لوڈ" : "documents uploaded"}`);
    completedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setUploadedFiles([]);
  };

  // Checklist: which required docs are satisfied
  const requiredDocs = DOC_CATEGORIES.filter(d => d.required);
  const existingDocNames = existingDocuments.map(d => d.name.toLowerCase());
  const uploadedDocCategories = uploadedFiles.map(f => f.category);

  const getDocStatusIcon = (docValue: string) => {
    const hasExisting = existingDocuments.some(d => d.type.includes(docValue) || d.name.toLowerCase().includes(docValue.replace("_", " ")));
    const hasUploaded = uploadedDocCategories.includes(docValue);
    const isVerified = existingDocuments.find(d => d.type.includes(docValue))?.status === "verified";

    if (isVerified) return { icon: Shield, color: "text-blue-500", label: isUrdu ? "تصدیق شدہ" : "Verified" };
    if (hasExisting || hasUploaded) return { icon: Check, color: "text-blue-500", label: isUrdu ? "موجود" : "Uploaded" };
    return { icon: AlertCircle, color: "text-amber-500", label: isUrdu ? "ضرورت ہے" : "Required" };
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${dc ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"}`}>
      {/* Header */}
      <div className={`p-4 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              dc ? "bg-blue-900/30" : "bg-blue-100"
            }`}>
              <FolderOpen className={`w-5 h-5 ${dc ? "text-blue-400" : "text-blue-600"}`} />
            </div>
            <div>
              <h3 className={`font-bold text-sm ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "دستاویزات" : "Documents"}
              </h3>
              <p className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
                {existingDocuments.length} {isUrdu ? "موجود" : "existing"} | {uploadedFiles.length} {isUrdu ? "نئی" : "new"}
              </p>
            </div>
          </div>
          <div className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            uploadedFiles.length >= maxFiles
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
          }`}>
            {uploadedFiles.length}/{maxFiles}
          </div>
        </div>

        {/* Tab toggle */}
        <div className={`flex rounded-xl p-1 ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
          {(["upload", "existing"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                activeTab === tab
                  ? "bg-blue-500 text-white shadow-sm"
                  : dc ? "text-gray-400 hover:text-gray-300" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "upload"
                ? (isUrdu ? "اپ لوڈ" : "Upload")
                : (isUrdu ? "موجودہ" : `Existing (${existingDocuments.length})`)
              }
            </button>
          ))}
        </div>
      </div>

      {/* Upload Tab */}
      {activeTab === "upload" && (
        <div className="p-4 space-y-4">
          {/* Document checklist */}
          {!compact && (
            <div className={`p-3 rounded-xl ${dc ? "bg-gray-700/30" : "bg-amber-50"}`}>
              <p className={`text-xs font-semibold mb-2 ${dc ? "text-amber-400" : "text-amber-700"}`}>
                {isUrdu ? "ضروری دستاویزات چیک لسٹ" : "Required Documents Checklist"}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {requiredDocs.map(doc => {
                  const status = getDocStatusIcon(doc.value);
                  const StatusIcon = status.icon;
                  return (
                    <div key={doc.value} className="flex items-center gap-2 text-xs">
                      <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                      <span className={dc ? "text-gray-300" : "text-gray-700"}>
                        {isUrdu ? doc.labelUrdu : doc.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drop zone */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={e => { if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ""; }}}
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
            <motion.div
              animate={isDragOver ? { y: -5 } : { y: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <CloudUpload className={`w-10 h-10 mx-auto mb-3 ${
                isDragOver ? "text-blue-500" : dc ? "text-gray-500" : "text-gray-400"
              }`} />
              <p className={`text-sm font-medium mb-1 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                {isDragOver
                  ? (isUrdu ? "یہاں چھوڑیں" : "Drop files here")
                  : (isUrdu ? "فائلز ڈریگ کریں یا کلک کریں" : "Drag & drop files or click to browse")
                }
              </p>
              <p className={`text-xs ${dc ? "text-gray-500" : "text-gray-400"}`}>
                JPG, PNG, PDF | Max 5MB | {isUrdu ? "زیادہ سے زیادہ" : "Up to"} {maxFiles} {isUrdu ? "فائلز" : "files"}
              </p>
            </motion.div>
          </motion.div>

          {/* Uploaded files list */}
          <AnimatePresence mode="popLayout">
            {uploadedFiles.map((file) => {
              const Icon = getFileIcon(file.file.type);
              return (
                <motion.div
                  key={file.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    dc ? "bg-gray-700/30 border-gray-700" : "bg-gray-50 border-gray-100"
                  }`}
                >
                  {/* Preview / Icon */}
                  {file.preview ? (
                    <div
                      className="w-12 h-12 rounded-lg overflow-hidden cursor-pointer relative group"
                      onClick={() => setPreviewImage(file.preview)}
                    >
                      <img src={file.preview} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      dc ? "bg-gray-600" : "bg-gray-200"
                    }`}>
                      <Icon className={`w-6 h-6 ${dc ? "text-gray-400" : "text-gray-500"}`} />
                    </div>
                  )}

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${dc ? "text-white" : "text-gray-900"}`}>
                      {file.file.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
                        {formatFileSize(file.file.size)}
                      </span>

                      {/* Category selector */}
                      <select
                        value={file.category}
                        onChange={e => updateCategory(file.id, e.target.value)}
                        className={`text-xs px-2 py-0.5 rounded-lg border appearance-none cursor-pointer ${
                          dc
                            ? "bg-gray-600 border-gray-500 text-gray-300"
                            : "bg-white border-gray-200 text-gray-700"
                        }`}
                      >
                        {DOC_CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.icon} {isUrdu ? cat.labelUrdu : cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Progress bar */}
                    {file.status === "uploading" && (
                      <div className={`w-full h-1 rounded-full mt-2 ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${file.progress}%` }}
                          className="h-full rounded-full bg-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Status + actions */}
                  <div className="flex items-center gap-2">
                    {file.status === "uploaded" && (
                      <Check className="w-4 h-4 text-blue-500" />
                    )}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeFile(file.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        dc ? "hover:bg-red-900/30 text-gray-400 hover:text-red-400" : "hover:bg-red-50 text-gray-400 hover:text-red-500"
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Submit button */}
          {uploadedFiles.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmitUpload}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-shadow"
            >
              <Upload className="w-4 h-4" />
              {isUrdu ? `${uploadedFiles.filter(f => f.status === "uploaded").length} دستاویزات اپ لوڈ کریں` : `Upload ${uploadedFiles.filter(f => f.status === "uploaded").length} Document(s)`}
            </motion.button>
          )}
        </div>
      )}

      {/* Existing Documents Tab */}
      {activeTab === "existing" && (
        <div className="p-4">
          {existingDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-gray-600" : "text-gray-300"}`} />
              <p className={`text-sm ${dc ? "text-gray-400" : "text-gray-500"}`}>
                {isUrdu ? "کوئی دستاویز نہیں" : "No documents yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {existingDocuments.map((doc, idx) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    dc ? "bg-gray-700/30 border-gray-700" : "bg-gray-50 border-gray-100"
                  }`}
                >
                  {/* Thumbnail: real image preview or file type icon */}
                  {(() => {
                    const mimeType = ((doc as any).mimeType || doc.type || "").toLowerCase();
                    const isPdf = mimeType.includes("pdf");
                    const isImg = mimeType.includes("image") || mimeType.includes("jpg") || mimeType.includes("jpeg") || mimeType.includes("png");
                    const previewUrl = docPreviews[doc.id];

                    if (previewUrl && isImg) {
                      return (
                        <div
                          className="w-10 h-10 rounded-lg overflow-hidden cursor-pointer relative group flex-shrink-0"
                          onClick={() => setPreviewImage(previewUrl)}
                        >
                          <img src={previewUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      );
                    }

                    if (isPdf) {
                      return (
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${dc ? "bg-red-900/20" : "bg-red-50"}`}
                          onClick={() => previewUrl && window.open(previewUrl, "_blank")}
                          style={{ cursor: previewUrl ? "pointer" : "default" }}
                        >
                          <FileText className="w-5 h-5 text-red-500" />
                        </div>
                      );
                    }

                    return (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        doc.status === "verified" ? "bg-blue-500/10"
                        : doc.status === "rejected" ? "bg-red-500/10"
                        : dc ? "bg-gray-600" : "bg-gray-200"
                      }`}>
                        {doc.status === "verified" ? (
                          <Shield className="w-5 h-5 text-blue-500" />
                        ) : doc.status === "rejected" ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <FileText className={`w-5 h-5 ${dc ? "text-gray-400" : "text-gray-500"}`} />
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${dc ? "text-white" : "text-gray-900"}`}>
                      {doc.name}
                    </p>
                    <p className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
                      {new Date(doc.uploadDate).toLocaleDateString()} | {doc.type}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    doc.status === "verified"
                      ? dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700"
                      : doc.status === "rejected"
                      ? dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700"
                      : dc ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-700"
                  }`}>
                    {doc.status === "verified" ? (isUrdu ? "تصدیق" : "Verified")
                      : doc.status === "rejected" ? (isUrdu ? "مسترد" : "Rejected")
                      : (isUrdu ? "زیر التوا" : "Pending")}
                  </span>

                  {/* Download button */}
                  {((doc as any).storagePath || docPreviews[doc.id] || DocumentFileStore.hasFile(doc.id)) && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={async () => {
                        // Try signed URL from preview cache first
                        if (docPreviews[doc.id]) {
                          window.open(docPreviews[doc.id]!, "_blank");
                          toast.success(isUrdu ? "ڈاؤن لوڈ شروع" : "Download started");
                          return;
                        }
                        // Try fetching fresh signed URL
                        const docAny = doc as any;
                        if (docAny.storagePath) {
                          try {
                            const parts = (docAny.storagePath as string).split("/");
                            const fileName = parts[parts.length - 1];
                            const docIdPath = parts.slice(0, -1).join("/");
                            const res = await documentStorageApi.getSignedUrl(docIdPath, fileName);
                            if (res.success && res.data?.signedUrl) {
                              window.open(res.data.signedUrl, "_blank");
                              toast.success(isUrdu ? "ڈاؤن لوڈ شروع" : "Download started");
                              return;
                            }
                          } catch { /* fall through */ }
                        }
                        // Fallback: DocumentFileStore
                        DocumentFileStore.downloadFile(doc.id);
                        toast.success(isUrdu ? "ڈاؤن لوڈ شروع" : "Download started");
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${dc ? "hover:bg-blue-900/30 text-blue-400" : "hover:bg-blue-50 text-blue-600"}`}
                      title={isUrdu ? "ڈاؤن لوڈ" : "Download"}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </motion.button>
                  )}

                  {/* Verify/reject actions */}
                  {onDocumentVerify && doc.status === "pending" && (
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onDocumentVerify(doc.id, "verified")}
                        className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                        title="Verify"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onDocumentVerify(doc.id, "rejected")}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                        title="Reject"
                      >
                        <X className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-2xl max-h-[80vh]"
            >
              <img src={previewImage} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}