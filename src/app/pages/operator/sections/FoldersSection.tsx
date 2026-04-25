import { useState } from "react";
import {
  FolderPlus, Plus, X, Check, CheckCircle2, User, MapPin, Phone, FileText, ChevronRight, Clipboard, AlertTriangle, Flag, Loader2,
  Building2, Search,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../../lib/toast";
import { type Case } from "../../../lib/mockData";
import { createCase } from "../../../lib/caseApi";
import { SearchableCountrySelect } from "../../../components/SearchableCountrySelect";
import { CaseFolder, STORAGE, load, save } from "./operatorTypes";

export function FoldersSection({ u, dc, card, txt, sub, inputCls, bigBtn, cases, agents, addNotification, onCaseCreated }: any) {
  const [folders, setFolders] = useState<CaseFolder[]>(() => load(STORAGE.folders, []));
  const [showForm, setShowForm] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dest, setDest] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [docChecklist, setDocChecklist] = useState<Record<string, Record<string, boolean>>>(() => load("emr-op-doc-checklist", {}));
  const [isCreating, setIsCreating] = useState(false);

  // Full case form state
  const [fullCase, setFullCase] = useState({
    customerName: "", fatherName: "", phone: "", email: "", cnic: "", passport: "",
    dateOfBirth: "", maritalStatus: "single" as Case["maritalStatus"],
    address: "", city: "Lahore", country: "Saudi Arabia",
    jobType: "Driver", jobDescription: "", education: "High School", experience: "",
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "father",
    agentName: agents[0]?.fullName || "Faizan", totalFee: 50000,
    priority: "medium" as Case["priority"],
  });

  const requiredDocs = [
    { id: "cnic", en: "CNIC Copy", ur: "شناختی کارڈ" },
    { id: "passport", en: "Passport Copy", ur: "پاسپورٹ" },
    { id: "photos", en: "Photos (4x)", ur: "تصاویر (4 عدد)" },
    { id: "medical", en: "Medical Report", ur: "میڈیکل رپورٹ" },
    { id: "police", en: "Police Character Certificate", ur: "پولیس سرٹیفکیٹ" },
    { id: "education", en: "Education Certificates", ur: "تعلیمی سند" },
    { id: "experience", en: "Experience Letter", ur: "تجربے کا خط" },
    { id: "bank", en: "Bank Statement", ur: "بینک اسٹیٹمنٹ" },
  ];

  const allFolders: CaseFolder[] = [
    ...cases.map((c: Case) => ({ id: c.id, clientName: c.customerName, phone: c.phone, destination: c.country, assignedTo: c.agentName, createdAt: c.createdDate })),
    ...folders,
  ];
  const filtered = allFolders.filter(f =>
    f.clientName.toLowerCase().includes(search.toLowerCase()) ||
    f.phone.includes(search) ||
    f.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!name.trim() || !phone.trim() || !dest.trim()) { toast.error(u("Fill all fields", "سب خانے بھریں")); return; }
    const newId = `EMR-${new Date().getFullYear()}-${String(allFolders.length + 1).padStart(4, "0")}`;
    const folder: CaseFolder = { id: newId, clientName: name.trim(), phone: phone.trim(), destination: dest.trim(), assignedTo: assignTo || "Operator", createdAt: new Date().toISOString() };
    const updated = [folder, ...folders];
    setFolders(updated);
    save(STORAGE.folders, updated);
    setName(""); setPhone(""); setDest(""); setAssignTo("");
    setShowForm(false);
    toast.success(`${u("Folder created!", "فولڈر بن گیا!")} ${newId}`);
  };

  const handleCreateFullCase = async () => {
    if (!fullCase.customerName.trim() || !fullCase.phone.trim()) {
      toast.error(u("Name and phone are required", "نام اور فون ضروری ہیں"));
      return;
    }
    setIsCreating(true);
    const agentNameToId: Record<string, string> = {
      "Faizan": "AGENT-1", "Imran": "AGENT-2", "Safeer": "AGENT-3", "Aynee": "AGENT-4",
    };
    try {
      const created = await createCase({
        customerName: fullCase.customerName.trim(),
        fatherName: fullCase.fatherName.trim(),
        phone: fullCase.phone.trim(),
        email: fullCase.email.trim(),
        cnic: fullCase.cnic.trim(),
        passport: fullCase.passport.trim(),
        dateOfBirth: fullCase.dateOfBirth,
        maritalStatus: fullCase.maritalStatus,
        address: fullCase.address.trim(),
        city: fullCase.city,
        country: fullCase.country,
        jobType: fullCase.jobType,
        jobDescription: fullCase.jobDescription.trim(),
        education: fullCase.education,
        experience: fullCase.experience.trim(),
        emergencyContact: {
          name: fullCase.emergencyContactName.trim(),
          phone: fullCase.emergencyContactPhone.trim(),
          relationship: fullCase.emergencyContactRelation,
        },
        agentName: fullCase.agentName,
        agentId: agentNameToId[fullCase.agentName] || "AGENT-1",
        totalFee: fullCase.totalFee,
        priority: fullCase.priority,
        status: "document_collection",
        currentStage: 1,
        stageStartedAt: new Date().toISOString(),
        stageDeadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        isOverdue: false,
      });
      if (created) {
        toast.success(`${u("Case created!", "کیس بن گیا!")} ${created.id}`);
        addNotification(
          `Operator created case ${created.id} for ${fullCase.customerName}`,
          `آپریٹر نے ${fullCase.customerName} کا کیس ${created.id} بنایا`,
          "status"
        );
      }
      setFullCase({
        customerName: "", fatherName: "", phone: "", email: "", cnic: "", passport: "",
        dateOfBirth: "", maritalStatus: "single", address: "", city: "Lahore",
        country: "Saudi Arabia", jobType: "Driver", jobDescription: "",
        education: "High School", experience: "",
        emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "father",
        agentName: agents[0]?.fullName || "Faizan", totalFee: 50000, priority: "medium",
      });
      setShowFullForm(false);
      if (onCaseCreated) onCaseCreated();
    } catch (e) {
      toast.error(u("Failed to create case", "کیس بنانا ناکام"));
    } finally {
      setIsCreating(false);
    }
  };

  const toggleDoc = (caseId: string, docId: string) => {
    const updated = { ...docChecklist };
    if (!updated[caseId]) updated[caseId] = {};
    updated[caseId][docId] = !updated[caseId]?.[docId];
    setDocChecklist(updated);
    save("emr-op-doc-checklist", updated);
    toast.success(updated[caseId][docId] ? u("Document checked!", "کاغذ چیک ہو گیا!") : u("Unchecked", "غیر چیک"));
  };

  const getDocProgress = (caseId: string) => {
    const checked = requiredDocs.filter(d => docChecklist[caseId]?.[d.id]).length;
    return { checked, total: requiredDocs.length, percent: Math.round((checked / requiredDocs.length) * 100) };
  };

  const flagMissing = (folderId: string, clientName: string) => {
    const prog = getDocProgress(folderId);
    const missingDocs = requiredDocs.filter(d => !docChecklist[folderId]?.[d.id]);
    addNotification(
      `Flag: ${clientName} (${folderId}) missing ${prog.total - prog.checked} docs: ${missingDocs.map(d => d.en).join(", ")}`,
      `خبردار: ${clientName} (${folderId}) کے ${prog.total - prog.checked} کاغزات نامکمل: ${missingDocs.map(d => d.ur).join("، ")}`,
      "flag"
    );
    toast.success(u("Admin has been notified!", "ایڈمن کو اطلاع دے دی گئی!"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowFullForm(!showFullForm); setShowForm(false); }}
          className={`${bigBtn} bg-gradient-to-r from-blue-600 to-indigo-600 text-white`}>
          <Plus className="w-5 h-5" /> {u("+ Create Full Case", "+ مکمل کیس بنائیں")}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowForm(!showForm); setShowFullForm(false); }}
          className={`${bigBtn} bg-gradient-to-r from-emerald-600 to-teal-600 text-white`}>
          <FolderPlus className="w-5 h-5" /> {u("+ Quick Folder", "+ فوری فولڈر")}
        </motion.button>
      </div>

      {/* ── FULL CASE CREATION FORM ── */}
      <AnimatePresence>
        {showFullForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`rounded-2xl border p-4 space-y-4 overflow-hidden ${card}`}>
            <h3 className={`font-bold text-base flex items-center gap-2 ${txt}`}>
              <Plus className="w-5 h-5 text-blue-500" /> {u("Create Full Case", "مکمل کیس بنائیں")}
            </h3>
            {/* Personal Info */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-blue-400" : "text-blue-600"}`}>
                <User className="w-3.5 h-3.5" /> {u("Personal Information", "ذاتی معلومات")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={fullCase.customerName} onChange={e => setFullCase({...fullCase, customerName: e.target.value})} placeholder={u("Full Name *", "مکمل نام *")} className={inputCls} />
                <input value={fullCase.fatherName} onChange={e => setFullCase({...fullCase, fatherName: e.target.value})} placeholder={u("Father's Name", "والد کا نام")} className={inputCls} />
                <input value={fullCase.phone} onChange={e => setFullCase({...fullCase, phone: e.target.value})} placeholder={u("Phone *", "فون *")} className={inputCls} dir="ltr" />
                <input value={fullCase.email} onChange={e => setFullCase({...fullCase, email: e.target.value})} placeholder={u("Email", "ای میل")} className={inputCls} dir="ltr" />
                <input value={fullCase.cnic} onChange={e => setFullCase({...fullCase, cnic: e.target.value})} placeholder="CNIC (XXXXX-XXXXXXX-X)" className={inputCls} dir="ltr" />
                <input value={fullCase.passport} onChange={e => setFullCase({...fullCase, passport: e.target.value})} placeholder={u("Passport No.", "پاسپورٹ نمبر")} className={inputCls} dir="ltr" />
                <input type="date" value={fullCase.dateOfBirth} onChange={e => setFullCase({...fullCase, dateOfBirth: e.target.value})} className={inputCls} />
                <select value={fullCase.maritalStatus} onChange={e => setFullCase({...fullCase, maritalStatus: e.target.value as Case["maritalStatus"]})} className={inputCls}>
                  {[["single","Single / غیر شادی شدہ"],["married","Married / شادی شدہ"],["divorced","Divorced / طلاق یافتہ"],["widowed","Widowed / بیوہ"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            {/* Address */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-emerald-400" : "text-emerald-600"}`}>
                <MapPin className="w-3.5 h-3.5" /> {u("Address", "پتہ")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={fullCase.address} onChange={e => setFullCase({...fullCase, address: e.target.value})} placeholder={u("Full Address", "مکمل پتہ")} className={`${inputCls} sm:col-span-2`} />
                <select value={fullCase.city} onChange={e => setFullCase({...fullCase, city: e.target.value})} className={inputCls}>
                  {["Lahore","Karachi","Islamabad","Rawalpindi","Faisalabad","Multan","Peshawar","Quetta","Sialkot","Gujranwala","Other"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {/* Job & Destination */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-amber-400" : "text-amber-600"}`}>
                <Building2 className="w-3.5 h-3.5" /> {u("Job & Destination", "ملازمت اور منزل")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SearchableCountrySelect value={fullCase.country} onChange={(v) => setFullCase({...fullCase, country: v})} darkMode={dc} />
                <select value={fullCase.jobType} onChange={e => setFullCase({...fullCase, jobType: e.target.value})} className={inputCls}>
                  {["Driver","Construction Worker","Hospitality","Healthcare","Security Guard","Factory Worker","Cleaner","Electrician","Plumber","Mechanic","Other"].map(j => <option key={j} value={j}>{j}</option>)}
                </select>
                <textarea value={fullCase.jobDescription} onChange={e => setFullCase({...fullCase, jobDescription: e.target.value})} placeholder={u("Skills / Job Description", "مہارت / نوکری کی تفصیل")} className={`${inputCls} min-h-[60px] sm:col-span-2`} />
              </div>
            </div>
            {/* Education & Experience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={fullCase.education} onChange={e => setFullCase({...fullCase, education: e.target.value})} className={inputCls}>
                {["Primary","Middle","High School","Intermediate","Graduate","Postgraduate","Technical/Diploma","None"].map(ed => <option key={ed} value={ed}>{ed}</option>)}
              </select>
              <input value={fullCase.experience} onChange={e => setFullCase({...fullCase, experience: e.target.value})} placeholder={u("Work Experience", "تجربہ")} className={inputCls} />
            </div>
            {/* Emergency Contact */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-red-400" : "text-red-600"}`}>
                <Phone className="w-3.5 h-3.5" /> {u("Emergency Contact", "ہنگامی رابطہ")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={fullCase.emergencyContactName} onChange={e => setFullCase({...fullCase, emergencyContactName: e.target.value})} placeholder={u("Contact Name", "رابطے کا نام")} className={inputCls} />
                <input value={fullCase.emergencyContactPhone} onChange={e => setFullCase({...fullCase, emergencyContactPhone: e.target.value})} placeholder={u("Contact Phone", "رابطے کا فون")} className={inputCls} dir="ltr" />
                <select value={fullCase.emergencyContactRelation} onChange={e => setFullCase({...fullCase, emergencyContactRelation: e.target.value})} className={inputCls}>
                  {[["father","Father / والد"],["mother","Mother / والدہ"],["spouse","Spouse / شریک حیات"],["brother","Brother / بھائی"],["sister","Sister / بہن"],["friend","Friend / دوست"],["other","Other / دیگر"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            {/* Case Settings */}
            <div>
              <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${dc ? "text-purple-400" : "text-purple-600"}`}>
                <Flag className="w-3.5 h-3.5" /> {u("Case Settings", "کیس کی ترتیبات")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={fullCase.agentName} onChange={e => setFullCase({...fullCase, agentName: e.target.value})} className={inputCls}>
                  {agents.map((a: any) => <option key={a.id} value={a.fullName}>{a.fullName}</option>)}
                  <option value="Operator">{u("Self (Operator)", "خود (آپریٹر)")}</option>
                </select>
                <input type="number" value={fullCase.totalFee} onChange={e => setFullCase({...fullCase, totalFee: Number(e.target.value)})} placeholder="Total Fee (PKR)" className={inputCls} dir="ltr" />
                <select value={fullCase.priority} onChange={e => setFullCase({...fullCase, priority: e.target.value as Case["priority"]})} className={inputCls}>
                  {[["low","Low / کم"],["medium","Medium / درمیانہ"],["high","High / زیادہ"],["urgent","Urgent / فوری"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreateFullCase} disabled={isCreating}
                className={`${bigBtn} flex-1 bg-blue-600 text-white disabled:opacity-50`}>
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {isCreating ? u("Creating...", "بنایا جا رہا ہے...") : u("Create Case", "کیس بنائیں")}
              </motion.button>
              <button onClick={() => setShowFullForm(false)} className={`px-4 py-3 rounded-xl ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QUICK FOLDER FORM ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`rounded-2xl border p-4 space-y-3 overflow-hidden ${card}`}>
            <h3 className={`font-bold text-base ${txt}`}>{u("Quick Folder", "فوری فولڈر")}</h3>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={u("Client Name *", "نام *")} className={inputCls} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={u("Phone *", "فون *")} className={inputCls} dir="ltr" />
            <input value={dest} onChange={e => setDest(e.target.value)} placeholder={u("Destination Country *", "ملک *")} className={inputCls} />
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className={inputCls}>
              <option value="">{u("Assign to (Operator)", "آپریٹر")}</option>
              {agents.map((a: any) => <option key={a.id} value={a.fullName}>{a.fullName}</option>)}
            </select>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate} className={`${bigBtn} flex-1 bg-emerald-600 text-white`}>
                <Check className="w-5 h-5" /> {u("Create", "بنائیں")}
              </motion.button>
              <button onClick={() => setShowForm(false)} className={`px-4 py-3 rounded-xl ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <Search className={`absolute top-1/2 -translate-y-1/2 ${dc ? "text-gray-500" : "text-gray-400"} w-5 h-5 start-4`} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={u("Search name, phone, ID...", "نام، فون، نمبر تلاش کریں...")}
          className={`${inputCls} ps-12`} />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className={`text-center py-8 ${sub}`}>{u("No folders found", "کوئی فولڈر نہیں ملا")}</p>
        ) : filtered.map(f => {
          const prog = getDocProgress(f.id);
          const isExpanded = expandedCase === f.id;
          return (
            <div key={f.id} className={`rounded-xl border overflow-hidden ${card}`}>
              <button onClick={() => setExpandedCase(isExpanded ? null : f.id)} className="w-full p-3 sm:p-4 text-start">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${dc ? "bg-emerald-900/30" : "bg-emerald-100"}`}>
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${dc ? "bg-gray-700 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}>{f.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700"}`}>
                        <User className="w-3 h-3 inline" /> {f.assignedTo}
                      </span>
                    </div>
                    <p className={`text-sm font-semibold mt-1 ${txt}`}>{f.clientName}</p>
                    <p className={`text-xs ${sub}`}><Phone className="w-3 h-3 inline" /> {f.phone} | <MapPin className="w-3 h-3 inline" /> {f.destination}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                        <div className={`h-full rounded-full transition-all ${prog.percent === 100 ? "bg-emerald-500" : prog.percent > 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${prog.percent}%` }} />
                      </div>
                      <span className={`text-[10px] font-bold ${prog.percent === 100 ? "text-emerald-500" : sub}`}>📄 {prog.checked}/{prog.total}</span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""} ${sub}`} />
                    </div>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className={`px-3 sm:px-4 pb-3 sm:pb-4 pt-1 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                      <p className={`text-xs font-bold mb-2 flex items-center gap-1 ${txt}`}>
                        <Clipboard className="w-3.5 h-3.5" /> {u("Document Checklist", "کاغزات کی فہرست")}
                      </p>
                      <div className="space-y-1.5">
                        {requiredDocs.map(doc => {
                          const isChecked = !!docChecklist[f.id]?.[doc.id];
                          return (
                            <motion.button key={doc.id} whileTap={{ scale: 0.97 }} onClick={() => toggleDoc(f.id, doc.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[44px] transition-all ${
                                isChecked
                                  ? dc ? "bg-emerald-900/20 text-emerald-400 border border-emerald-700/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : dc ? "bg-gray-700/50 text-gray-300 border border-gray-600/50" : "bg-gray-50 text-gray-600 border border-gray-200"
                              }`}>
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isChecked ? "bg-emerald-500 text-white" : dc ? "bg-gray-600" : "bg-gray-200"}`}>
                                {isChecked && <Check className="w-4 h-4" />}
                              </div>
                              <span className={`font-medium ${isChecked ? "line-through opacity-70" : ""}`}>
                                {isChecked ? "☑" : "☐"} {u(doc.en, doc.ur)}
                              </span>
                              {!isChecked && (
                                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"}`}>
                                  {u("Missing", "نامکمل")} ⚠️
                                </span>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                      {prog.percent < 100 && (
                        <>
                          <div className={`mt-3 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${dc ? "bg-amber-900/20 text-amber-400 border border-amber-700/30" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {u(`${prog.total - prog.checked} documents still missing`, `${prog.total - prog.checked} کاغزات ابھی باقی ہیں`)}
                          </div>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => flagMissing(f.id, f.clientName)}
                            className={`mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold min-h-[48px] ${
                              dc ? "bg-amber-700/30 text-amber-300 border border-amber-600/40" : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}>
                            <Flag className="w-4 h-4" /> {u("Flag Missing for Admin", "ایڈمن کو نامکمل کاغزات کی اطلاع دیں")}
                          </motion.button>
                        </>
                      )}
                      {prog.percent === 100 && (
                        <div className={`mt-3 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${dc ? "bg-emerald-900/20 text-emerald-400 border border-emerald-700/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {u("All documents complete!", "تمام کاغزات مکمل ہیں!")} ✅
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
