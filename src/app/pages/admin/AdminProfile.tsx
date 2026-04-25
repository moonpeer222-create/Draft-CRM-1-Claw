import { useState, useEffect, useRef } from "react";
import { AdminHeader } from "../../components/AdminHeader";
import { AdminSidebar } from "../../components/AdminSidebar";

import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem, modalVariants } from "../../lib/animations";
import {
  User, Mail, Phone, Shield, Camera, Lock, Eye, EyeOff, Save,
  Calendar, MapPin, Building2, Clock, Activity, FileText, CreditCard,
  CheckCircle, X, Edit, Globe, Bell, Key, Moon, Sun, Monitor, LogOut
} from "lucide-react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/ThemeContext";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";

const PROFILE_KEY = "crm_admin_profile";

interface AdminProfileData {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
  address: string;
  city: string;
  country: string;
  joinDate: string;
  timezone: string;
  bio: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    weeklyReport: boolean;
  };
  lastLogin: string;
  loginCount: number;
}

function getAdminProfile(base?: { full_name?: string | null; email?: string; created_at?: string } | null): AdminProfileData {
  const stored = localStorage.getItem(PROFILE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fall through
    }
  }
  const defaultProfile: AdminProfileData = {
    fullName: base?.full_name || "Admin",
    email: base?.email || "",
    phone: "",
    role: "admin",
    avatar: "",
    address: "Registered Office Address",
    city: "City Name",
    country: "Country",
    joinDate: base?.created_at || "2024-01-01T00:00:00Z",
    timezone: "Asia/Karachi (PKT)",
    bio: "",
    notifications: {
      email: true,
      sms: true,
      push: true,
      weeklyReport: true,
    },
    lastLogin: new Date().toISOString(),
    loginCount: 247,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(defaultProfile));
  return defaultProfile;
}

