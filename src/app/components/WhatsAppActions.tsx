import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { Case } from "../lib/mockData";
import {
  WHATSAPP_TEMPLATES, WhatsAppTemplate,
  sendWhatsAppMessage, getMessagePreview
} from "../lib/whatsapp";
import {
  MessageCircle, Send, Eye, X, Copy, Check,
  Stethoscope, CreditCard, FileText, Plane, Shield, MessageSquare,
  ChevronDown, ExternalLink, Globe
} from "lucide-react";
import { toast } from "../lib/toast";
import { copyToClipboard } from "../lib/clipboard";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  medical: Stethoscope,
  payment: CreditCard,
  document: FileText,
  visa: Plane,
  protector: Shield,
  general: MessageSquare,
};

const CATEGORY_COLORS: Record<string, string> = {
  medical: "from-orange-500 to-amber-500",
  payment: "from-green-500 to-green-600",
  document: "from-blue-500 to-indigo-500",
  visa: "from-purple-500 to-violet-500",
  protector: "from-cyan-500 to-teal-500",
  general: "from-gray-500 to-slate-500",
};

interface Props {
  caseData: Case;
  compact?: boolean;
}

export function WhatsAppActions({ caseData, compact = false }: Props) {
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;
  const [showPanel, setShowPanel] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<"en" | "ur">("en");
  const [copied, setCopied] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const templateData = {
    ...caseData,
    customerName: caseData.customerName,
    phone: caseData.phone,
  };

  const handleSend = (templateId: string, useUrdu: boolean) => {
    sendWhatsAppMessage(templateId, templateData, useUrdu);
    toast.success(
      isUrdu ? "واٹس ایپ میسج بھیجا جا رہا ہے..." : "Opening WhatsApp with pre-filled message..."
    );
  };

  const handleCopyMessage = (templateId: string, useUrdu: boolean) => {
    const message = getMessagePreview(templateId, templateData, useUrdu);
    if (message) {
      copyToClipboard(message).then(() => {
        setCopied(true);
        toast.success(isUrdu ? "میسج کاپی ہو گیا" : "Message copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        toast.error(isUrdu ? "کاپی نہیں ہو سکا" : "Failed to copy");
      });
    }
  };

  const previewMessage = previewTemplate
    ? getMessagePreview(previewTemplate, templateData, previewLang === "ur")
    : null;

  // Group templates by category
  const categories = Array.from(new Set(WHATSAPP_TEMPLATES.map(t => t.category)));

  // Quick action for compact mode - suggest best template based on stage
  const getSuggestedTemplate = (): WhatsAppTemplate | null => {
    const statusToTemplate: Record<string, string> = {
      document_collection: "document_request",
      medical_token: "medical_guide",
      check_medical: "medical_guide",
      payment_confirmation: "payment_reminder",
      approved: "visa_approval",
      remaining_amount: "payment_reminder",
      ticket_booking: "ticket_confirmation",
    };
    const templateId = statusToTemplate[caseData.status];
    return templateId ? WHATSAPP_TEMPLATES.find(t => t.id === templateId) || null : null;
  };

  const suggestedTemplate = getSuggestedTemplate();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Quick WhatsApp button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowPanel(!showPanel)}
          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-shadow"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </motion.button>

        {/* Suggested quick action */}
        {suggestedTemplate && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSend(suggestedTemplate.id, isUrdu)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            title={suggestedTemplate.name}
          >
            <Send className="w-3 h-3" />
            {isUrdu ? suggestedTemplate.nameUrdu : suggestedTemplate.name}
          </motion.button>
        )}

        {/* Template panel popup */}
        <AnimatePresence>
          {showPanel && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPanel(false)}
                className="fixed inset-0 z-40"
              />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={`absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-50 border overflow-hidden ${
                  dc ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                }`}
              >
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-500 to-green-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      <span className="font-semibold text-sm">
                        {isUrdu ? "واٹس ایپ ٹیمپلیٹس" : "WhatsApp Templates"}
                      </span>
                    </div>
                    <button onClick={() => setShowPanel(false)} className="p-1 hover:bg-white/20 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {WHATSAPP_TEMPLATES.map(template => {
                    const CatIcon = CATEGORY_ICONS[template.category] || MessageSquare;
                    return (
                      <motion.button
                        key={template.id}
                        whileHover={{ x: 4 }}
                        onClick={() => handleSend(template.id, isUrdu)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                          dc ? "hover:bg-gray-700" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[template.category]} flex items-center justify-center text-white`}>
                          <CatIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${dc ? "text-white" : "text-gray-900"}`}>
                            {isUrdu ? template.nameUrdu : template.name}
                          </p>
                          <p className={`text-xs truncate ${dc ? "text-gray-400" : "text-gray-500"}`}>
                            {template.description}
                          </p>
                        </div>
                        <ExternalLink className={`w-3.5 h-3.5 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full panel view
  return (
    <div className={`rounded-2xl border overflow-hidden ${
      dc ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
    }`}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-green-500 to-green-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {isUrdu ? "واٹس ایپ ایکشنز" : "WhatsApp Actions"}
              </h3>
              <p className="text-xs text-white/70">
                {isUrdu ? "ٹیمپلیٹ کے ساتھ میسج بھیجیں" : "Send templated messages to customer"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70">{isUrdu ? "کسٹمر" : "Customer"}</p>
            <p className="text-sm font-medium">{caseData.phone}</p>
          </div>
        </div>
      </div>

      {/* Templates by category */}
      <div className="p-3 space-y-2">
        {categories.map(category => {
          const templates = WHATSAPP_TEMPLATES.filter(t => t.category === category);
          const CatIcon = CATEGORY_ICONS[category] || MessageSquare;
          const isExpanded = expandedCategory === category;

          return (
            <div key={category} className={`rounded-xl border transition-all ${
              dc ? "border-gray-700" : "border-gray-100"
            }`}>
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  dc ? "hover:bg-gray-700/50" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[category]} flex items-center justify-center text-white`}>
                    <CatIcon className="w-4 h-4" />
                  </div>
                  <span className={`text-sm font-semibold capitalize ${dc ? "text-white" : "text-gray-900"}`}>
                    {category}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                    {templates.length}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""} ${dc ? "text-gray-500" : "text-gray-400"}`} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2">
                      {templates.map(template => (
                        <div key={template.id} className={`p-3 rounded-xl ${dc ? "bg-gray-700/30" : "bg-gray-50"}`}>
                          <p className={`text-sm font-medium mb-1 ${dc ? "text-white" : "text-gray-900"}`}>
                            {isUrdu ? template.nameUrdu : template.name}
                          </p>
                          <p className={`text-xs mb-3 ${dc ? "text-gray-400" : "text-gray-500"}`}>
                            {template.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleSend(template.id, false)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              English
                            </motion.button>
                            {template.getMessageTextUrdu && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleSend(template.id, true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                              >
                                <Globe className="w-3 h-3" />
                                اردو
                              </motion.button>
                            )}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setPreviewTemplate(template.id);
                                setPreviewLang("en");
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                dc ? "bg-gray-600 text-gray-300 hover:bg-gray-500" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              {isUrdu ? "دیکھیں" : "Preview"}
                            </motion.button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewTemplate && previewMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewTemplate(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${
                dc ? "bg-gray-800" : "bg-white"
              }`}
            >
              <div className="p-4 bg-gradient-to-r from-green-500 to-green-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  <span className="font-bold">{isUrdu ? "پیش نظارہ" : "Message Preview"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewLang(previewLang === "en" ? "ur" : "en")}
                    className="px-2 py-1 bg-white/20 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors"
                  >
                    {previewLang === "en" ? "اردو" : "English"}
                  </button>
                  <button onClick={() => setPreviewTemplate(null)} className="p-1 hover:bg-white/20 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                <pre className={`text-sm whitespace-pre-wrap font-sans leading-relaxed ${
                  dc ? "text-gray-300" : "text-gray-700"
                } ${previewLang === "ur" ? "text-right" : ""}`}
                  dir={previewLang === "ur" ? "rtl" : "ltr"}
                >
                  {getMessagePreview(previewTemplate, templateData, previewLang === "ur")}
                </pre>
              </div>
              <div className={`p-3 border-t flex items-center justify-between ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCopyMessage(previewTemplate, previewLang === "ur")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    copied
                      ? "bg-blue-500 text-white"
                      : dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? (isUrdu ? "کاپی ہو گیا" : "Copied!") : (isUrdu ? "کاپی" : "Copy")}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    handleSend(previewTemplate, previewLang === "ur");
                    setPreviewTemplate(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {isUrdu ? "واٹس ایپ پر بھیجیں" : "Send via WhatsApp"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}