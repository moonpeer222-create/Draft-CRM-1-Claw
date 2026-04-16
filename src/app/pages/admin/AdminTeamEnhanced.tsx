import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, Grid, List, Download, Phone, Mail, Eye, Edit, X, Shield, UserCheck, UserX, RefreshCw } from "lucide-react";
import { AdminHeader } from "../../components/AdminHeader";
import { AdminSidebar } from "../../components/AdminSidebar";
import { AddStaffModal } from "../../components/AddStaffModal";
import { toast } from "../../lib/toast";
import { modalVariants, staggerContainer, staggerItem } from "../../lib/animations";
import { useTheme } from "../../lib/ThemeContext";
import { AttendanceService } from "../../lib/attendanceService";
import { AuditLogService } from "../../lib/auditLog";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";

interface AgentView {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  cases: number;
  attendance: number;
  joinDate: string;
  photo: string;
  lastLogin: string | null;
}

export function AdminTeam() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentView | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<AgentView[]>([]);

  const { insideUnifiedLayout } = useUnifiedLayout();
  const [deepLinked, setDeepLinked] = useState(false);
  const location = useLocation();

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "agent")
      .order("created_at", { ascending: false });
    if (error || !data) {
      toast.error(isUrdu ? "ایجنٹس لوڈ نہیں ہوئے" : "Failed to load agents");
      setIsLoading(false);
      return;
    }
    const { data: casesData } = await supabase.from('cases').select('*');
    const allCases = (casesData || []).map((r: any) => mapSupabaseCaseToLocal(r));
    const mapped: AgentView[] = data.map((u: any) => {
      const agentCases = allCases.filter((c: any) => c.agentName === u.full_name);
      const attendanceData = AttendanceService.getRecordsForAgent(u.id || u.full_name);
      const attendancePct = attendanceData && attendanceData.length > 0
        ? Math.round((attendanceData.filter((a: any) => a.status === "present" || a.status === "late").length / attendanceData.length) * 100)
        : 100;
      return {
        id: u.id,
        userId: u.id,
        name: u.full_name || "Agent",
        phone: "",
        email: u.email || "",
        role: "Agent",
        cases: agentCases.length,
        attendance: attendancePct,
        joinDate: u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "",
        photo: (u.full_name || "A").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        lastLogin: u.last_seen || null,
      };
    });
    setAgents(mapped);
    setIsLoading(false);
  }, [isUrdu]);

  useEffect(() => {
    loadAgents();
    const interval = setInterval(loadAgents, 30000);
    return () => clearInterval(interval);
  }, [loadAgents]);

  useEffect(() => {
    const state = location.state as { highlightAgent?: string; fromNotification?: boolean } | null;
    if (state?.highlightAgent) {
      setSearchTerm(state.highlightAgent);
      const agent = agents.find(a => a.name === state.highlightAgent);
      if (agent) {
        setSelectedAgent(agent);
        setShowViewModal(true);
        if (state.fromNotification) {
          setDeepLinked(true);
          setTimeout(() => setDeepLinked(false), 3200);
          toast.success(isUrdu ? `${state.highlightAgent} کا پروفائل کھولا گیا` : `Opened profile for ${state.highlightAgent}`);
        }
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, agents]);

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditAgent = (agent: AgentView) => {
    setSelectedAgent(agent);
    setEditForm({ name: agent.name, email: agent.email });
    setShowEditModal(true);
  };

  const handleUpdateAgent = async () => {
    if (!selectedAgent) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: editForm.name,
        email: editForm.email,
      }).eq("id", selectedAgent.userId);
      if (error) throw error;

      AuditLogService.log({
        userId: "admin", userName: "Admin", role: "admin",
        action: "user_updated",
        category: "user",
        description: `Updated agent: ${editForm.name}`,
        metadata: { userId: selectedAgent.userId },
      });

      toast.success(`Agent ${editForm.name} updated!`);
      setShowEditModal(false);
      loadAgents();
    } catch (err: any) {
      toast.error(`Update failed: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAgent = (agent: AgentView) => {
    setSelectedAgent(agent);
    setShowViewModal(true);
    setDeepLinked(false);
  };

  const handleExportTeam = () => {
    const csv = [
      "Name,Email,Cases,Attendance,Join Date",
      ...agents.map(a => `"${a.name}","${a.email}",${a.cases},${a.attendance}%,"${a.joinDate}"`)
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emerald-team-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Team data exported to CSV!");
  };

  const inputCls = `w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
    dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900"
  }`;

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}

        <main className="p-3 sm:p-4 md:p-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3"
          >
            <div>
              <h1 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>{t("team.title")}</h1>
              <p className={`text-sm ${sub}`}>
                {agents.length} {isUrdu ? "ایجنٹ (لائیو ڈیٹا بیس سے)" : "agents (live from database)"}
              </p>
            </div>
            <div className="flex gap-2">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={loadAgents}
                className={`p-2.5 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddAgent(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-600 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" />
                {isUrdu ? "نیا ایجنٹ" : "Add Agent"}
              </motion.button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`${card} rounded-xl shadow-sm p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4`}
          >
            <div className="flex-1 w-full max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isUrdu ? "نام، ای میل..." : "Search name, email..."}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? (dc ? "bg-emerald-900/50 text-emerald-400" : "bg-emerald-100 text-emerald-700") : (dc ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-100")}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-all ${viewMode === "list" ? (dc ? "bg-emerald-900/50 text-emerald-400" : "bg-emerald-100 text-emerald-700") : (dc ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-100")}`}
              >
                <List className="w-5 h-5" />
              </button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handleExportTeam}
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl ml-2 text-sm ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                <Download className="w-4 h-4" />
                Export
              </motion.button>
            </div>
          </motion.div>

          {viewMode === "grid" ? (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filteredAgents.map((agent) => (
                <motion.div key={agent.id} variants={staggerItem} whileHover={{ y: -4 }}
                  className={`${card} rounded-2xl shadow-sm hover:shadow-lg border ${dc ? "border-gray-700" : "border-gray-100"} p-5 transition-all`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                      {agent.photo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold truncate ${txt}`}>{agent.name}</h3>
                      <p className={`text-xs ${sub}`}>{agent.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className={`text-center p-2 rounded-lg ${dc ? "bg-gray-700/50" : "bg-blue-50"}`}>
                      <p className={`text-[10px] font-medium ${dc ? "text-blue-400" : "text-blue-600"}`}>Cases</p>
                      <p className={`text-lg font-bold ${dc ? "text-blue-300" : "text-blue-900"}`}>{agent.cases}</p>
                    </div>
                    <div className={`text-center p-2 rounded-lg ${dc ? "bg-gray-700/50" : "bg-green-50"}`}>
                      <p className={`text-[10px] font-medium ${dc ? "text-green-400" : "text-green-600"}`}>Attendance</p>
                      <p className={`text-lg font-bold ${dc ? "text-green-300" : "text-green-900"}`}>{agent.attendance}%</p>
                    </div>
                  </div>

                  <div className={`space-y-1.5 mb-4 text-xs ${sub}`}>
                    <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /><span className="truncate">{agent.email}</span></div>
                  </div>

                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleViewAgent(agent)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleEditAgent(agent)}
                      className={`px-3 py-2 border rounded-lg text-xs ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`${card} rounded-2xl shadow-sm border ${dc ? "border-gray-700" : "border-gray-100"} overflow-hidden`}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={dc ? "bg-gray-700/50" : "bg-gray-50"}>
                    <tr>
                      {["Agent", "Email", "Cases", "Attendance", "Actions"].map(h => (
                        <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${dc ? "text-gray-300" : "text-gray-600"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr key={agent.id} className={`border-b ${dc ? "border-gray-700 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50"} transition-colors`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                              {agent.photo}
                            </div>
                            <div>
                              <p className={`font-semibold text-sm ${txt}`}>{agent.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-xs ${sub}`}>
                          <div className="truncate max-w-[150px]">{agent.email}</div>
                        </td>
                        <td className={`py-3 px-4 text-sm font-bold ${txt}`}>{agent.cases}</td>
                        <td className={`py-3 px-4 text-sm font-bold ${txt}`}>{agent.attendance}%</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5">
                            <button onClick={() => handleViewAgent(agent)} className={`p-1.5 rounded-lg ${dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleEditAgent(agent)} className={`p-1.5 rounded-lg ${dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {filteredAgents.length === 0 && !isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`text-center py-12 ${card} rounded-2xl shadow-sm`}
            >
              <p className={sub}>{isUrdu ? "کوئی ایجنٹ نہیں ملا" : "No agents found"}</p>
            </motion.div>
          )}
        </main>
      </div>

      <AddStaffModal
        isOpen={showAddAgent}
        onClose={() => setShowAddAgent(false)}
        darkMode={dc}
        isUrdu={isUrdu}
        createdBy="admin"
        createdByRole="admin"
        onCreated={() => {
          loadAgents();
          setShowAddAgent(false);
        }}
      />

      <AnimatePresence>
        {showViewModal && selectedAgent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowViewModal(false)}
          >
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${deepLinked ? "ring-2 ring-blue-400 ring-offset-2" : ""}`}
            >
              {deepLinked && (
                <div className="bg-gradient-to-r from-blue-500/20 to-transparent px-5 py-2 border-b border-blue-500/30 rounded-t-2xl">
                  <span className="text-xs font-medium text-blue-400">{isUrdu ? "اطلاع سے کھولا گیا" : "Opened from notification"}</span>
                </div>
              )}
              <div className={`flex items-center justify-between p-5 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "ایجنٹ تفصیلات" : "Agent Details"}</h2>
                <button onClick={() => setShowViewModal(false)} className={`p-2 rounded-xl ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-5 mb-5">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {selectedAgent.photo}
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${txt}`}>{selectedAgent.name}</h3>
                    <p className={`text-sm ${sub}`}>{selectedAgent.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className={`p-3 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                    <p className={`text-xs ${sub}`}>Cases</p>
                    <p className="text-xl font-bold text-blue-500">{selectedAgent.cases}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                    <p className={`text-xs ${sub}`}>Attendance</p>
                    <p className="text-xl font-bold text-green-500">{selectedAgent.attendance}%</p>
                  </div>
                </div>

                <div className={`space-y-2 text-sm ${sub}`}>
                  <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> {selectedAgent.email}</div>
                  {selectedAgent.lastLogin && (
                    <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> {isUrdu ? "آخری لاگ ان: " : "Last login: "} {new Date(selectedAgent.lastLogin).toLocaleString()}</div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showEditModal && selectedAgent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-md`}
            >
              <div className={`flex items-center justify-between p-5 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "ایجنٹ میں ترمیم" : "Edit Agent"}</h2>
                <button onClick={() => setShowEditModal(false)} className={`p-2 rounded-xl ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${dc ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "نام" : "Name"}</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${dc ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "ای میل" : "Email"}</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className={`flex gap-3 p-5 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <button onClick={() => setShowEditModal(false)} className={`flex-1 py-2.5 rounded-xl border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                  {isUrdu ? "منسوخ" : "Cancel"}
                </button>
                <button onClick={handleUpdateAgent} disabled={isLoading} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold disabled:opacity-60">
                  {isLoading ? (isUrdu ? "محفوظ ہو رہا ہے..." : "Saving...") : (isUrdu ? "محفوظ کریں" : "Save Changes")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
