/**
 * EditableCaseFields — Mobile-optimized editable form for all case details.
 * Every edit immediately syncs to CRMDataStore + pushes to Supabase server.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ALL_COUNTRIES, POPULAR_COUNTRIES } from "../constants/countries";
import { SearchableCountrySelect } from "./SearchableCountrySelect";
import {
  Save, Edit, X, User, Phone, Mail, MapPin, CreditCard, Briefcase,
  Calendar, GraduationCap, Heart, Globe, Shield, Home, FileText,
  Loader2, CheckCircle2, Building2,
} from "lucide-react";
import { Case } from "../lib/mockData";
import { updateCase } from "../lib/caseApi";
import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";
import { AuditLogService } from "../lib/auditLog";
import { toast } from "../lib/toast";

interface Props {
  caseData: Case;
  darkMode: boolean;
  isUrdu: boolean;
  userName: string;
  userRole: "admin" | "agent" | "customer" | "master_admin" | "operator";
  readOnly?: boolean;
  onUpdate: (updated: Case) => void;
  compact?: boolean;
}

interface FieldConfig {
  key: keyof Case;
  label: string;
  labelUrdu: string;
  icon: React.ElementType;
  type: "text" | "email" | "tel" | "date" | "number" | "select" | "textarea";
  options?: { value: string; label: string }[];
  section: string;
  editable?: boolean;
}

const FIELDS: FieldConfig[] = [
  { key: "customerName", label: "Customer Name", labelUrdu: "کسٹمر کا نام", icon: User, type: "text", section: "personal" },
  { key: "fatherName", label: "Father's Name", labelUrdu: "والد کا نام", icon: User, type: "text", section: "personal" },
  { key: "phone", label: "Phone", labelUrdu: "فون", icon: Phone, type: "tel", section: "personal" },
  { key: "email", label: "Email", labelUrdu: "ای میل", icon: Mail, type: "email", section: "personal" },
  { key: "cnic", label: "CNIC", labelUrdu: "شناختی کارڈ", icon: CreditCard, type: "text", section: "personal" },
  { key: "passport", label: "Passport No.", labelUrdu: "پاسپورٹ نمبر", icon: FileText, type: "text", section: "personal" },
  { key: "dateOfBirth", label: "Date of Birth", labelUrdu: "تاریخ پیدائش", icon: Calendar, type: "date", section: "personal" },
  { key: "maritalStatus", label: "Marital Status", labelUrdu: "ازدواجی حیثیت", icon: Heart, type: "select", section: "personal", options: [
    { value: "single", label: "Single" }, { value: "married", label: "Married" },
    { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" },
  ]},
  { key: "address", label: "Address", labelUrdu: "پتہ", icon: Home, type: "textarea", section: "address" },
  { key: "city", label: "City", labelUrdu: "شہر", icon: MapPin, type: "text", section: "address" },
  { key: "country", label: "Destination Country", labelUrdu: "ملک", icon: Globe, type: "select", section: "visa", options: [...POPULAR_COUNTRIES.map(c => ({ value: c, label: c })), ...ALL_COUNTRIES.filter(c => !POPULAR_COUNTRIES.includes(c)).map(c => ({ value: c, label: c }))] },
  { key: "jobType", label: "Job Type", labelUrdu: "ملازمت کی قسم", icon: Briefcase, type: "text", section: "visa" },
  { key: "jobDescription", label: "Job Description", labelUrdu: "ملازمت کی تفصیل", icon: Briefcase, type: "textarea", section: "visa" },
  { key: "companyName", label: "Company Name", labelUrdu: "کمپنی کا نام", icon: Building2, type: "text", section: "visa" },
  { key: "companyCountry", label: "Company Country", labelUrdu: "کمپنی کا ملک", icon: Globe, type: "select", section: "visa", options: [...POPULAR_COUNTRIES.map(c => ({ value: c, label: c })), ...ALL_COUNTRIES.filter(c => !POPULAR_COUNTRIES.includes(c)).map(c => ({ value: c, label: c }))] },
  { key: "education", label: "Education", labelUrdu: "تعلیم", icon: GraduationCap, type: "text", section: "qualifications" },
  { key: "experience", label: "Experience", labelUrdu: "تجربہ", icon: Shield, type: "text", section: "qualifications" },
  { key: "totalFee", label: "Total Fee (PKR)", labelUrdu: "کل فیس (روپے)", icon: CreditCard, type: "number", section: "financial" },
  { key: "paidAmount", label: "Paid Amount (PKR)", labelUrdu: "ادا شدہ رقم (روپے)", icon: CreditCard, type: "number", section: "financial" },
  { key: "priority", label: "Priority", labelUrdu: "ترجیح", icon: Shield, type: "select", section: "case", options: [
    { value: "low", label: "Low" }, { value: "medium", label: "Medium" },
    { value: "high", label: "High" }, { value: "urgent", label: "Urgent" },
  ]},
];

const SECTIONS = [
  { key: "personal", label: "Personal Details", labelUrdu: "ذاتی تفصیلات" },
  { key: "address", label: "Address", labelUrdu: "پتہ" },
  { key: "visa", label: "Visa & Job", labelUrdu: "ویزا اور ملازمت" },
  { key: "qualifications", label: "Qualifications", labelUrdu: "اہلیت" },
  { key: "financial", label: "Financial", labelUrdu: "مالیاتی" },
  { key: "case", label: "Case Settings", labelUrdu: "کیس ترتیبات" },
];

export function EditableCaseFields({
  caseData, darkMode: dc, isUrdu, userName, userRole, readOnly = false, onUpdate, compact = false,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLDivElement>(null);

  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const inputCls = `w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
    dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900"
  }`;

  useEffect(() => {
    const data: Record<string, any> = {};
    FIELDS.forEach(f => {
      data[f.key] = (caseData as any)[f.key] ?? "";
    });
    // Also include emergency contact
    data.emergencyContactName = caseData.emergencyContact?.name || "";
    data.emergencyContactPhone = caseData.emergencyContact?.phone || "";
    data.emergencyContactRelationship = caseData.emergencyContact?.relationship || "";
    setFormData(data);
  }, [caseData]);

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setDirtyFields(prev => new Set(prev).add(key));
  };

  const handleSave = useCallback(async () => {
    if (dirtyFields.size === 0) {
      setEditMode(false);
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<Case> = {};
      dirtyFields.forEach(key => {
        if (key.startsWith("emergencyContact")) return;
        (updates as any)[key] = formData[key];
      });

      // Handle emergency contact
      if (dirtyFields.has("emergencyContactName") || dirtyFields.has("emergencyContactPhone") || dirtyFields.has("emergencyContactRelationship")) {
        updates.emergencyContact = {
          name: formData.emergencyContactName || "",
          phone: formData.emergencyContactPhone || "",
          relationship: formData.emergencyContactRelationship || "",
        };
      }

      updates.updatedDate = new Date().toISOString();

      // 1. Update in Supabase
      const ok = await updateCase(caseData.id, updates);
      if (!ok) {
        toast.error(isUrdu ? "اپ ڈیٹ ناکام" : "Update failed");
        setSaving(false);
        return;
      }

      // 2. Fetch refreshed data
      const { data } = await supabase.from('cases').select('*').eq('id', caseData.id).single();
      const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
      if (!refreshed) {
        toast.error(isUrdu ? "اپ ڈیٹ ناکام" : "Update failed");
        setSaving(false);
        return;
      }

      // 3. Audit log
      const changedFieldNames = Array.from(dirtyFields).join(", ");
      AuditLogService.log({
        userId: userName,
        userName,
        role: userRole === "master_admin" ? "master_admin" : userRole === "admin" ? "admin" : "agent",
        action: "case_updated",
        category: "case",
        description: `Updated fields [${changedFieldNames}] for case ${caseData.id} (${caseData.customerName})`,
        metadata: { caseId: caseData.id, fields: changedFieldNames },
      });

      toast.success(isUrdu ? "کیس اپ ڈیٹ ہو گیا" : "Case updated successfully");
      setDirtyFields(new Set());
      setEditMode(false);
      onUpdate(refreshed);
    } catch (err) {
      toast.error(`Save error: ${err}`);
    } finally {
      setSaving(false);
    }
  }, [formData, dirtyFields, caseData, userName, userRole, isUrdu, onUpdate]);

  const handleCancel = () => {
    // Reset form to original case data
    const data: Record<string, any> = {};
    FIELDS.forEach(f => {
      data[f.key] = (caseData as any)[f.key] ?? "";
    });
    data.emergencyContactName = caseData.emergencyContact?.name || "";
    data.emergencyContactPhone = caseData.emergencyContact?.phone || "";
    data.emergencyContactRelationship = caseData.emergencyContact?.relationship || "";
    setFormData(data);
    setDirtyFields(new Set());
    setEditMode(false);
  };

  const renderField = (field: FieldConfig) => {
    const value = formData[field.key] ?? "";
    const isDirty = dirtyFields.has(field.key as string);
    const Icon = field.icon;

    if (!editMode) {
      // Display mode
      return (
        <div key={field.key as string} className={`flex items-start gap-3 py-2 ${compact ? "py-1.5" : ""}`}>
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dc ? "text-gray-500" : "text-gray-400"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium ${sub}`}>{isUrdu ? field.labelUrdu : field.label}</p>
            <p className={`text-sm font-semibold ${txt} truncate`}>
              {field.type === "number"
                ? (typeof value === "number" ? `PKR ${value.toLocaleString()}` : value || "—")
                : field.type === "select"
                ? (field.options?.find(o => o.value === value)?.label || value || "—")
                : (value || "—")}
            </p>
          </div>
        </div>
      );
    }

    // Edit mode
    return (
      <div key={field.key as string} className={`py-1.5 ${isDirty ? "relative" : ""}`}>
        <label className={`block text-xs font-medium mb-1 ${dc ? "text-gray-300" : "text-gray-600"}`}>
          <Icon className="w-3 h-3 inline mr-1" />
          {isUrdu ? field.labelUrdu : field.label}
          {isDirty && <span className="ml-1 text-blue-500">•</span>}
        </label>
        {field.type === "select" && (field.key === "country" || field.key === "companyCountry") ? (
          <SearchableCountrySelect
            value={value as string}
            onChange={(v) => handleFieldChange(field.key as string, v)}
            darkMode={dc}
            isUrdu={isUrdu}
          />
        ) : field.type === "select" ? (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.key as string, e.target.value)}
            className={inputCls}
          >
            {field.options?.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : field.type === "textarea" ? (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key as string, e.target.value)}
            rows={2}
            className={inputCls}
          />
        ) : (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.key as string, field.type === "number" ? Number(e.target.value) : e.target.value)}
            className={inputCls}
          />
        )}
      </div>
    );
  };

  return (
    <div ref={formRef} className="space-y-4">
      {/* Edit/Save toggle */}
      {!readOnly && (
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-bold ${txt}`}>
            {isUrdu ? "کیس کی تفصیلات" : "Case Details"}
          </h3>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancel}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                    dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  {isUrdu ? "منسوخ" : "Cancel"}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSave}
                  disabled={saving || dirtyFields.size === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                    saving || dirtyFields.size === 0
                      ? "bg-blue-500/50 text-white/50 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                  }`}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {isUrdu ? "محفوظ کریں" : "Save"} {dirtyFields.size > 0 && `(${dirtyFields.size})`}
                </motion.button>
              </>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setEditMode(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                  dc ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                }`}
              >
                <Edit className="w-3.5 h-3.5" />
                {isUrdu ? "ترمیم" : "Edit"}
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* Sections */}
      {SECTIONS.map(section => {
        const sectionFields = FIELDS.filter(f => f.section === section.key);
        if (sectionFields.length === 0) return null;

        return (
          <div key={section.key} className={`rounded-xl border p-3 ${dc ? "bg-gray-800/50 border-gray-700" : "bg-gray-50/50 border-gray-200"}`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${dc ? "text-gray-500" : "text-gray-400"}`}>
              {isUrdu ? section.labelUrdu : section.label}
            </h4>
            <div className={editMode ? "space-y-2" : `grid ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-x-4`}>
              {sectionFields.map(renderField)}
            </div>
          </div>
        );
      })}

      {/* Emergency Contact */}
      <div className={`rounded-xl border p-3 ${dc ? "bg-gray-800/50 border-gray-700" : "bg-gray-50/50 border-gray-200"}`}>
        <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${dc ? "text-gray-500" : "text-gray-400"}`}>
          {isUrdu ? "ایمرجنسی رابطہ" : "Emergency Contact"}
        </h4>
        {editMode ? (
          <div className="space-y-2">
            <div>
              <label className={`block text-xs font-medium mb-1 ${dc ? "text-gray-300" : "text-gray-600"}`}>
                {isUrdu ? "نام" : "Name"}
              </label>
              <input
                type="text"
                value={formData.emergencyContactName || ""}
                onChange={(e) => handleFieldChange("emergencyContactName", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${dc ? "text-gray-300" : "text-gray-600"}`}>
                {isUrdu ? "فون" : "Phone"}
              </label>
              <input
                type="tel"
                value={formData.emergencyContactPhone || ""}
                onChange={(e) => handleFieldChange("emergencyContactPhone", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${dc ? "text-gray-300" : "text-gray-600"}`}>
                {isUrdu ? "رشتہ" : "Relationship"}
              </label>
              <input
                type="text"
                value={formData.emergencyContactRelationship || ""}
                onChange={(e) => handleFieldChange("emergencyContactRelationship", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
            <div className="flex items-start gap-3 py-2">
              <User className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dc ? "text-gray-500" : "text-gray-400"}`} />
              <div className="min-w-0">
                <p className={`text-xs font-medium ${sub}`}>{isUrdu ? "نام" : "Name"}</p>
                <p className={`text-sm font-semibold ${txt} truncate`}>{caseData.emergencyContact?.name || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <Phone className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dc ? "text-gray-500" : "text-gray-400"}`} />
              <div className="min-w-0">
                <p className={`text-xs font-medium ${sub}`}>{isUrdu ? "فون" : "Phone"}</p>
                <p className={`text-sm font-semibold ${txt} truncate`}>{caseData.emergencyContact?.phone || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <Heart className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dc ? "text-gray-500" : "text-gray-400"}`} />
              <div className="min-w-0">
                <p className={`text-xs font-medium ${sub}`}>{isUrdu ? "رشتہ" : "Relationship"}</p>
                <p className={`text-sm font-semibold ${txt} truncate`}>{caseData.emergencyContact?.relationship || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
