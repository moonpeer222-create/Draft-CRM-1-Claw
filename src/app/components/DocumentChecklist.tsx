import React, { useState, useEffect } from "react";
import { useTheme } from "../lib/ThemeContext";
import { CheckCircle, Circle, FileText, AlertCircle } from "lucide-react";
import { AuditLogService } from "../lib/auditLog";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";

interface ChecklistItem {
  id: string;
  label: string;
  labelUrdu: string;
  required: boolean;
  completed: boolean;
}

interface DocumentChecklistProps {
  caseId: string;
  country: string;
  jobType: string;
}

export function DocumentChecklist({ caseId, country, jobType }: DocumentChecklistProps) {
  const { darkMode, isUrdu } = useTheme();
  const { profile } = useSupabaseAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    loadChecklist();
  }, [caseId, country, jobType]);

  const loadChecklist = () => {
    // Load from localStorage or set default
    const saved = localStorage.getItem(`checklist_${caseId}`);
    if (saved) {
      setItems(JSON.parse(saved));
    } else {
      const defaultItems: ChecklistItem[] = [
        { id: "1", label: "Valid Passport (min 6 months)", labelUrdu: "پاسپورٹ (کم از کم 6 ماہ)", required: true, completed: false },
        { id: "2", label: "CNIC Copy (front & back)", labelUrdu: "شناختی کارڈ کی کاپی", required: true, completed: false },
        { id: "3", label: "Recent Photos (4x passport size)", labelUrdu: "تازہ تصاویر (4x پاسپورٹ سائز)", required: true, completed: false },
        { id: "4", label: "Educational Certificates", labelUrdu: "تعلیمی سرٹیفکیٹ", required: true, completed: false },
        { id: "5", label: "Police Character Certificate", labelUrdu: "پولیس کریکٹر سرٹیفکیٹ", required: true, completed: false },
        { id: "6", label: "Medical Fitness Certificate", labelUrdu: "طبی فٹنس سرٹیفکیٹ", required: true, completed: false },
        { id: "7", label: "Experience Letters (if any)", labelUrdu: "تجربے کے خطوط", required: false, completed: false },
        { id: "8", label: "Bank Statement (last 6 months)", labelUrdu: "بینک سٹیٹمنٹ", required: false, completed: false },
      ];
      setItems(defaultItems);
      localStorage.setItem(`checklist_${caseId}`, JSON.stringify(defaultItems));
    }
  };

  const toggleItem = (id: string) => {
    const item = items.find(i => i.id === id);
    const updated = items.map(i =>
      i.id === id ? { ...i, completed: !i.completed } : i
    );
    setItems(updated);
    localStorage.setItem(`checklist_${caseId}`, JSON.stringify(updated));

    // Audit log for customer checklist toggle
    if (item) {
      const customerName = profile?.full_name || "Customer";
      const newState = !item.completed;
      AuditLogService.log({
        userId: profile?.id || "customer",
        userName: customerName,
        role: "customer",
        action: newState ? "document_uploaded" : "case_updated",
        category: "document",
        description: `${customerName} ${newState ? "checked" : "unchecked"} "${item.label}" in document checklist for case ${caseId}`,
        metadata: { caseId, docLabel: item.label, checked: newState },
      });
    }
  };

  const completedCount = items.filter(i => i.completed).length;
  const requiredCount = items.filter(i => i.required).length;
  const requiredCompleted = items.filter(i => i.required && i.completed).length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className={`p-4 rounded-lg border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
            {isUrdu ? "دستاویزات کی فہرست" : "Document Checklist"}
          </h3>
        </div>
        <div className="text-right">
          <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
            {completedCount}/{items.length} {isUrdu ? "مکمل" : "completed"}
          </p>
          <p className={`text-xs ${requiredCompleted === requiredCount ? "text-green-600" : "text-orange-600"}`}>
            {requiredCompleted}/{requiredCount} {isUrdu ? "لازمی" : "required"}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className={`w-full h-2 rounded-full ${darkMode ? "bg-gray-700" : "bg-gray-200"}`}>
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
              darkMode ? "hover:bg-gray-700/50" : "hover:bg-gray-50"
            }`}
          >
            <div className="mt-0.5">
              {item.completed ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Circle className={`w-5 h-5 ${darkMode ? "text-gray-500" : "text-gray-400"}`} />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm ${item.completed ? "line-through" : ""} ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                {isUrdu ? item.labelUrdu : item.label}
              </p>
              {item.required && !item.completed && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    {isUrdu ? "لازمی" : "Required"}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {requiredCompleted === requiredCount && (
        <div className={`mt-4 p-3 rounded-lg ${darkMode ? "bg-green-900/20" : "bg-green-50"} border border-green-500/30`}>
          <p className={`text-sm text-green-600 dark:text-green-400 flex items-center gap-2`}>
            <CheckCircle className="w-4 h-4" />
            {isUrdu ? "تمام لازمی دستاویزات مکمل!" : "All required documents completed!"}
          </p>
        </div>
      )}
    </div>
  );
}