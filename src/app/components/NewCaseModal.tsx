import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Home, Briefcase, GraduationCap, Heart, CheckCircle2, CloudUpload, ShieldCheck, X, FileText, Image, File as FileIcon, Trash2, Paperclip } from 'lucide-react';
import { toast } from '../lib/toast';
import { useTheme } from '../lib/ThemeContext';
import { createCase } from '../lib/caseApi';
import { NotificationService } from '../lib/notifications';
import { AuditLogService } from '../lib/auditLog';
import { DataSyncService } from '../lib/dataSync';
import { modalVariants } from '../lib/animations';
import { SearchableCountrySelect } from '../components/SearchableCountrySelect';
import { Case, Payment } from '../lib/mockData';

export function NewCaseModal({ isOpen, onClose, adminName, onSuccess }: { isOpen: boolean; onClose: () => void; adminName: string; onSuccess?: () => void }) {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const labelCls = `block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`;
  const [isLoading, setIsLoading] = useState(false);

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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");
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
      onClose();
      setNewCase({ customerName: "", fatherName: "", phone: "", email: "", cnic: "", passport: "", dateOfBirth: "", maritalStatus: "single", address: "", city: "Lahore", country: "Saudi Arabia", jobType: "Driver", jobDescription: "", education: "High School", experience: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "father", agentName: "Faizan", totalFee: 50000, priority: "medium", uploadedDocs: [] });
      uploadedFiles.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
      setUploadedFiles([]);
      onSuccess();
      setIsLoading(false);
    }, 1200);
  };


  if (!isOpen) return null;

  return (
    <>
      {/* ========== NEW CASE MODAL (Comprehensive) ========== */}
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => onClose()}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()} className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto`}>
              <div className={`flex items-center justify-between p-6 border-b sticky top-0 z-10 ${dc ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"} rounded-t-2xl`}>
                <h2 className={`text-xl font-bold ${txt}`}>{isUrdu ? "نیا کیس بنائیں" : "Create New Case"}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => onClose()} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X className="w-5 h-5" /></motion.button>
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
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => onClose()} className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{isUrdu ? "منسوخ" : "Cancel"}</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCreateCase} disabled={isLoading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold">{isLoading ? (isUrdu ? "بنایا جا رہا ہے..." : "Creating...") : (isUrdu ? "کیس بنائیں" : "Create Case")}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}
