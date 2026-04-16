import { useState } from "react";
import { Copy, Check, MessageSquare, Mail, Phone, Send, Building2, User, ChevronRight, X } from "lucide-react";
import { toast } from "../lib/toast";
import { useTheme } from "../lib/ThemeContext";
import { copyToClipboard } from "../lib/clipboard";
import { Case, getStageLabel, getOverdueInfo, getDelayReasonLabel } from "../lib/mockData";
import { motion, AnimatePresence } from "motion/react";

interface TemplateProps {
  caseData: Case;
  onClose: () => void;
}

type Channel = "whatsapp" | "sms" | "email";
type Audience = "customer" | "agent";

interface Template {
  id: string;
  name: string;
  nameUrdu: string;
  audience: Audience;
  channel: Channel;
  subject?: string;
  body: string;
  bodyUrdu: string;
}

function generateTemplates(c: Case): Template[] {
  const oi = getOverdueInfo(c);
  const stage = getStageLabel(c.status);
  const stageUrdu = getStageLabel(c.status, true);
  const reason = c.delayReason ? getDelayReasonLabel(c.delayReason) : "";
  const reasonUrdu = c.delayReason ? getDelayReasonLabel(c.delayReason, true) : "";

  return [
    // Customer WhatsApp
    {
      id: "cust-wa-reminder",
      name: "Customer Reminder (WhatsApp)",
      nameUrdu: "کسٹمر یاد دہانی (واٹس ایپ)",
      audience: "customer",
      channel: "whatsapp",
      body: `Assalamualaikum ${c.customerName},\n\nThis is a reminder from *Emerald Visa Consultancy* regarding your case *${c.id}*.\n\nYour application is currently at the *${stage}* stage${oi.isOverdue ? ` and is *${oi.timeLabel}*` : ""}.\n\n${reason ? `Delay reason: ${reason}\n\n` : ""}${c.status === "payment_confirmation" || c.status === "remaining_amount" ? `Outstanding amount: PKR ${(c.totalFee - c.paidAmount).toLocaleString()}\n\n` : ""}Please contact us if you need any assistance.\n\nThank you,\nEmerald Visa Team\n📞 +92 318 6986259`,
      bodyUrdu: `السلام علیکم ${c.customerName},\n\nیہ *ایمرالڈ ویزا کنسلٹنسی* کی طرف سے آپ کے کیس *${c.id}* کے حوالے سے یاد دہانی ہے۔\n\nآپ کی درخواست ابھی *${stageUrdu}* مرحلے پر ہے${oi.isOverdue ? ` اور *${oi.timeLabel}* تاخیر ہو چکی ہے` : ""}۔\n\n${reasonUrdu ? `تاخیر کی وجہ: ${reasonUrdu}\n\n` : ""}مزید مدد کے لیے رابطہ کریں۔\n\nشکریہ،\nایمرالڈ ویزا ٹیم\n📞 +92 318 6986259`,
    },
    // Customer SMS
    {
      id: "cust-sms-reminder",
      name: "Customer Reminder (SMS)",
      nameUrdu: "کسٹمر یاد دہانی (ایس ایم ایس)",
      audience: "customer",
      channel: "sms",
      body: `Emerald Visa: Dear ${c.customerName}, your case ${c.id} is at ${stage} stage${oi.isOverdue ? ` (${oi.timeLabel})` : ""}. ${c.totalFee - c.paidAmount > 0 ? `Pending: PKR ${(c.totalFee - c.paidAmount).toLocaleString()}. ` : ""}Call +92 318 6986259 for help.`,
      bodyUrdu: `ایمرالڈ ویزا: ${c.customerName}، آپ کا کیس ${c.id} ${stageUrdu} مرحلے پر ہے${oi.isOverdue ? ` (${oi.timeLabel})` : ""}۔ ${c.totalFee - c.paidAmount > 0 ? `واجب: PKR ${(c.totalFee - c.paidAmount).toLocaleString()}۔ ` : ""}مدد: +92 318 6986259`,
    },
    // Customer Email
    {
      id: "cust-email-reminder",
      name: "Customer Email Reminder",
      nameUrdu: "کسٹمر ای میل یاد دہانی",
      audience: "customer",
      channel: "email",
      subject: `[Emerald Visa] Case ${c.id} Update — ${stage}`,
      body: `Dear ${c.customerName},\n\nWe are writing to provide you with an update on your visa application (Case ID: ${c.id}).\n\nCurrent Stage: ${stage}\n${oi.isOverdue ? `Status: Delayed — ${oi.timeLabel}\n` : ""}${reason ? `Reason for Delay: ${reason}\n` : ""}Agent Assigned: ${c.agentName}\n\nPayment Summary:\n  Total Fee: PKR ${c.totalFee.toLocaleString()}\n  Paid: PKR ${c.paidAmount.toLocaleString()}\n  Remaining: PKR ${(c.totalFee - c.paidAmount).toLocaleString()}\n\n${oi.isOverdue ? "We sincerely apologize for the delay and assure you that our team is working diligently to move your application forward.\n\n" : ""}If you have any questions, please don't hesitate to contact us:\n  Phone: +92 318 6986259\n  WhatsApp: wa.me/923186986259\n\nBest Regards,\nEmerald Visa Consultancy Service\nLahore, Pakistan`,
      bodyUrdu: `محترم ${c.customerName},\n\nآپ کی ویزا درخواست (کیس: ${c.id}) کے حوالے سے اپ ڈیٹ:\n\nموجودہ مرحلہ: ${stageUrdu}\n${oi.isOverdue ? `حالت: تاخیر — ${oi.timeLabel}\n` : ""}${reasonUrdu ? `تاخیر کی وجہ: ${reasonUrdu}\n` : ""}ایجنٹ: ${c.agentName}\n\nادائیگی:\n  کل فیس: PKR ${c.totalFee.toLocaleString()}\n  ادا شدہ: PKR ${c.paidAmount.toLocaleString()}\n  باقی: PKR ${(c.totalFee - c.paidAmount).toLocaleString()}\n\nرابطہ: +92 318 6986259\n\nایمرالڈ ویزا کنسلٹنسی`,
    },
    // Agent WhatsApp
    {
      id: "agent-wa-followup",
      name: "Agent Follow-up (WhatsApp)",
      nameUrdu: "ایجنٹ فالو اپ (واٹس ایپ)",
      audience: "agent",
      channel: "whatsapp",
      body: `*⚠️ OVERDUE CASE ALERT*\n\nHi ${c.agentName},\n\nCase *${c.id}* (${c.customerName}) is *${oi.timeLabel}* at stage *${stage}*.\n\n${reason ? `Reported reason: ${reason}\n` : ""}Customer phone: ${c.phone}\n\n*Action Required:* Please follow up immediately and update the case status.\n\n— Emerald Visa Admin`,
      bodyUrdu: `*⚠️ تاخیر شدہ کیس الرٹ*\n\n${c.agentName}،\n\nکیس *${c.id}* (${c.customerName}) *${oi.timeLabel}* — مرحلہ: *${stageUrdu}*\n\n${reasonUrdu ? `وجہ: ${reasonUrdu}\n` : ""}کسٹمر فون: ${c.phone}\n\n*ایکشن:* فوری فالو اپ کریں اور کیس اپ ڈیٹ کریں۔\n\n— ایمرالڈ ویزا ایڈمن`,
    },
    // Agent SMS
    {
      id: "agent-sms-followup",
      name: "Agent Follow-up (SMS)",
      nameUrdu: "ایجنٹ فالو اپ (ایس ایم ایس)",
      audience: "agent",
      channel: "sms",
      body: `URGENT: Case ${c.id} (${c.customerName}) ${oi.timeLabel} at ${stage}. Follow up now. Customer: ${c.phone}`,
      bodyUrdu: `فوری: کیس ${c.id} (${c.customerName}) ${oi.timeLabel} — ${stageUrdu}۔ فالو اپ کریں۔ کسٹمر: ${c.phone}`,
    },
  ];
}

