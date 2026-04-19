import { useNavigate } from "react-router";
import { ArrowLeft, Upload, CheckCircle, XCircle, Clock, Eye, FileText, AlertCircle, Trash2, RefreshCw, Menu, ZoomIn } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Case } from "../../lib/mockData";
import { updateCase } from "../../lib/caseApi";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { AuditLogService } from "../../lib/auditLog";
import { DataSyncService } from "../../lib/dataSync";
import { NotificationService } from "../../lib/notifications";
import { DocumentFileStore } from "../../lib/documentStore";
import { MobileBottomNav } from "../../components/MobileBottomNav";
import { CustomerMobileMenu } from "../../components/CustomerMobileMenu";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";

export function CustomerDocuments() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [myCase, setMyCase] = useState<Case | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  // Load case data from Supabase
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
    // Poll for updates every 10s
    const interval = setInterval(loadCase, 10000);
    return () => clearInterval(interval);
  }, [loadCase]);

  // Document categories based on standard visa requirements
  const requiredDocs = [
    { type: "passport_copy", label: "Passport Copy", labelUrdu: "پاسپورٹ کی کاپی", required: true },
    { type: "cnic_copy", label: "CNIC Copy (Front & Back)", labelUrdu: "شناختی کارڈ کی کاپی", required: true },
    { type: "passport_photos", label: "Passport Size Photos (4x)", labelUrdu: "پاسپورٹ سائز تصاویر (4x)", required: true },
    { type: "experience_letter", label: "Experience Letter", labelUrdu: "تجربے کا خط", required: false },
    { type: "police_certificate", label: "Police Character Certificate", labelUrdu: "پولیس کریکٹر سرٹیفکیٹ", required: true },
    { type: "medical_certificate", label: "Medical Fitness Certificate", labelUrdu: "طبی فٹنس سرٹیفکیٹ", required: true },
    { type: "education_certificate", label: "Educational Certificates", labelUrdu: "تعلیمی سرٹیفکیٹ", required: true },
    { type: "bank_statement", label: "Bank Statement (6 months)", labelUrdu: "بینک سٹیٹمنٹ (6 ماہ)", required: false },
  ];

  // Map existing case documents to required doc types
  const getDocForType = (type: string) => {
    if (!myCase) return null;
    return myCase.documents.find(d =>
      d.type === type ||
      d.name.toLowerCase().includes(type.replace(/_/g, " ")) ||
      d.name.toLowerCase().includes(type.replace(/_/g, ""))
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "rejected": return <XCircle className="w-5 h-5 text-red-500" />;
      case "pending": return <Clock className="w-5 h-5 text-amber-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      verified: dc ? "bg-green-900/30 text-green-400 border-green-700/50" : "bg-green-100 text-green-700 border-green-200",
      rejected: dc ? "bg-red-900/30 text-red-400 border-red-700/50" : "bg-red-100 text-red-700 border-red-200",
      pending: dc ? "bg-amber-900/30 text-amber-400 border-amber-700/50" : "bg-amber-100 text-amber-700 border-amber-200",
    };
    const labels: Record<string, string> = {
      verified: isUrdu ? "تصدیق شدہ ✓" : "Verified ✓",
      rejected: isUrdu ? "مسترد - دوبارہ اپ لوڈ کریں" : "Rejected - Re-upload",
      pending: isUrdu ? "زیر جائزہ" : "Under Review",
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || ""}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Handle file upload for a document type
  const handleUpload = async (docType: string, file: File) => {
    if (!myCase) return;
    setIsUploading(true);

    // Validate
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isUrdu ? "فائل 5MB سے بڑی ہے" : "File exceeds 5MB limit");
      setIsUploading(false);
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(isUrdu ? "صرف PDF, JPG, PNG اجازت ہے" : "Only PDF, JPG, PNG allowed");
      setIsUploading(false);
      return;
    }

    const lt = toast.loading(isUrdu ? "اپ لوڈ ہو رہا ہے..." : "Uploading to Supabase Storage...");

    const docId = `DOC-CUST-${Date.now()}`;
    const newDoc = {
      id: docId,
      name: file.name,
      type: docType,
      uploadDate: new Date().toISOString(),
      status: "pending" as const,
      url: "#",
      storagePath: `${myCase.id}/${docId}/${file.name}`,
      mimeType: file.type,
      fileSize: file.size,
      uploadedByRole: "customer" as const,
      notes: `Uploaded by ${customerName}`,
    };

    // Store file in DocumentFileStore and upload to Supabase Storage
    await DocumentFileStore.storeFile(newDoc.id, file, customerName, {
      caseId: myCase.id,
      checklistKey: docType,
      uploadedByRole: "customer",
    });

    // Check if replacing an existing rejected doc
    const existingIdx = myCase.documents.findIndex(d =>
      d.type === docType && d.status === "rejected"
    );

    let updatedDocs;
    if (existingIdx >= 0) {
      updatedDocs = [...myCase.documents];
      updatedDocs[existingIdx] = newDoc;
    } else {
      updatedDocs = [...myCase.documents, newDoc];
    }

    const ok = await updateCase(myCase.id, { documents: updatedDocs });
    toast.dismiss(lt);

    if (ok) {
      const { data } = await supabase.from('cases').select('*').eq('id', myCase.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data, profile) : null;
      if (refreshed) setMyCase(refreshed);

      // Audit log
      AuditLogService.logDocumentAction(customerName, "customer", "document_uploaded", myCase.id, file.name);
      DataSyncService.markModified(myCase.id, profile?.id || "customer", customerName, "customer", "case", `Document "${file.name}" uploaded by customer`);

      // Notify admin/agent
      NotificationService.addNotification({
        type: "document",
        priority: "medium",
        title: "Customer Uploaded Document",
        titleUrdu: "کسٹمر نے دستاویز اپ لوڈ کی",
        message: `${customerName} uploaded "${file.name}" for case ${myCase.id}`,
        messageUrdu: `${customerName} نے کیس ${myCase.id} کے لیے "${file.name}" اپ لوڈ کی`,
        actionable: true,
        actionUrl: "/admin/cases",
        actionLabel: "Review Document",
        targetRole: "all",
      });

      toast.success(isUrdu ? "دستاویز کامیابی سے اپ لوڈ ہو گئی!" : "Document uploaded successfully!");
    } else {
      toast.error(isUrdu ? "اپ لوڈ میں خرابی" : "Upload failed");
    }

    setIsUploading(false);
    setUploadingDocId(null);
  };

  const triggerUpload = (docType: string) => {
    setUploadingDocId(docType);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingDocId) {
      handleUpload(uploadingDocId, file);
    }
    // Reset the file input
    e.target.value = "";
  };

  // Compute stats
  const totalRequired = requiredDocs.filter(d => d.required).length;
  const uploadedRequired = requiredDocs.filter(d => {
    const doc = getDocForType(d.type);
    return d.required && doc && doc.status !== "rejected";
  }).length;
  const progressPct = totalRequired > 0 ? Math.round((uploadedRequired / totalRequired) * 100) : 0;

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-blue-50 to-gray-100"}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
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
              <h1 className={`text-lg font-bold ${txt}`}>{t("customer.myDocuments")}</h1>
              <span className={`text-xs ${sub}`}>Case ID: {caseId}</span>
            </div>
          </div>
          <div className="flex-1" />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { loadCase(); toast.success(isUrdu ? "تازہ ترین ڈیٹا لوڈ ہو گیا" : "Refreshed!"); }}
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
        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${card} rounded-xl shadow-sm p-4 md:p-6 mb-6 border ${brd}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className={`text-lg font-bold ${txt}`}>
                {isUrdu ? "دستاویزات کی پیشرفت" : "Document Progress"}
              </h2>
            </div>
            <span className={`text-sm font-semibold ${progressPct === 100 ? "text-green-600" : "text-blue-600"}`}>
              {uploadedRequired}/{totalRequired} {isUrdu ? "لازمی مکمل" : "required done"}
            </span>
          </div>
          <div className={`w-full h-3 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-3 rounded-full ${progressPct === 100 ? "bg-gradient-to-r from-green-500 to-green-400" : "bg-gradient-to-r from-blue-500 to-blue-400"}`}
            />
          </div>
          {progressPct === 100 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 mt-3 text-sm text-green-600 font-semibold"
            >
              <CheckCircle className="w-4 h-4" />
              {isUrdu ? "تمام لازمی دستاویزات مکمل!" : "All required documents submitted!"}
            </motion.p>
          )}
        </motion.div>

        {/* Document List */}
        <div className={`${card} rounded-xl shadow-sm p-4 md:p-6 mb-6 border ${brd}`}>
          <h2 className={`text-xl font-bold mb-2 ${txt}`}>{t("customer.documentChecklist")}</h2>
          <p className={`mb-6 ${sub}`}>{t("customer.uploadDocs")}</p>

          <div className="space-y-3">
            <AnimatePresence>
              {requiredDocs.map((docDef, idx) => {
                const existingDoc = getDocForType(docDef.type);
                const isUploaded = !!existingDoc;
                const status = existingDoc?.status || "not_uploaded";

                return (
                  <motion.div
                    key={docDef.type}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-4 rounded-xl border transition-all ${
                      status === "verified"
                        ? dc ? "bg-green-900/10 border-green-800/30" : "bg-green-50/50 border-green-200"
                        : status === "rejected"
                        ? dc ? "bg-red-900/10 border-red-800/30" : "bg-red-50/50 border-red-200"
                        : dc ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          {isUploaded ? getStatusIcon(status) : (
                            <div className={`w-5 h-5 rounded-full border-2 ${dc ? "border-gray-500" : "border-gray-300"}`} />
                          )}
                          <h3 className={`font-semibold ${txt}`}>
                            {isUrdu ? docDef.labelUrdu : docDef.label}
                          </h3>
                          {docDef.required && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded font-semibold">
                              {isUrdu ? "لازمی" : "Required"}
                            </span>
                          )}
                        </div>

                        {isUploaded && existingDoc && (() => {
                          const stored = DocumentFileStore.getFile(existingDoc.id);
                          const previewUrl = DocumentFileStore.getPreviewUrl(existingDoc.id);
                          const isPdf = stored?.mimeType?.includes("pdf");
                          return (
                            <div className="ml-8 mt-1.5">
                              {/* Thumbnail preview */}
                              {previewUrl && !isPdf && (
                                <div
                                  className="relative w-14 h-14 rounded-lg overflow-hidden cursor-pointer group/preview mb-2"
                                  onClick={() => {
                                    setLightboxSrc(previewUrl);
                                    setLightboxAlt(existingDoc.name);
                                  }}
                                >
                                  <img src={previewUrl} alt={existingDoc.name} className="w-full h-full object-cover rounded-lg transition-transform group-hover/preview:scale-110" />
                                  <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/40 transition-colors flex items-center justify-center rounded-lg">
                                    <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover/preview:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                              )}
                              {isPdf && stored && (
                                <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center mb-2 ${dc ? "bg-gray-600" : "bg-gray-100"}`}>
                                  <FileText className={`w-6 h-6 ${dc ? "text-red-400" : "text-red-500"}`} />
                                  <span className={`text-[8px] font-bold ${dc ? "text-red-400" : "text-red-500"}`}>PDF</span>
                                </div>
                              )}
                              <div className={`flex flex-wrap items-center gap-3 text-xs ${sub}`}>
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {existingDoc.name}
                                </span>
                                <span>
                                  {new Date(existingDoc.uploadDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                                {getStatusBadge(status)}
                              </div>
                            </div>
                          );
                        })()}

                        {status === "rejected" && existingDoc?.notes && (
                          <p className="ml-8 mt-1.5 text-xs text-red-500 italic">
                            {existingDoc.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {isUploaded && existingDoc && (() => {
                          const previewUrl = DocumentFileStore.getPreviewUrl(existingDoc.id);
                          const stored = DocumentFileStore.getFile(existingDoc.id);
                          const hasViewable = previewUrl || (existingDoc.url && existingDoc.url !== "#");
                          const isPdf = stored?.mimeType?.includes("pdf");
                          if (!hasViewable && !isPdf) return null;
                          return (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={async () => {
                                if (previewUrl) {
                                  setLightboxSrc(previewUrl);
                                  setLightboxAlt(existingDoc.name);
                                } else if (isPdf && stored?.isCloudStored) {
                                  const cloudUrl = await DocumentFileStore.getCloudPreviewUrl(existingDoc.id);
                                  if (cloudUrl) window.open(cloudUrl, "_blank");
                                } else if (existingDoc.url && existingDoc.url !== "#") {
                                  setLightboxSrc(existingDoc.url);
                                  setLightboxAlt(existingDoc.name);
                                }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-600" : "border-gray-300 text-gray-700 hover:bg-white"}`}
                            >
                              <Eye className="w-4 h-4" />
                              {isUrdu ? "دیکھیں" : "View"}
                            </motion.button>
                          );
                        })()}

                        {(!isUploaded || status === "rejected") && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => triggerUpload(docDef.type)}
                            disabled={isUploading}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium shadow-sm"
                          >
                            <Upload className="w-4 h-4" />
                            {status === "rejected"
                              ? (isUrdu ? "دوبارہ اپ لوڈ" : "Re-upload")
                              : (isUrdu ? "اپ لوڈ" : "Upload")
                            }
                          </motion.button>
                        )}

                        {status === "verified" && (
                          <span className="flex items-center gap-1.5 px-3 py-2 text-green-600 text-sm font-semibold">
                            <CheckCircle className="w-4 h-4" />
                            {isUrdu ? "مکمل" : "Done"}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Additional Documents from case (ones not matching required types) */}
        {myCase && (() => {
          const reqTypes = requiredDocs.map(d => d.type);
          const extras = myCase.documents.filter(d => !reqTypes.includes(d.type));
          if (extras.length === 0) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${card} rounded-xl shadow-sm p-4 md:p-6 mb-6 border ${brd}`}
            >
              <h3 className={`font-semibold mb-3 ${txt}`}>
                {isUrdu ? "اضافی دستاویزات" : "Additional Documents"}
              </h3>
              <div className="space-y-2">
                {extras.map(doc => {
                  const stored = DocumentFileStore.getFile(doc.id);
                  const previewUrl = DocumentFileStore.getPreviewUrl(doc.id);
                  const isPdf = stored?.mimeType?.includes("pdf");
                  return (
                    <div key={doc.id} className={`flex items-center justify-between p-3 rounded-lg ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        {previewUrl ? (
                          <div
                            className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group/preview"
                            onClick={() => { setLightboxSrc(previewUrl); setLightboxAlt(doc.name); }}
                          >
                            <img src={previewUrl} alt="" className="w-full h-full object-cover transition-transform group-hover/preview:scale-110" />
                            <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/40 transition-colors flex items-center justify-center">
                              <ZoomIn className="w-3.5 h-3.5 text-white opacity-0 group-hover/preview:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ) : isPdf && stored ? (
                          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                            <FileText className={`w-5 h-5 ${dc ? "text-red-400" : "text-red-500"}`} />
                            <span className={`text-[7px] font-bold ${dc ? "text-red-400" : "text-red-500"}`}>PDF</span>
                          </div>
                        ) : (
                          getStatusIcon(doc.status)
                        )}
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${txt}`}>{doc.name}</p>
                          <p className={`text-xs ${sub}`}>
                            {new Date(doc.uploadDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {stored && ` · ${stored.size < 1024 ? stored.size + " B" : stored.size < 1024 * 1024 ? Math.round(stored.size / 1024) + " KB" : (stored.size / (1024 * 1024)).toFixed(1) + " MB"}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(previewUrl || (doc.url && doc.url !== "#")) && (
                          <button
                            onClick={() => {
                              if (previewUrl) { setLightboxSrc(previewUrl); setLightboxAlt(doc.name); }
                              else if (doc.url && doc.url !== "#") { setLightboxSrc(doc.url); setLightboxAlt(doc.name); }
                            }}
                            className={`p-1.5 rounded-lg ${dc ? "hover:bg-gray-600 text-gray-400" : "hover:bg-gray-200 text-gray-500"}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {getStatusBadge(doc.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })()}

        {/* Guidelines */}
        <div className={`${dc ? "bg-blue-900/20 border-blue-400" : "bg-blue-50 border-blue-500"} border-l-4 p-4 rounded-lg`}>
          <h4 className={`font-semibold mb-2 ${dc ? "text-blue-300" : "text-blue-900"}`}>{t("customer.guidelines")}</h4>
          <ul className={`text-sm space-y-1 list-disc list-inside ${dc ? "text-blue-200" : "text-blue-800"}`}>
            <li>{isUrdu ? "تمام دستاویزات واضح اور پڑھنے کے قابل ہونی چاہئیں" : "All documents must be clear and readable"}</li>
            <li>{isUrdu ? "زیادہ سے زیادہ فائل سائز: 5MB" : "Maximum file size: 5MB per document"}</li>
            <li>{isUrdu ? "اجازت شدہ فارمیٹ: PDF, JPG, PNG" : "Accepted formats: PDF, JPG, PNG"}</li>
            <li>{isUrdu ? "دستاویزات درست اور میعاد ختم نہ ہونی چاہئیں" : "Documents should be valid and not expired"}</li>
            <li>{isUrdu ? "مسترد دستاویزات کو دوبارہ اپ لوڈ کریں" : "Re-upload rejected documents with corrections"}</li>
          </ul>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav role="customer" />
      <CustomerMobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <ImageLightbox
        src={lightboxSrc}
        alt={lightboxAlt}
        onClose={() => {
          setLightboxSrc(null);
          setLightboxAlt("");
        }}
      />
    </div>
  );
}