function saveAdminProfile(profile: AdminProfileData) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function AdminProfile() {
  const { darkMode, isUrdu, fontClass, t, toggleDarkMode, toggleLanguage, language } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const labelCls = `block text-sm mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`;

  const { profile: sbProfile } = useSupabaseAuth();
  const [profile, setProfile] = useState<AdminProfileData>(getAdminProfile(sbProfile));
  const [activeTab, setActiveTab] = useState<"personal" | "security" | "notifications" | "activity" | "preferences">("personal");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<AdminProfileData>(profile);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [agents, setAgents] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);

  useEffect(() => {
    setProfile(getAdminProfile(sbProfile));
    setEditData(getAdminProfile(sbProfile));
  }, [sbProfile?.id]);

  useEffect(() => {
    const fetchAgents = async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "agent");
      if (!error && data) setAgents(data);
    };
    fetchAgents();
  }, []);

  useEffect(() => {
    const fetchCases = async () => {
      const { data, error } = await supabase.from('cases').select('*');
      if (!error && data) setCases(data.map((r: any) => mapSupabaseCaseToLocal(r)));
    };
    fetchCases();
  }, []);

  // Live stats from Supabase
  const totalCases = cases.length;
  const completedCases = cases.filter((c: any) => c.status === "completed").length;
  const totalRevenue = cases.reduce((sum, c: any) => sum + c.paidAmount, 0);
  const activeAgents = agents.length;

  // Activity log from live data
  const recentActivity = [
    ...cases.slice(0, 3).map((c: any) => ({
      id: `case-${c.id}`,
      icon: FileText,
      text: `Case ${c.id} created for ${c.customerName}`,
      time: new Date(c.createdDate).toLocaleDateString(),
      color: "text-blue-500",
    })),
    ...cases.filter((c: any) => c.payments.length > 0).slice(0, 3).map((c: any) => ({
      id: `pay-${c.id}`,
      icon: CreditCard,
      text: `PKR ${c.payments[c.payments.length - 1].amount.toLocaleString()} received from ${c.customerName}`,
      time: new Date(c.payments[c.payments.length - 1].date).toLocaleDateString(),
      color: "text-blue-500",
    })),
    ...cases.filter((c: any) => c.status === "completed").slice(0, 2).map((c: any) => ({
      id: `complete-${c.id}`,
      icon: CheckCircle,
      text: `Case ${c.id} completed for ${c.customerName}`,
      time: new Date(c.updatedDate).toLocaleDateString(),
      color: "text-green-500",
    })),
  ].slice(0, 10);

  const handleSaveProfile = () => {
    const lt = toast.loading(isUrdu ? "پروفائل محفوظ ہو رہا ہے..." : "Saving profile...");
    setTimeout(() => {
      saveAdminProfile(editData);
      setProfile(editData);
      setIsEditing(false);
      toast.dismiss(lt);
      toast.success(isUrdu ? "پروفائل کامیابی سے اپ ڈیٹ ہو گئی!" : "Profile updated successfully!");
    }, 800);
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error(isUrdu ? "تمام فیلڈز بھریں" : "Please fill all fields");
      return;
    }
    if (passwords.new.length < 6) {
      toast.error(isUrdu ? "پاس ورڈ کم از کم 6 حروف" : "Password must be at least 6 characters");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error(isUrdu ? "پاس ورڈ مطابقت نہیں رکھتے" : "Passwords do not match");
      return;
    }
    const lt = toast.loading(isUrdu ? "پاس ورڈ تبدیل ہو رہا ہے..." : "Changing password...");
    try {
      // Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwords.current,
      });
      if (signInError) {
        toast.dismiss(lt);
        toast.error(isUrdu ? "موجودہ پاس ورڈ غلط ہے" : "Current password is incorrect");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwords.new,
      });
      toast.dismiss(lt);
      if (!updateError) {
        toast.success(isUrdu ? "پاس ورڈ کامیابی سے تبدیل ہو گیا!" : "Password changed successfully!");
        setShowPasswordModal(false);
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        toast.error(isUrdu ? "پاس ورڈ تبدیل نہیں ہو سکا" : "Password change failed");
      }
    } catch (err: any) {
      toast.dismiss(lt);
      toast.error(isUrdu ? `خرابی: ${err.message}` : `Error: ${err.message}`);
    }
  };

  const handleNotificationToggle = (key: keyof AdminProfileData["notifications"]) => {
    const updated = {
      ...profile,
      notifications: { ...profile.notifications, [key]: !profile.notifications[key] },
    };
    setProfile(updated);
    saveAdminProfile(updated);
    toast.success(
      `${key.charAt(0).toUpperCase() + key.slice(1)} notifications ${updated.notifications[key] ? "enabled" : "disabled"}`
    );
  };

  const tabs = [
    { id: "personal" as const, label: isUrdu ? "ذاتی معلومات" : "Personal Info", icon: User },
    { id: "security" as const, label: isUrdu ? "سیکیورٹی" : "Security", icon: Lock },
    { id: "notifications" as const, label: isUrdu ? "اطلاعات" : "Notifications", icon: Bell },
    { id: "activity" as const, label: isUrdu ? "سرگرمی" : "Activity", icon: Activity },
    { id: "preferences" as const, label: isUrdu ? "ترجیحات" : "Preferences", icon: Globe },
  ];

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>
              {isUrdu ? "پروفائل" : "My Profile"}
            </h1>
            <p className={sub}>{isUrdu ? "اپنی ذاتی معلومات اور ترتیبات کا انتظام کریں" : "Manage your personal information and account settings"}</p>
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
                  className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl shadow-blue-500/20"
                >
                  {profile.fullName.charAt(0).toUpperCase()}
                </motion.div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toast.info(isUrdu ? "پروفائل فوٹو اپ ڈیٹ (جلد آ رہا ہے)" : "Profile photo update (coming with Supabase)")}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Info */}
              <div className="flex-1">
                <h2 className={`text-xl font-bold ${txt}`}>{profile.fullName}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${dc ? "bg-purple-900/30 text-purple-400 border-purple-600" : "bg-purple-100 text-purple-700 border-purple-200"}`}>
                    <Shield className="w-3 h-3" /> {isUrdu ? "ماسٹر ایڈمن" : "Master Admin"}
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

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: isUrdu ? "کل کیسز" : "Total Cases", value: totalCases, color: "text-blue-500" },
                  { label: isUrdu ? "مکمل" : "Completed", value: completedCases, color: "text-green-500" },
                  { label: isUrdu ? "ایجنٹس" : "Agents", value: activeAgents, color: "text-purple-500" },
                  { label: isUrdu ? "آمدنی" : "Revenue", value: `PKR ${(totalRevenue / 1000).toFixed(0)}K`, color: "text-blue-500" },
                ].map((stat) => (
                  <div key={stat.label} className={`text-center p-3 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                    <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                    <p className={`text-[10px] ${sub}`}>{stat.label}</p>
                  </div>
                ))}
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
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="w-4 h-4" /> {isUrdu ? "ترمیم" : "Edit"}
                    </motion.button>
                  ) : (
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => setIsEditing(false)} className={`px-4 py-2 border rounded-xl transition-colors ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"}`}>
                        {isUrdu ? "منسوخ" : "Cancel"}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={handleSaveProfile} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                        <Save className="w-4 h-4" /> {isUrdu ? "محفوظ" : "Save"}
                      </motion.button>
                    </div>
                  )}
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelCls}><User className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "پورا نام" : "Full Name"}</label>
                    {isEditing ? (
                      <input type="text" value={editData.fullName} onChange={(e) => setEditData({ ...editData, fullName: e.target.value })} className={inputCls} />
                    ) : (
                      <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>{profile.fullName}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}><Mail className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "ای میل" : "Email"}</label>
                    {isEditing ? (
                      <input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className={inputCls} />
                    ) : (
                      <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>{profile.email}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}><Phone className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "فون" : "Phone"}</label>
                    {isEditing ? (
                      <input type="tel" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className={inputCls} />
                    ) : (
                      <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>{profile.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}><MapPin className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "پتہ" : "Address"}</label>
                    {isEditing ? (
                      <input type="text" value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} className={inputCls} />
                    ) : (
                      <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>{profile.address}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}><Building2 className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "شہر" : "City"}</label>
                    {isEditing ? (
                      <input type="text" value={editData.city} onChange={(e) => setEditData({ ...editData, city: e.target.value })} className={inputCls} />
                    ) : (
                      <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>{profile.city}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}><Globe className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "ملک" : "Country"}</label>
                    {isEditing ? (
                      <input type="text" value={editData.country} onChange={(e) => setEditData({ ...editData, country: e.target.value })} className={inputCls} />
                    ) : (
                      <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>{profile.country}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}><Clock className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "ٹائم زون" : "Timezone"}</label>
                    <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>{profile.timezone}</p>
                  </div>
                  <div>
                    <label className={labelCls}><Calendar className="w-3.5 h-3.5 inline mr-1" />{isUrdu ? "شامل ہونے کی تاریخ" : "Join Date"}</label>
                    <p className={`py-2.5 px-4 rounded-xl ${dc ? "bg-gray-700/50 text-gray-200" : "bg-gray-50 text-gray-900"}`}>{new Date(profile.joinDate).toLocaleDateString()}</p>
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

            {/* Security Tab */}
            {activeTab === "security" && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Change Password */}
                <div className={`${card} rounded-2xl shadow-lg border p-6 ${dc ? "border-gray-700" : "border-gray-100"}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl ${dc ? "bg-blue-900/30" : "bg-blue-100"}`}>
                      <Lock className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className={`font-bold ${txt}`}>{isUrdu ? "پاس ورڈ تبدیل کریں" : "Change Password"}</h3>
                      <p className={`text-sm ${sub}`}>{isUrdu ? "اپنا پاس ورڈ تبدیل کریں" : "Update your account password"}</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPasswordModal(true)}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    {isUrdu ? "پاس ورڈ تبدیل کریں" : "Change Password"}
                  </motion.button>
                </div>

                {/* Session Info */}
                <div className={`${card} rounded-2xl shadow-lg border p-6 ${dc ? "border-gray-700" : "border-gray-100"}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl ${dc ? "bg-blue-900/30" : "bg-blue-100"}`}>
                      <Key className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className={`font-bold ${txt}`}>{isUrdu ? "سیشن کی معلومات" : "Session Information"}</h3>
                      <p className={`text-sm ${sub}`}>{isUrdu ? "موجودہ لاگ ان سیشن" : "Current login session details"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "آخری لاگ ان" : "Last Login"}</p>
                      <p className={`font-semibold ${txt}`}>{new Date(profile.lastLogin).toLocaleString()}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "کل لاگ ان" : "Total Logins"}</p>
                      <p className={`font-semibold ${txt}`}>{profile.loginCount}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "حیثیت" : "Status"}</p>
                      <p className="font-semibold text-green-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> {isUrdu ? "فعال" : "Active"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Access Codes Stats */}
                <div className={`${card} rounded-2xl shadow-lg border p-6 ${dc ? "border-gray-700" : "border-gray-100"}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl ${dc ? "bg-purple-900/30" : "bg-purple-100"}`}>
                      <Shield className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h3 className={`font-bold ${txt}`}>{isUrdu ? "ایجنٹ ایکسیس کوڈز" : "Agent Access Codes"}</h3>
                      <p className={`text-sm ${sub}`}>{isUrdu ? "ایجنٹ لاگ ان کوڈ کا انتظام" : "Manage agent login codes"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-xl text-center ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className="text-2xl font-bold text-blue-500">{agents.length}</p>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "کل ایجنٹس" : "Total Agents"}</p>
                    </div>
                    <div className={`p-4 rounded-xl text-center ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className="text-2xl font-bold text-green-500">{activeAgents}</p>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "فعال" : "Active"}</p>
                    </div>
                    <div className={`p-4 rounded-xl text-center ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className="text-2xl font-bold text-orange-500">{agents.length - activeAgents}</p>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "غیر فعال" : "Inactive"}</p>
                    </div>
                    <div className={`p-4 rounded-xl text-center ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className="text-2xl font-bold text-purple-500">6h</p>
                      <p className={`text-xs ${sub}`}>{isUrdu ? "سیشن مدت" : "Session Duration"}</p>
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
                  <p className={`text-sm mt-1 ${sub}`}>{isUrdu ? "منتخب کریں کہ آپ کو کیسے مطلع کیا جائے" : "Choose how you want to be notified"}</p>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { key: "email" as const, label: isUrdu ? "ای میل اطلاعات" : "Email Notifications", desc: isUrdu ? "ای میل کے ذریعے اطلاعات وصول کریں" : "Receive notifications via email", icon: Mail },
                    { key: "sms" as const, label: isUrdu ? "SMS اطلاعات" : "SMS Notifications", desc: isUrdu ? "SMS کے ذریعے اطلاعات وصول کریں" : "Receive notifications via SMS", icon: Phone },
                    { key: "push" as const, label: isUrdu ? "پش اطلاعات" : "Push Notifications", desc: isUrdu ? "براؤزر پش اطلاعات" : "Browser push notifications", icon: Bell },
                    { key: "weeklyReport" as const, label: isUrdu ? "ہفتہ وار رپورٹ" : "Weekly Report", desc: isUrdu ? "ہر ہفتے خلاصہ رپورٹ" : "Receive weekly summary report", icon: FileText },
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
                  <p className={`text-sm mt-1 ${sub}`}>{isUrdu ? "سسٹم میں آپ کی حالیہ سرگرمیاں" : "Your recent actions in the system"}</p>
                </div>
                <div className="p-6">
                  <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                    {recentActivity.map((item, idx) => {
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
                        setTimeout(() => window.location.href = "/admin/login", 1000);
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

      {/* Change Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPasswordModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()} className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-md`}>
              <div className={`flex items-center justify-between p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "پاس ورڈ تبدیل کریں" : "Change Password"}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowPasswordModal(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { key: "current" as const, label: isUrdu ? "موجودہ پاس ورڈ" : "Current Password" },
                  { key: "new" as const, label: isUrdu ? "نیا پاس ورڈ" : "New Password" },
                  { key: "confirm" as const, label: isUrdu ? "پاس ورڈ کی تصدیق" : "Confirm Password" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className={labelCls}>{field.label}</label>
                    <div className="relative">
                      <input
                        type={showPasswords[field.key] ? "text" : "password"}
                        value={passwords[field.key]}
                        onChange={(e) => setPasswords({ ...passwords, [field.key]: e.target.value })}
                        className={inputCls}
                        placeholder=""
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, [field.key]: !showPasswords[field.key] })}
                        className={`absolute ${isUrdu ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 ${sub}`}
                      >
                        {showPasswords[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`flex gap-3 p-6 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowPasswordModal(false)} className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"}`}>
                  {isUrdu ? "منسوخ" : "Cancel"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleChangePassword} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">
                  {isUrdu ? "تبدیل کریں" : "Update Password"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}