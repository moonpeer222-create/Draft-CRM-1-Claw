import { useState, useEffect } from "react";
import { toast } from "../../lib/toast";
import { useTheme } from "../../lib/ThemeContext";
import { motion, AnimatePresence } from "motion/react";
import { staggerContainer, staggerItem, modalVariants } from "../../lib/animations";
import { NotificationService } from "../../lib/notifications";
import {
  Users, ShieldCheck, Shield, User as UserIcon, Check, Search, UserPlus, RefreshCw,
  Crown, Mail, EyeOff, Eye, Trash2, X, Key,
  Edit
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type UserRole = "master_admin" | "admin" | "agent" | "customer" | "operator";

interface ProfileUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_seen: string | null;
}

export function AdminUserManagement() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const labelCls = `block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`;

  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<ProfileUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPwModal, setShowResetPwModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [newUser, setNewUser] = useState({
    fullName: "", email: "", password: "", role: "customer" as UserRole,
  });
  const [editData, setEditData] = useState<Partial<ProfileUser>>({});

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { applyFilters(); }, [searchTerm, roleFilter, users]);

  const loadUsers = async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      setUsers(data as ProfileUser[]);
    } else {
      toast.error(isUrdu ? "صارفین لوڈ نہیں ہوئے" : "Failed to load users");
    }
  };

  const applyFilters = () => {
    let filtered = [...users];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        (u.full_name || "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") filtered = filtered.filter(u => u.role === roleFilter);
    setFilteredUsers(filtered);
  };

  const handleCreateUser = async () => {
    if (!newUser.fullName || !newUser.email || !newUser.password) {
      toast.error("Please fill all required fields"); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
      toast.error("Invalid email format"); return;
    }
    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters"); return;
    }
    const existing = users.find(u => u.email.toLowerCase() === newUser.email.trim().toLowerCase());
    if (existing) {
      toast.error("Email already exists"); return;
    }

    const lt = toast.loading("Creating user...");
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newUser.email.trim(),
        password: newUser.password,
        options: { data: { full_name: newUser.fullName.trim() } },
      });
      if (signUpError || !signUpData.user) {
        toast.dismiss(lt);
        toast.error(signUpError?.message || "Account creation failed");
        return;
      }
      await supabase.from("profiles").update({
        role: newUser.role,
        full_name: newUser.fullName.trim(),
      }).eq("id", signUpData.user.id);

      toast.dismiss(lt);
      toast.success(`${newUser.fullName} created!`);
      NotificationService.notifyUserCreated(newUser.fullName, newUser.role);
      setShowCreateModal(false);
      setNewUser({ fullName: "", email: "", password: "", role: "customer" });
      loadUsers();
    } catch (err: any) {
      toast.dismiss(lt);
      toast.error(err?.message || "Error creating user");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    const lt = toast.loading("Updating user...");
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: editData.full_name,
        email: editData.email,
        role: editData.role,
      }).eq("id", selectedUser.id);
      if (error) throw error;
      toast.dismiss(lt);
      toast.success("User updated successfully!");
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err: any) {
      toast.dismiss(lt);
      toast.error(err?.message || "Update failed");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    const lt = toast.loading("Sending reset email...");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
        redirectTo: window.location.origin + "/",
      });
      if (error) throw error;
      toast.dismiss(lt);
      toast.success(`Password reset email sent to ${selectedUser.email}`);
      setShowResetPwModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      toast.dismiss(lt);
      toast.error(err?.message || "Failed to send reset email");
    }
  };

  const handleDeleteUser = async (user: ProfileUser) => {
    if (user.role === "master_admin") { toast.error("Cannot delete master admin"); return; }
    if (!confirm(`Delete ${user.full_name || user.email}? This action cannot be undone.`)) return;
    const lt = toast.loading("Deleting user...");
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", user.id);
      if (error) throw error;
      toast.dismiss(lt);
      toast.success("User deleted!");
      loadUsers();
    } catch (err: any) {
      toast.dismiss(lt);
      toast.error(err?.message || "Delete failed");
    }
  };

  const getRoleIcon = (role: UserRole) => {
    const map: Record<string, any> = { master_admin: Crown, admin: ShieldCheck, agent: Shield, customer: UserIcon, operator: Shield };
    return map[role] || UserIcon;
  };

  const getRoleColor = (role: UserRole) => {
    const colors: Record<string, string> = {
      master_admin: dc ? "bg-purple-900/30 text-purple-400 border-purple-600" : "bg-purple-100 text-purple-700 border-purple-200",
      admin: dc ? "bg-indigo-900/30 text-indigo-400 border-indigo-600" : "bg-indigo-100 text-indigo-700 border-indigo-200",
      agent: dc ? "bg-blue-900/30 text-blue-400 border-blue-600" : "bg-blue-100 text-blue-700 border-blue-200",
      customer: dc ? "bg-gray-700 text-gray-300 border-gray-500" : "bg-gray-100 text-gray-700 border-gray-200",
      operator: dc ? "bg-teal-900/30 text-teal-400 border-teal-600" : "bg-teal-100 text-teal-700 border-teal-200",
    };
    return colors[role] || colors.customer;
  };

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === "admin" || u.role === "master_admin").length,
    agents: users.filter(u => u.role === "agent").length,
    customers: users.filter(u => u.role === "customer").length,
    operators: users.filter(u => u.role === "operator").length,
  };

  return (
    <div className={`${isUrdu ? fontClass : ""} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      <div className="p-3 sm:p-4 md:p-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>{isUrdu ? "صارف انتظام" : "User Management"}</h1>
            <p className={sub}>{isUrdu ? "ایڈمنز، ایجنٹس اور صارفین کا انتظام" : "Manage admins, agents, and customers"}</p>
          </div>
          <div className="flex gap-3">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={loadUsers} className={`flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm transition-all ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-white"}`}>
              <RefreshCw className="w-4 h-4" /> {isUrdu ? "تازہ کریں" : "Refresh"}
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg">
              <UserPlus className="w-4 h-4" /> {isUrdu ? "نیا صارف بنائیں" : "Create User"}
            </motion.button>
          </div>
        </motion.div>

        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: isUrdu ? "کل صارفین" : "Total Users", value: stats.total, icon: Users, color: "text-blue-600" },
            { label: isUrdu ? "ایڈمنز" : "Admins", value: stats.admins, icon: ShieldCheck, color: "text-indigo-600" },
            { label: isUrdu ? "ایجنٹس" : "Agents", value: stats.agents, icon: Shield, color: "text-purple-600" },
            { label: isUrdu ? "صارفین" : "Customers", value: stats.customers, icon: UserIcon, color: "text-orange-600" },
            { label: isUrdu ? "آپریٹرز" : "Operators", value: stats.operators, icon: Check, color: "text-green-600" },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <motion.div key={idx} variants={staggerItem} whileHover={{ y: -4 }} className={`${card} rounded-xl shadow-lg p-4 border ${dc ? "border-gray-700" : "border-gray-100"}`}>
                <Icon className={`w-7 h-7 ${stat.color} mb-2`} />
                <h3 className={`text-2xl font-bold ${txt}`}>{stat.value}</h3>
                <p className={`text-xs ${sub}`}>{stat.label}</p>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${card} rounded-2xl shadow-lg p-4 md:p-6 mb-6`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={isUrdu ? "نام یا ای میل سے تلاش..." : "Search by name or email..."} className={`${inputCls} pl-12`} />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputCls}>
              <option value="all">{isUrdu ? "تمام کردار" : "All Roles"}</option>
              <option value="master_admin">{isUrdu ? "ماسٹر ایڈمن" : "Master Admin"}</option>
              <option value="admin">{isUrdu ? "ایڈمن" : "Admin"}</option>
              <option value="agent">{isUrdu ? "ایجنٹ" : "Agent"}</option>
              <option value="customer">{isUrdu ? "صارف" : "Customer"}</option>
              <option value="operator">{isUrdu ? "آپریٹر" : "Operator"}</option>
            </select>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${card} rounded-2xl shadow-lg overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${dc ? "bg-gray-700" : "bg-gray-50"} border-b ${dc ? "border-gray-600" : "border-gray-200"}`}>
                <tr>
                  {[isUrdu ? "صارف" : "User", isUrdu ? "رابطہ" : "Contact", isUrdu ? "کردار" : "Role", isUrdu ? "اعمال" : "Actions"].map((h) => (
                    <th key={h} className={`text-left py-4 px-4 md:px-6 text-xs font-semibold uppercase tracking-wider ${dc ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => {
                  const RoleIcon = getRoleIcon(user.role);
                  return (
                    <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }} className={`border-b transition-colors ${dc ? "border-gray-700/50 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50"}`}>
                      <td className="py-4 px-4 md:px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            user.role === "master_admin" ? "bg-gradient-to-br from-purple-500 to-purple-600" :
                            user.role === "admin" ? "bg-gradient-to-br from-amber-500 to-amber-600" :
                            user.role === "agent" ? "bg-gradient-to-br from-blue-400 to-blue-600" :
                            "bg-gradient-to-br from-cyan-400 to-cyan-600"
                          }`}>
                            {(user.full_name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-semibold text-sm ${txt}`}>{user.full_name || "—"}</p>
                            <p className={`text-xs ${sub}`}>{user.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 md:px-6">
                        <div className={`flex items-center gap-2 text-sm ${sub}`}><Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate max-w-[180px]">{user.email}</span></div>
                      </td>
                      <td className="py-4 px-4 md:px-6">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${getRoleColor(user.role)}`}>
                          <RoleIcon className="w-3.5 h-3.5" />
                          <span className="text-xs font-semibold capitalize">{user.role.replace("_", " ")}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 md:px-6">
                        <div className="flex gap-1">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setSelectedUser(user); setEditData({ full_name: user.full_name, email: user.email, role: user.role }); setShowEditModal(true); }} className={`p-2 text-blue-600 rounded-lg ${dc ? "hover:bg-blue-900/20" : "hover:bg-blue-50"}`} title="Edit"><Edit className="w-4 h-4" /></motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setSelectedUser(user); setShowResetPwModal(true); }} className={`p-2 text-amber-600 rounded-lg ${dc ? "hover:bg-amber-900/20" : "hover:bg-amber-50"}`} title="Reset password"><Key className="w-4 h-4" /></motion.button>
                          {user.role !== "master_admin" && (
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDeleteUser(user)} className={`p-2 text-red-600 rounded-lg ${dc ? "hover:bg-red-900/20" : "hover:bg-red-50"}`} title="Delete"><Trash2 className="w-4 h-4" /></motion.button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
              <p className={sub}>{isUrdu ? "کوئی صارف نہیں ملا" : "No users found"}</p>
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()} className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
              <div className={`flex items-center justify-between p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "نیا صارف بنائیں" : "Create New User"}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowCreateModal(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X className="w-5 h-5" /></motion.button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className={labelCls}>{isUrdu ? "کردار *" : "Role *"}</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })} className={inputCls}>
                    <option value="customer">{isUrdu ? "صارف" : "Customer"}</option>
                    <option value="agent">{isUrdu ? "ایجنٹ" : "Agent"}</option>
                    <option value="admin">{isUrdu ? "ایڈمن" : "Admin"}</option>
                    <option value="operator">{isUrdu ? "آپریٹر" : "Operator"}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{isUrdu ? "پورا نام *" : "Full Name *"}</label>
                  <input type="text" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} className={inputCls} placeholder={isUrdu ? "پورا نام درج کریں" : "Enter full name"} />
                </div>
                <div>
                  <label className={labelCls}>{isUrdu ? "ای میل *" : "Email *"}</label>
                  <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className={inputCls} placeholder="email@example.com" dir="ltr" />
                </div>
                <div>
                  <label className={labelCls}>{isUrdu ? "پاس ورڈ *" : "Password *"}</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className={inputCls} placeholder={isUrdu ? "کم از کم 6 حروف" : "Min 6 characters"} dir="ltr" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${sub}`}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className={`flex gap-3 p-6 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowCreateModal(false)} className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{isUrdu ? "منسوخ" : "Cancel"}</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCreateUser} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center justify-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  {isUrdu ? "صارف بنائیں" : "Create User"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditModal && selectedUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()} className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-md`}>
              <div className={`flex items-center justify-between p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "صارف میں ترمیم" : "Edit User"}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowEditModal(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X className="w-5 h-5" /></motion.button>
              </div>
              <div className="p-6 space-y-4">
                <div><label className={labelCls}>{isUrdu ? "پورا نام" : "Full Name"}</label><input type="text" value={editData.full_name || ""} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>{isUrdu ? "ای میل" : "Email"}</label><input type="email" value={editData.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className={inputCls} dir="ltr" /></div>
                <div><label className={labelCls}>{isUrdu ? "کردار" : "Role"}</label>
                  <select value={editData.role || ""} onChange={(e) => setEditData({ ...editData, role: e.target.value as UserRole })} className={inputCls} disabled={selectedUser.role === "master_admin"}>
                    <option value="customer">{isUrdu ? "صارف" : "Customer"}</option>
                    <option value="agent">{isUrdu ? "ایجنٹ" : "Agent"}</option>
                    <option value="admin">{isUrdu ? "ایڈمن" : "Admin"}</option>
                    <option value="operator">{isUrdu ? "آپریٹر" : "Operator"}</option>
                    <option value="master_admin">{isUrdu ? "ماسٹر ایڈمن" : "Master Admin"}</option>
                  </select>
                </div>
              </div>
              <div className={`flex gap-3 p-6 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowEditModal(false)} className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{isUrdu ? "منسوخ" : "Cancel"}</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleUpdateUser} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">{isUrdu ? "محفوظ کریں" : "Save"}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResetPwModal && selectedUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowResetPwModal(false)}>
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()} className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-sm`}>
              <div className={`flex items-center justify-between p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "پاس ورڈ ری سیٹ" : "Reset Password"}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowResetPwModal(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X className="w-5 h-5" /></motion.button>
              </div>
              <div className="p-6">
                <p className={`text-sm ${sub} mb-4`}>{isUrdu ? `ایک پاس ورڈ ری سیٹ ای میل بھیجیں ${selectedUser.email || selectedUser.full_name} کو` : `Send a password reset email to ${selectedUser.email || selectedUser.full_name}?`}</p>
              </div>
              <div className={`flex gap-3 p-6 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowResetPwModal(false)} className={`flex-1 py-3 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{isUrdu ? "منسوخ" : "Cancel"}</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleResetPassword} className="flex-1 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold">{isUrdu ? "بھیجیں" : "Send Email"}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