export function OverdueNotificationTemplates({ caseData, onClose }: TemplateProps) {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [copied, setCopied] = useState(false);
  const [audienceFilter, setAudienceFilter] = useState<"all" | Audience>("all");
  const [langToggle, setLangToggle] = useState<"en" | "ur">(isUrdu ? "ur" : "en");

  const allTemplates = generateTemplates(caseData);
  const templates = audienceFilter === "all" ? allTemplates : allTemplates.filter(t => t.audience === audienceFilter);

  const channelIcons: Record<Channel, typeof MessageSquare> = {
    whatsapp: MessageSquare,
    sms: Phone,
    email: Mail,
  };

  const channelColors: Record<Channel, string> = {
    whatsapp: "text-green-500",
    sms: "text-blue-500",
    email: "text-purple-500",
  };

  const handleCopy = (text: string) => {
    copyToClipboard(text);
    setCopied(true);
    toast.success(isUrdu ? "کاپی ہو گیا!" : "Message copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = (phone: string, text: string) => {
    const encoded = encodeURIComponent(text);
    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    window.open(`https://wa.me/${cleanPhone.replace("+", "")}?text=${encoded}`, "_blank");
    toast.success(isUrdu ? "واٹس ایپ کھل رہا ہے..." : "Opening WhatsApp...");
  };

  const getBody = (t: Template) => langToggle === "ur" ? t.bodyUrdu : t.body;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 25 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${brd} flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/15 rounded-xl">
              <Send className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "اطلاعی پیغامات" : "Notification Templates"}</h2>
              <p className={`text-xs ${sub}`}>{caseData.id} — {caseData.customerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className={`flex rounded-lg border overflow-hidden ${brd}`}>
              <button
                onClick={() => setLangToggle("en")}
                className={`px-3 py-1.5 text-xs font-semibold transition-all ${langToggle === "en" ? "bg-blue-600 text-white" : dc ? "bg-gray-700 text-gray-400" : "bg-gray-50 text-gray-600"}`}
              >EN</button>
              <button
                onClick={() => setLangToggle("ur")}
                className={`px-3 py-1.5 text-xs font-semibold transition-all ${langToggle === "ur" ? "bg-blue-600 text-white" : dc ? "bg-gray-700 text-gray-400" : "bg-gray-50 text-gray-600"}`}
              >اردو</button>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Audience filter */}
        <div className={`flex gap-2 px-5 py-3 border-b ${brd} flex-shrink-0`}>
          {[
            { key: "all" as const, label: isUrdu ? "تمام" : "All", icon: Send },
            { key: "customer" as const, label: isUrdu ? "کسٹمر" : "Customer", icon: User },
            { key: "agent" as const, label: isUrdu ? "ایجنٹ" : "Agent", icon: Building2 },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setAudienceFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                audienceFilter === f.key
                  ? "bg-blue-600 text-white"
                  : dc ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <f.icon className="w-3 h-3" />
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {!selectedTemplate ? (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {templates.map((tmpl, idx) => {
                  const ChannelIcon = channelIcons[tmpl.channel];
                  return (
                    <motion.button
                      key={tmpl.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      whileHover={{ x: 4, scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl text-left border-2 transition-all ${dc ? "border-gray-700 bg-gray-700/30 hover:border-gray-600" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"}`}
                    >
                      <div className={`p-2 rounded-lg ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                        <ChannelIcon className={`w-4 h-4 ${channelColors[tmpl.channel]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${txt}`}>{langToggle === "ur" ? tmpl.nameUrdu : tmpl.name}</p>
                        <p className={`text-xs mt-0.5 ${sub} truncate`}>
                          {getBody(tmpl).substring(0, 80)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tmpl.audience === "customer" ? "bg-blue-500/15 text-blue-500" : "bg-purple-500/15 text-purple-500"
                        }`}>
                          {tmpl.audience === "customer" ? (isUrdu ? "کسٹمر" : "Customer") : (isUrdu ? "ایجنٹ" : "Agent")}
                        </span>
                        <ChevronRight className={`w-4 h-4 ${sub}`} />
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className={`flex items-center gap-1.5 text-xs font-semibold mb-4 ${dc ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}
                >
                  ← {isUrdu ? "واپس" : "Back to templates"}
                </button>

                {/* Template info */}
                <div className={`flex items-center gap-3 mb-4`}>
                  <div className={`p-2 rounded-lg ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                    {(() => { const Icon = channelIcons[selectedTemplate.channel]; return <Icon className={`w-5 h-5 ${channelColors[selectedTemplate.channel]}`} />; })()}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${txt}`}>{langToggle === "ur" ? selectedTemplate.nameUrdu : selectedTemplate.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedTemplate.audience === "customer" ? "bg-blue-500/15 text-blue-500" : "bg-purple-500/15 text-purple-500"
                      }`}>
                        {selectedTemplate.audience === "customer" ? "Customer" : "Agent"}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        selectedTemplate.channel === "whatsapp" ? "bg-green-500/15 text-green-500" :
                        selectedTemplate.channel === "sms" ? "bg-blue-500/15 text-blue-500" : "bg-purple-500/15 text-purple-500"
                      }`}>
                        {selectedTemplate.channel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subject for email */}
                {selectedTemplate.subject && (
                  <div className={`mb-3 p-3 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                    <p className={`text-xs font-semibold ${sub}`}>{isUrdu ? "عنوان:" : "Subject:"}</p>
                    <p className={`text-sm font-bold ${txt}`}>{selectedTemplate.subject}</p>
                  </div>
                )}

                {/* Message body */}
                <div className={`p-4 rounded-xl border-2 ${dc ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50"}`}>
                  <pre className={`text-sm whitespace-pre-wrap font-sans leading-relaxed ${txt} ${langToggle === "ur" ? fontClass + " text-right" : ""}`} dir={langToggle === "ur" ? "rtl" : "ltr"}>
                    {getBody(selectedTemplate)}
                  </pre>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleCopy(getBody(selectedTemplate))}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${dc ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
                  >
                    {copied ? <Check className="w-4 h-4 text-blue-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? (isUrdu ? "کاپی ہو گیا!" : "Copied!") : (isUrdu ? "کاپی" : "Copy")}
                  </motion.button>

                  {selectedTemplate.channel === "whatsapp" && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSendWhatsApp(
                        selectedTemplate.audience === "customer" ? caseData.phone : "",
                        getBody(selectedTemplate)
                      )}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 shadow-lg shadow-green-500/20"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {isUrdu ? "واٹس ایپ بھیجیں" : "Send via WhatsApp"}
                    </motion.button>
                  )}

                  {selectedTemplate.channel === "sms" && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        window.open(`sms:${caseData.phone}?body=${encodeURIComponent(getBody(selectedTemplate))}`);
                        toast.success(isUrdu ? "ایس ایم ایس ایپ کھل رہا ہے..." : "Opening SMS app...");
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                    >
                      <Phone className="w-4 h-4" />
                      {isUrdu ? "ایس ایم ایس بھیجیں" : "Send SMS"}
                    </motion.button>
                  )}

                  {selectedTemplate.channel === "email" && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        window.open(`mailto:${caseData.email}?subject=${encodeURIComponent(selectedTemplate.subject || "")}&body=${encodeURIComponent(getBody(selectedTemplate))}`);
                        toast.success(isUrdu ? "ای میل ایپ کھل رہا ہے..." : "Opening email client...");
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 shadow-lg shadow-purple-500/20"
                    >
                      <Mail className="w-4 h-4" />
                      {isUrdu ? "ای میل بھیجیں" : "Send Email"}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}