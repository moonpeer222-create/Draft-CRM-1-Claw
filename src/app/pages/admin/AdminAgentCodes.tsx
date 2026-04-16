import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { Users, Mail, Search, Download, Shield, Send, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "../../lib/toast";
import { motion } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { supabase } from "../../lib/supabase";

interface AgentRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export function AdminAgentCodes() {
  const { darkMode, t, isUrdu } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendingResetFor, setSendingResetFor] = useState<string | null>(null);

  const loadAgents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, created_at")
      .eq("role", "agent")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setAgents(data as AgentRow[]);
    } else {
      toast.error(isUrdu ? "ایجنٹس لوڈ نہیں ہوئے" : "Failed to load agents");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleSendReset = async (agent: AgentRow) => {
    setSendingResetFor(agent.id);
    const { error } = await supabase.auth.resetPasswordForEmail(agent.email, {
      redirectTo: window.location.origin + "/agent/login",
    });
    setSendingResetFor(null);
    if (!error) {
      toast.success(isUrdu ? `پاس ورڈ ری سیٹ ای میل بھیجی گئی ${agent.email}` : `Password reset email sent to ${agent.email}`);
    } else {
      toast.error(error.message);
    }
  };

  const handleDownload = () => {
    const csv = [
      "Name,Email,Joined",
      ...filteredAgents.map(a => `"${a.full_name || ""}","${a.email}","${new Date(a.created_at).toLocaleDateString()}"`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agents-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isUrdu ? "CSV ڈاؤنلوڈ ہو گئی" : "Agents exported!");
  };

  const filteredAgents = agents.filter(a =>
    (a.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "ایجنٹس" : "Agent Access"}
                </h1>
                <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {isUrdu ? "ایجنٹس کا انتظام — ای میل اور پاس ورڈ ری سیٹ" : "Manage agents and send password resets"}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl p-4 mb-6 ${darkMode ? "bg-gray-800/50 border border-gray-700" : "bg-white shadow-sm"}`}>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="relative flex-1 max-w-md w-full">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? "text-gray-500" : "text-gray-400"}`} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isUrdu ? "نام یا ای میل سے تلاش..." : "Search by name or email..."}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border transition-all ${
                    darkMode ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300"
                  }`}
                />
              </div>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={loadAgents} className={`px-4 py-2.5 rounded-lg text-sm font-semibold ${darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {isUrdu ? "تازہ کریں" : "Refresh"}
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleDownload} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold ${darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600" : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"}`}>
                  <Download className="w-4 h-4" />
                  {isUrdu ? "ایکسپورٹ" : "Export"}
                </motion.button>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl overflow-hidden ${darkMode ? "bg-gray-800/50 border border-gray-700" : "bg-white shadow-sm"}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${darkMode ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-gray-50"}`}>
                    <th className={`text-left py-4 px-6 text-sm font-bold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "ایجنٹ" : "Agent"}</th>
                    <th className={`text-left py-4 px-6 text-sm font-bold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "ای میل" : "Email"}</th>
                    <th className={`text-left py-4 px-6 text-sm font-bold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "شمولیت" : "Joined"}</th>
                    <th className={`text-left py-4 px-6 text-sm font-bold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "کارروائیاں" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map((agent, index) => (
                    <motion.tr
                      key={agent.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 * index }}
                      className={`border-b ${darkMode ? "border-gray-700 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50"} transition-colors`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md bg-gradient-to-br from-blue-400 to-indigo-600">
                            {(agent.full_name || "A").charAt(0)}
                          </div>
                          <span className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                            {agent.full_name || "Agent"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{agent.email}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                          {new Date(agent.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSendReset(agent)}
                            disabled={sendingResetFor === agent.id}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors shadow-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/40 disabled:opacity-50"
                          >
                            {sendingResetFor === agent.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                            {isUrdu ? "ری سیٹ ای میل" : "Reset Password"}
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredAgents.length === 0 && !loading && (
              <div className="text-center py-16">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${darkMode ? "bg-blue-950/30" : "bg-blue-100"}`}>
                  <Shield className={`w-8 h-8 ${darkMode ? "text-blue-400" : "text-blue-600"}`} />
                </div>
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {searchTerm ? (isUrdu ? "تلاش سے کوئی ایجنٹ نہیں ملا" : "No agents match your search") : (isUrdu ? "ابھی کوئی ایجنٹ نہیں" : "No agents yet.")}
                </p>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
