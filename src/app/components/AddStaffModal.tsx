/**
 * AddStaffModal — Create new staff accounts via Supabase Auth.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, UserPlus, User, Mail, Phone, Shield, Key, Copy, Check, Loader2, Eye, EyeOff, Briefcase,
} from "lucide-react";
import { NotificationService } from "../lib/notifications";
import { toast } from "../lib/toast";
import { copyToClipboard } from "../lib/clipboard";
import { AuditLogService } from "../lib/auditLog";
import { modalVariants } from "../lib/animations";
import { supabase } from "../lib/supabase";
import { getAgentPassword } from "../lib/agentAuth";

type UserRole = "agent" | "admin" | "operator";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  isUrdu: boolean;
  createdBy: string;
  createdByRole: "admin" | "master_admin";
  onCreated?: () => void;
}

export function AddStaffModal({
  isOpen, onClose, darkMode: dc, isUrdu, createdBy, createdByRole, onCreated,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("agent");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string; role: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";
  const inputCls = `w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
    dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900"
  }`;
  const labelCls = `block text-xs font-semibold mb-1.5 ${dc ? "text-gray-300" : "text-gray-600"}`;

  const availableRoles: { value: UserRole; label: string; labelUrdu: string }[] = [
    { value: "agent", label: "Agent", labelUrdu: "ایجنٹ" },
    ...(createdByRole === "master_admin" ? [
      { value: "admin" as UserRole, label: "Admin", labelUrdu: "ایڈمن" },
      { value: "operator" as UserRole, label: "Operator", labelUrdu: "آپریٹر" },
    ] : []),
  ];

  const handleCreate = async () => {
    if (!fullName.trim()) { toast.error(isUrdu ? "نام درج کریں" : "Name is required"); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(isUrdu ? "درست ای میل درج کریں" : "Valid email required"); return;
    }
    if (!password || password.length < 6) {
      toast.error(isUrdu ? "پاس ورڈ کم از کم 6 حروف" : "Password minimum 6 characters"); return;
    }

    setSaving(true);
    try {
      // Check if email already exists in profiles
      const { data: existing } = await supabase.from("profiles").select("id").eq("email", email.trim()).maybeSingle();
      if (existing) {
        toast.error(isUrdu ? "یہ ای میل پہلے سے موجود ہے" : "Email already exists");
        setSaving(false);
        return;
      }

      // Create auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (signUpError || !signUpData.user) {
        toast.error(signUpError?.message || (isUrdu ? "اکاؤنٹ نہیں بنا" : "Account creation failed"));
        setSaving(false);
        return;
      }

      // Assign agent_id for agents (sequential AGENT-N)
      let agentId: string | undefined;
      if (role === "agent") {
        const { data: existingAgents } = await supabase
          .from("profiles")
          .select("agent_id")
          .eq("role", "agent")
          .not("agent_id", "is", null)
          .order("agent_id", { ascending: false })
          .limit(1);
        const lastNum = existingAgents && existingAgents.length > 0
          ? parseInt((existingAgents[0] as any).agent_id.replace(/\D/g, ""), 10) || 0
          : 0;
        agentId = `AGENT-${lastNum + 1}`;
      }

      // Determine final password: agents use deterministic password for code-based login
      const finalPassword = role === "agent" ? getAgentPassword(agentId!) : password;

      // Update profile with role
      const { error: updateError } = await supabase.from("profiles").update({
        role,
        full_name: fullName.trim(),
        ...(agentId ? { agent_id: agentId, agent_name: fullName.trim() } : {}),
      }).eq("id", signUpData.user.id);

      if (updateError) {
        toast.error(updateError.message);
        setSaving(false);
        return;
      }

      setCreated({ name: fullName.trim(), email: email.trim(), role });

      AuditLogService.log({
        userId: createdBy,
        userName: createdBy,
        role: createdByRole,
        action: "user_created",
        category: "user",
        description: `Created ${role} account: ${fullName} (${email})`,
        metadata: { role, email },
      });

      NotificationService.notifyUserCreated(fullName, role);
      toast.success(isUrdu ? `${fullName} اکاؤنٹ بن گیا` : `${fullName} account created!`);
      onCreated?.();
    } catch (err: any) {
      toast.error(`Error: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setFullName(""); setEmail(""); setPhone(""); setPassword("");
    setRole("agent"); setCreated(null); setCopied(false);
    onClose();
  };

  const handleCopy = async () => {
    if (!created) return;
    await copyToClipboard(`Name: ${created.name}\nEmail: ${created.email}\nRole: ${created.role}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={resetAndClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto`}
        >
          <div className={`flex items-center justify-between p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
            <h2 className={`text-lg font-bold ${txt}`}>
              {isUrdu ? "نیا اسٹاف ممبر بنائیں" : "Add New Staff Member"}
            </h2>
            <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={resetAndClose} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {!created ? (
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>{isUrdu ? "کردار *" : "Role *"}</label>
                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
                  {availableRoles.map(r => (
                    <option key={r.value} value={r.value}>{isUrdu ? r.labelUrdu : r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isUrdu ? "پورا نام *" : "Full Name *"}</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder={isUrdu ? "پورا نام" : "Full name"} />
              </div>
              <div>
                <label className={labelCls}>{isUrdu ? "ای میل *" : "Email *"}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="email@example.com" dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{isUrdu ? "فون" : "Phone"}</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+92 3XX XXXXXXX" dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{isUrdu ? "پاس ورڈ *" : "Password *"}</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder={isUrdu ? "کم از کم 6 حروف" : "Min 6 characters"} dir="ltr" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${sub}`}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-xl ${dc ? "bg-emerald-900/20 border border-emerald-700/30" : "bg-emerald-50 border border-emerald-200"}`}>
                <p className={`text-sm font-semibold ${dc ? "text-emerald-300" : "text-emerald-700"}`}>
                  {isUrdu ? "اکاؤنٹ کامیابی سے بنا" : "Account created successfully!"}
                </p>
                <div className={`mt-2 text-sm ${sub} space-y-1`}>
                  <p><span className="font-medium">{isUrdu ? "نام:" : "Name:"}</span> {created.name}</p>
                  <p><span className="font-medium">{isUrdu ? "ای میل:" : "Email:"}</span> {created.email}</p>
                  <p><span className="font-medium">{isUrdu ? "کردار:" : "Role:"}</span> {created.role}</p>
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCopy} className={`w-full py-2.5 rounded-xl border font-medium flex items-center justify-center gap-2 ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? (isUrdu ? "کاپی ہو گیا" : "Copied!") : (isUrdu ? "تفصیلات کاپی کریں" : "Copy details")}
              </motion.button>
            </div>
          )}

          <div className={`flex gap-3 p-6 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
            {!created ? (
              <>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={resetAndClose} className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                  {isUrdu ? "منسوخ" : "Cancel"}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCreate} disabled={saving} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {isUrdu ? "بنائیں" : "Create"}
                </motion.button>
              </>
            ) : (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={resetAndClose} className="w-full py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold">
                {isUrdu ? "ٹھیک ہے" : "Done"}
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
