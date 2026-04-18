import { AgentSidebar } from "../../components/AgentSidebar";
import { AgentHeader } from "../../components/AgentHeader";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { useState, useEffect, useRef } from "react";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem, modalVariants } from "../../lib/animations";
import {
  User, Mail, Phone, Shield, Camera, Save, Calendar,
  MapPin, Clock, Activity, FileText, CreditCard, CheckCircle,
  Edit, Bell, Briefcase, Star, TrendingUp, Target, Globe, Moon, Sun, Monitor,
  Settings as SettingsIcon, LogOut, Trash2, ImagePlus
} from "lucide-react";
import { pushAgentProfile, pushAgentAvatar, pullAgentAvatar } from "../../lib/syncService";
import { NotificationService } from "../../lib/notifications";
import { useTheme } from "../../lib/ThemeContext";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

const AGENT_PROFILE_KEY = "crm_agent_profile";
const AGENT_AVATAR_KEY = "crm_agent_avatar";

// --- Avatar helpers (exported for use in AgentHeader) ---
export function getAgentAvatar(agentName: string): string | null {
  return localStorage.getItem(`${AGENT_AVATAR_KEY}_${agentName}`) || null;
}
function saveAgentAvatar(agentName: string, dataUrl: string) {
  localStorage.setItem(`${AGENT_AVATAR_KEY}_${agentName}`, dataUrl);
}
function removeAgentAvatar(agentName: string) {
  localStorage.removeItem(`${AGENT_AVATAR_KEY}_${agentName}`);
}

interface AgentProfileData {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  address: string;
  city: string;
  joinDate: string;
  bio: string;
  specialization: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

function getAgentProfile(agentName: string): AgentProfileData {
  const key = `${AGENT_PROFILE_KEY}_${agentName}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  const defaultProfile: AgentProfileData = {
    fullName: agentName,
    email: `${agentName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    phone: "",
    role: "Agent",
    address: "Registered Office Address",
    city: "City Name",
    joinDate: "2024-03-01T00:00:00Z",
    bio: `Technology solutions agent. Specializing in client support and digital services.`,
    specialization: "Gulf Countries",
    notifications: { email: true, sms: true, push: true },
  };
  localStorage.setItem(key, JSON.stringify(defaultProfile));
  return defaultProfile;
}

function saveAgentProfile(agentName: string, profile: AgentProfileData) {
  const key = `${AGENT_PROFILE_KEY}_${agentName}`;
  localStorage.setItem(key, JSON.stringify(profile));
}

export function AgentProfile() {
  const { darkMode, isUrdu, fontClass, t, toggleDarkMode, toggleLanguage, language } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = `w-full px-4 py-3 sm:py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base sm:text-sm ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const labelCls = `block text-sm mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`;

  // Get current agent session
  const { profile: sbProfile, signOut } = useSupabaseAuth();
  const agentName = sbProfile?.full_name || sbProfile?.email || "Agent";
  const agentId = sbProfile?.id || "";

  const [profile, setProfile] = useState<AgentProfileData>(getAgentProfile(agentName));
  const [activeTab, setActiveTab] = useState<"personal" | "performance" | "notifications" | "activity" | "preferences">("personal");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<AgentProfileData>(profile);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(getAgentAvatar(agentName));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On mount: pull avatar from cloud if not in localStorage
  useEffect(() => {
    if (!avatarUrl && agentName) {
      pullAgentAvatar(agentName).then((cloudAvatar) => {
        if (cloudAvatar) setAvatarUrl(cloudAvatar);
      });
    }
  }, [agentName]);

  // Live stats from Supabase
  const [myCases, setMyCases] = useState<any[]>([]);
  useEffect(() => {
    const fetchCases = async () => {
      const { data } = await supabase.from('cases').select('*');
      const cases = (data || []).map(mapSupabaseCaseToLocal);
      setMyCases(cases.filter(c => c.agentName === agentName || c.agentId === agentId));
    };
    fetchCases();
  }, [agentName, agentId]);

  const activeCases = myCases.filter(c => !["completed", "rejected"].includes(c.status));
  const completedCases = myCases.filter(c => c.status === "completed");
  const totalRevenue = myCases.reduce((sum, c) => sum + c.paidAmount, 0);
  const avgProcessing = myCases.length > 0
    ? Math.round(myCases.reduce((sum, c) => {
        const created = new Date(c.createdDate).getTime();
        const updated = new Date(c.updatedDate).getTime();
        return sum + (updated - created) / (1000 * 60 * 60 * 24);
      }, 0) / myCases.length)
    : 0;

  const performanceStats = [
    { label: isUrdu ? "کل کیسز" : "Total Cases", value: myCases.length, icon: Briefcase, color: "text-blue-500" },
    { label: isUrdu ? "فعال" : "Active", value: activeCases.length, icon: TrendingUp, color: "text-orange-500" },
    { label: isUrdu ? "مکمل" : "Completed", value: completedCases.length, icon: CheckCircle, color: "text-green-500" },
    { label: isUrdu ? "آمدنی" : "Revenue", value: `PKR ${(totalRevenue / 1000).toFixed(0)}K`, icon: CreditCard, color: "text-blue-500" },
    { label: isUrdu ? "اوسط دن" : "Avg Days", value: `${avgProcessing}d`, icon: Clock, color: "text-purple-500" },
    { label: isUrdu ? "درجہ بندی" : "Rating", value: "4.8", icon: Star, color: "text-yellow-500" },
  ];

  // Recent activity from agent's cases
  const recentActivity = [
    ...myCases.slice(0, 4).map(c => ({
      id: `case-${c.id}`,
      icon: FileText,
      text: `${isUrdu ? "کیس" : "Case"} ${c.id} - ${c.customerName} (${c.status})`,
      time: new Date(c.updatedDate).toLocaleDateString(),
      color: "text-blue-500",
    })),
    ...myCases.filter(c => c.payments.length > 0).slice(0, 3).map(c => ({
      id: `pay-${c.id}`,
      icon: CreditCard,
      text: `PKR ${c.payments[c.payments.length - 1].amount.toLocaleString()} - ${c.customerName}`,
      time: new Date(c.payments[c.payments.length - 1].date).toLocaleDateString(),
      color: "text-blue-500",
    })),
  ].slice(0, 8);

  // Country breakdown from live data
  const countryBreakdown = myCases.reduce((acc, c) => {
    acc[c.country] = (acc[c.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleSaveProfile = () => {
    const lt = toast.loading(isUrdu ? "پروفائل محفوظ ہو رہا ہے..." : "Saving profile...");
    setTimeout(() => {
      saveAgentProfile(agentName, editData);
      setProfile(editData);
      setIsEditing(false);
      toast.dismiss(lt);
      toast.success(isUrdu ? "پروفائل اپ ڈیٹ ہو گئی!" : "Profile updated successfully!");
      pushAgentProfile(agentName);
      // Notify admin about profile update
      NotificationService.addNotification({
        type: "agent",
        priority: "low",
        title: "Agent Profile Updated",
        titleUrdu: "ایجنٹ پروفائل اپ ڈیٹ ہو گئی",
        message: `${agentName} updated their profile information`,
        messageUrdu: `${agentName} نے اپنی پروفائل معلومات اپ ڈیٹ کیں`,
        actionable: false,
        targetRole: "admin",
        metadata: { agentName, action: "profile_update" },
      });
    }, 800);
  };

  const handleNotificationToggle = (key: keyof AgentProfileData["notifications"]) => {
    const updated = {
      ...profile,
      notifications: { ...profile.notifications, [key]: !profile.notifications[key] },
    };
    setProfile(updated);
    saveAgentProfile(agentName, updated);
    toast.success(`${key} notifications ${updated.notifications[key] ? "enabled" : "disabled"}`);
    // Sync preference change to cloud
    pushAgentProfile(agentName);
  };

  // --- Photo Upload Handler ---
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(isUrdu ? "صرف تصویری فائلیں اپ لوڈ کریں" : "Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(isUrdu ? "تصویر 2MB سے چھوٹی ہونی چاہیے" : "Image must be smaller than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      // Resize image to keep localStorage lean
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 256;
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const resized = canvas.toDataURL("image/jpeg", 0.85);
        saveAgentAvatar(agentName, resized);
        setAvatarUrl(resized);
        toast.success(isUrdu ? "فوٹو اپ ڈیٹ ہو گئی!" : "Photo updated successfully!");
        // Sync avatar to cloud + create notification
        pushAgentAvatar(agentName);
        NotificationService.addNotification({
          type: "agent",
          priority: "low",
          title: "Profile Photo Updated",
          titleUrdu: "پروفائل فوٹو اپ ڈیٹ ہو گئی",
          message: `${agentName} updated their profile photo`,
          messageUrdu: `${agentName} نے اپنی پروفائل فوٹو اپ ڈیٹ کی`,
          actionable: false,
          targetRole: "admin",
          metadata: { agentName, action: "photo_upload" },
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleRemovePhoto = () => {
    removeAgentAvatar(agentName);
    setAvatarUrl(null);
    toast.success(isUrdu ? "فوٹو ہٹا دی گئی" : "Photo removed");
    // Sync removal to cloud + create notification
    pushAgentAvatar(agentName);
    NotificationService.addNotification({
      type: "agent",
      priority: "low",
      title: "Profile Photo Removed",
      titleUrdu: "پروفائل فوٹو ہٹا دی گئی",
      message: `${agentName} removed their profile photo`,
      messageUrdu: `${agentName} نے اپنی پروفائل فوٹو ہٹا دی`,
      actionable: false,
      targetRole: "admin",
      metadata: { agentName, action: "photo_remove" },
    });
  };

  const tabs = [
    { id: "personal" as const, label: isUrdu ? "ذاتی معلومات" : "Personal Info", icon: User },
    { id: "performance" as const, label: isUrdu ? "کارکردگی" : "Performance", icon: TrendingUp },
    { id: "notifications" as const, label: isUrdu ? "اطلاعات" : "Notifications", icon: Bell },
    { id: "activity" as const, label: isUrdu ? "سرگرمی" : "Activity", icon: Activity },
    { id: "preferences" as const, label: isUrdu ? "ترجیحات" : "Preferences", icon: SettingsIcon },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AgentSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AgentHeader />}
        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>
              {isUrdu ? "میرا پروفائل" : "My Profile"}
            </h1>
            <p className={sub}>{isUrdu ? "ذاتی معلومات اور کارکردگی دیکھیں" : "View your personal info and performance metrics"}</p>
          </motion.div>

          {/* Profile Header Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${card} rounded-2xl shadow-lg p-6 mb-6 border ${dc ? "border-gray-700" : "border-gray-100"}`}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Avatar */}
              <div className="relative group">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl shadow-blue-500/20 overflow-hidden"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={agentName} className="w-full h-full object-cover" />
                  ) : (
                    agentName.charAt(0).toUpperCase()
                  )}
                </motion.div>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                {/* Upload / Change button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="w-4 h-4" />
                </motion.button>
                {/* Remove button (only when photo exists) */}
                {avatarUrl && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleRemovePhoto}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <h2 className={`text-xl font-bold ${txt}`}>{agentName}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${dc ? "bg-blue-900/30 text-blue-400 border-blue-600" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                    <Shield className="w-3 h-3" /> {profile.role}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-sm ${sub}`}>
                    <Mail className="w-3.5 h-3.5" /> {profile.email}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-sm ${sub}`}>
                    <Phone className="w-3.5 h-3.5" /> {profile.phone}
                  </span>
                </div>
                <p className={`mt-2 text-sm ${sub}`}>{profile.bio}</p>
              </div>

              {/* Session Info */}
              <div className={`p-4 rounded-xl border ${dc ? "border-gray-700 bg-gray-700/30" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className={`text-xs font-semibold ${txt}`}>{isUrdu ? "سیشن" : "Session"}</span>
                </div>
                <p className={`text-xs ${sub}`}>
                  {isUrdu ? "حیثیت" : "Status"}: {isUrdu ? "فعال" : "Active"}
                </p>
                <p className="text-xs text-blue-500 font-medium mt-1">
                  {sbProfile?.last_seen ? new Date(sbProfile.last_seen).toLocaleTimeString() : "—"} {isUrdu ? "آخری سرگرمی" : "Last active"}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <div className={`flex gap-1 mb-6 p-1 rounded-xl ${dc ? "bg-gray-800" : "bg-gray-200/60"} overflow-x-auto scrollbar-hide snap-x`}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all snap-start ${
                    activeTab === tab.id
                      ? dc
                        ? "bg-blue-600/20 text-blue-400 shadow-sm"
                        : "bg-white text-blue-700 shadow-sm"
                      : dc
                        ? "text-gray-400 hover:text-gray-200"
                        : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </motion.button>
              );
            })}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {/* Personal Info Tab */}
            {activeTab === "personal" && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`${card} rounded-2xl shadow-lg border ${dc ? "border-gray-700" : "border-gray-100"}`}
              >
                <div className={`flex items-center justify-between p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                  <h3 className={`font-bold ${txt}`}>{isUrdu ? "ذاتی معلومات" : "Personal Information"}</h3>
                  {!isEditing ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setEditData(profile); setIsEditing(true); }}
                      className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="w-4 h-4" /> {isUrdu ? "ترمیم" : "Edit"}
                    </motion.button>
                  ) : (
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => setIsEditing(false)} className={`px-4 py-2.5 min-h-[44px] border rounded-xl ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"}`}>
                        {isUrdu ? "منسوخ" : "Cancel"}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={handleSaveProfile} className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                        <Save className="w-4 h-4" /> {isUrdu ? "محفوظ" : "Save"}
                      </motion.button>
                    </div>
                  )}
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: "fullName", label: isUrdu ? "پورا نام" : "Full Name", icon: User },
                    { key: "email", label: isUrdu ? "ای میل" : "Email", icon: Mail },
                    { key: "phone", label: isUrdu ? "فون" : "Phone", icon: Phone },
                    { key: "address", label: isUrdu ? "پتہ" : "Address", icon: MapPin },
                    { key: "city", label: isUrdu ? "شہر" : "City", icon: MapPin },
                    { key: "specialization", label: isUrdu ? "تخصص" : "Specialization", icon: Target },
                  ].map((field) => {
                    const Icon = field.icon;
                    return (
                      <div key={field.key}>
                        <label className={labelCls}><Icon className="w-3.5 h-3.5 inline mr-1" />{field.label}</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={(editData as any)[field.key] || ""}
                            onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                            className={inputCls}
                          />
                        ) : (
                          <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>
                            {(profile as any)[field.key] || "-"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div>
                    <label className={labelCls}><Calendar className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "شامل ہونے کی تاریخ" : "Join Date"}</label>
                    <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>
                      {new Date(profile.joinDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}><Shield className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "کردار" : "Role"}</label>
                    <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>
                      {profile.role}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>{isUrdu ? "بائیو" : "Bio"}</label>
                    {isEditing ? (
                      <textarea value={editData.bio} onChange={(e) => setEditData({ ...editData, bio: e.target.value })} rows={3} className={inputCls} />
                    ) : (
                      <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>{profile.bio}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Performance Tab */}
            {activeTab === "performance" && (
              <motion.div
                key="performance"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Stats Grid */}
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {performanceStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={stat.label}
                        variants={staggerItem}
                        whileHover={{ y: -4 }}
                        className={`${card} rounded-xl shadow-lg p-4 border text-center ${dc ? "border-gray-700" : "border-gray-100"}`}
                      >
                        <Icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                        <p className={`text-xl font-bold ${txt}`}>{stat.value}</p>
                        <p className={`text-[10px] ${sub}`}>{stat.label}</p>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Country Breakdown */}
                <div className={`${card} rounded-2xl shadow-lg border p-6 ${dc ? "border-gray-700" : "border-gray-100"}`}>
                  <h3 className={`font-bold mb-4 ${txt}`}>{isUrdu ? "ملک کی تقسیم" : "Country Breakdown"}</h3>
                  <div className="space-y-3">
                    {Object.entries(countryBreakdown).sort(([, a], [, b]) => b - a).map(([country, count]) => {
                      const pct = myCases.length > 0 ? Math.round((count / myCases.length) * 100) : 0;
                      return (
                        <div key={country}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm ${txt}`}>{country}</span>
                            <span className={`text-sm font-semibold ${txt}`}>{count} ({pct}%)</span>
                          </div>
                          <div className={`h-2 rounded-full overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(countryBreakdown).length === 0 && (
                      <p className={`text-center py-8 ${sub}`}>{isUrdu ? "ابھی کوئی کیس نہیں" : "No cases assigned yet"}</p>
                    )}
                  </div>
                </div>

                {/* Monthly Target */}
                <div className={`${card} rounded-2xl shadow-lg border p-6 ${dc ? "border-gray-700" : "border-gray-100"}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="w-5 h-5 text-blue-500" />
                    <h3 className={`font-bold ${txt}`}>{isUrdu ? "ماہانہ ہدف" : "Monthly Target"}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "کیسز ہدف" : "Cases Target"}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <p className={`text-2xl font-bold ${txt}`}>{completedCases.length}/15</p>
                        <div className={`flex-1 h-3 rounded-full overflow-hidden ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((completedCases.length / 15) * 100, 100)}%` }}
                            transition={{ duration: 1 }}
                            className="h-full bg-blue-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                    <div className={`p-4 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "آمدنی ہدف" : "Revenue Target"}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <p className={`text-2xl font-bold ${txt}`}>PKR {(totalRevenue / 1000).toFixed(0)}K/500K</p>
                        <div className={`flex-1 h-3 rounded-full overflow-hidden ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((totalRevenue / 500000) * 100, 100)}%` }}
                            transition={{ duration: 1 }}
                            className="h-full bg-blue-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`${card} rounded-2xl shadow-lg border ${dc ? "border-gray-700" : "border-gray-100"}`}
              >
                <div className={`p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                  <h3 className={`font-bold ${txt}`}>{isUrdu ? "اطلاعات کی ترتیبات" : "Notification Preferences"}</h3>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { key: "email" as const, label: isUrdu ? "ای میل اطلاعات" : "Email Notifications", desc: isUrdu ? "ای میل سے اطلاعات" : "Case updates via email", icon: Mail },
                    { key: "sms" as const, label: isUrdu ? "SMS اطلاعات" : "SMS Notifications", desc: isUrdu ? "SMS سے اطلاعات" : "Urgent alerts via SMS", icon: Phone },
                    { key: "push" as const, label: isUrdu ? "پش اطلاعات" : "Push Notifications", desc: isUrdu ? "براؤزر اطلاعات" : "Browser notifications", icon: Bell },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <motion.div
                        key={item.key}
                        whileHover={{ x: isUrdu ? -4 : 4 }}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${dc ? "border-gray-700 hover:bg-gray-700/30" : "border-gray-200 hover:bg-gray-50"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                            <Icon className={`w-4 h-4 ${dc ? "text-gray-300" : "text-gray-600"}`} />
                          </div>
                          <div>
                            <p className={`font-medium text-sm ${txt}`}>{item.label}</p>
                            <p className={`text-xs ${sub}`}>{item.desc}</p>
                          </div>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleNotificationToggle(item.key)}
                          className={`relative w-12 h-6 rounded-full transition-colors ${profile.notifications[item.key] ? "bg-blue-500" : dc ? "bg-gray-600" : "bg-gray-300"}`}
                        >
                          <motion.div
                            animate={{ x: profile.notifications[item.key] ? 24 : 2 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                          />
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Activity Tab */}
            {activeTab === "activity" && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`${card} rounded-2xl shadow-lg border ${dc ? "border-gray-700" : "border-gray-100"}`}
              >
                <div className={`p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                  <h3 className={`font-bold ${txt}`}>{isUrdu ? "حالیہ سرگرمی" : "Recent Activity"}</h3>
                  <p className={`text-sm mt-1 ${sub}`}>{isUrdu ? "آپ کے کیسز سے متعلق حالیہ سرگرمی" : "Activity from your assigned cases"}</p>
                </div>
                <div className="p-6">
                  <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                    {recentActivity.map((item) => {
                      const Icon = item.icon;
                      return (
                        <motion.div
                          key={item.id}
                          variants={staggerItem}
                          className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${dc ? "border-gray-700/50 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50"}`}
                        >
                          <div className={`p-2 rounded-lg flex-shrink-0 ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                            <Icon className={`w-4 h-4 ${item.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${txt}`}>{item.text}</p>
                            <p className={`text-xs mt-1 ${sub}`}>{item.time}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                  {recentActivity.length === 0 && (
                    <div className={`text-center py-12 ${sub}`}>
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-40" />
                      <p>{isUrdu ? "کوئی سرگرمی نہیں" : "No recent activity"}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {/* Preferences Tab */}
            {activeTab === "preferences" && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`${card} rounded-2xl shadow-lg border ${dc ? "border-gray-700" : "border-gray-100"}`}
              >
                <div className={`p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                  <h3 className={`font-bold ${txt}`}>{isUrdu ? "ترجیحات" : "Preferences"}</h3>
                  <p className={`text-sm mt-1 ${sub}`}>{isUrdu ? "اپنی ایپ کی ظاہری شکل کو حسب ضرورت بنائیں" : "Customize your app appearance"}</p>
                </div>
                <div className="p-6 space-y-4">
                  {/* Language */}
                  <motion.div
                    whileHover={{ x: isUrdu ? -4 : 4 }}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${dc ? "border-gray-700 hover:bg-gray-700/30" : "border-gray-200 hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                        <Globe className={`w-4 h-4 ${dc ? "text-gray-300" : "text-gray-600"}`} />
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${txt}`}>{isUrdu ? "زبان" : "Language"}</p>
                        <p className={`text-xs ${sub}`}>{language === "en" ? "English" : "اردو"}</p>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleLanguage}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                        dc ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      }`}
                    >
                      {language === "en" ? "اردو" : "English"}
                    </motion.button>
                  </motion.div>

                  {/* Dark Mode */}
                  <motion.div
                    whileHover={{ x: isUrdu ? -4 : 4 }}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${dc ? "border-gray-700 hover:bg-gray-700/30" : "border-gray-200 hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                        {darkMode ? <Moon className="w-4 h-4 text-blue-300" /> : <Sun className="w-4 h-4 text-orange-400" />}
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${txt}`}>{isUrdu ? "ظاہری شکل" : "Appearance"}</p>
                        <p className={`text-xs ${sub}`}>{darkMode ? (isUrdu ? "ڈارک موڈ" : "Dark Mode") : (isUrdu ? "لائٹ موڈ" : "Light Mode")}</p>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleDarkMode}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                        dc ? "bg-gray-600 text-white hover:bg-gray-500" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                      }`}
                    >
                      {darkMode ? (isUrdu ? "لائٹ پر جائیں" : "Switch to Light") : (isUrdu ? "ڈارک پر جائیں" : "Switch to Dark")}
                    </motion.button>
                  </motion.div>
                  {/* Logout (Mobile mainly) */}
                  <motion.div
                    whileHover={{ x: isUrdu ? -4 : 4 }}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors cursor-pointer ${dc ? "border-red-900/30 bg-red-900/10 hover:bg-red-900/20" : "border-red-100 bg-red-50 hover:bg-red-100"}`}
                    onClick={() => {
                        toast.success(t("loggingOut"));
                        signOut();
                        setTimeout(() => window.location.href = "/agent/login", 1000);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${dc ? "bg-red-900/30" : "bg-red-100"}`}>
                        <LogOut className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${dc ? "text-red-400" : "text-red-700"}`}>{t("logout")}</p>
                        <p className={`text-xs ${dc ? "text-red-300" : "text-red-500"}`}>{isUrdu ? "سیشن ختم کریں" : "End session"}</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

    </div>
  );
}