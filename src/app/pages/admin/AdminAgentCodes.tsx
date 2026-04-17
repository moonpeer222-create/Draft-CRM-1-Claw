import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { Users, Search, Copy, Check, MessageCircle, Clock, RefreshCw, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "../../lib/toast";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { getAgentCodesFromSupabase, AgentCodeInfo, formatTimeRemaining } from "../../lib/agentAuth";
import { copyToClipboard } from "../../lib/clipboard";

export function AdminAgentCodes() {
  const { darkMode, isUrdu } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const [agents, setAgents] = useState<AgentCodeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(6 * 60 * 60 * 1000);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";

  const loadAgents = useCallback(async () => {
    setLoading(true);
    const codes = await getAgentCodesFromSupabase();
    setAgents(codes);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAgents();
    const tick = () => {
      const window = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
      const expiry = (window + 1) * 6 * 60 * 60 * 1000;
      setTimeLeft(Math.max(0, expiry - Date.now()));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [loadAgents]);

  const handleCopy = async (agentId: string, code: string) => {
    try {
      await copyToClipboard(code);
    } catch {
      const el = document.createElement("textarea");
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedId(agentId);
    toast.success(isUrdu ? "کوڈ کاپی ہو گیا" : "Code copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareWhatsApp = (agent: AgentCodeInfo) => {
    const text = isUrdu
      ? encodeURIComponent(`سلام ${agent.agentName}!\n\nآپ کا ایمرلڈ CRM لاگ ان کوڈ:\n*${agent.code}*\n\nیہ کوڈ 6 گھنٹے کے لیے درست ہے۔ مدت ختم ہونے پر نیا کوڈ حاصل کریں۔`)
      : encodeURIComponent(`Hi ${agent.agentName}!\n\nYour Emerald CRM login code is:\n*${agent.code}*\n\nValid for 6 hours. Request a new code after expiry.`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.agentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = agents.filter((a) => a.active).length;

  return (
    <div className={`${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className={`text-2xl sm:text-3xl font-bold ${txt}`}>
                  {isUrdu ? "ایجنٹ ایکسیس کوڈز" : "Agent Access Codes"}
                </h1>
                <p className={`text-sm mt-1 ${sub}`}>
                  {isUrdu
                    ? "ایڈمن مکمل کنٹرول رکھتا ہے — واٹس ایپ پر کوڈ بھیجیں"
                    : "Admin maintains full control — send codes via WhatsApp"}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Stats + Timer */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 rounded-xl p-4 ${dc ? "bg-gray-800/60 border border-gray-700" : "bg-white shadow-sm border border-gray-100"}`}
          >
            <div className={`p-3 rounded-xl text-center ${dc ? "bg-gray-700/40" : "bg-gray-50"}`}>
              <p className="text-xl font-bold text-blue-500">{agents.length}</p>
              <p className={`text-xs ${sub}`}>{isUrdu ? "کل ایجنٹس" : "Total Agents"}</p>
            </div>
            <div className={`p-3 rounded-xl text-center ${dc ? "bg-gray-700/40" : "bg-gray-50"}`}>
              <p className="text-xl font-bold text-green-500">{activeCount}</p>
              <p className={`text-xs ${sub}`}>{isUrdu ? "فعال" : "Active"}</p>
            </div>
            <div className={`p-3 rounded-xl text-center ${dc ? "bg-gray-700/40" : "bg-gray-50"}`}>
              <p className="text-xl font-bold text-orange-500">{agents.length - activeCount}</p>
              <p className={`text-xs ${sub}`}>{isUrdu ? "غیر فعال" : "Inactive"}</p>
            </div>
            <div className={`p-3 rounded-xl text-center ${dc ? "bg-gray-700/40" : "bg-gray-50"}`}>
              <p className="text-lg font-bold text-purple-500 font-mono">{formatTimeRemaining(timeLeft)}</p>
              <p className={`text-xs ${sub}`}>{isUrdu ? "کوڈ کی باقی مدت" : "Code validity left"}</p>
            </div>
          </motion.div>

          {/* Search & Refresh */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-4 mb-6 ${dc ? "bg-gray-800/60 border border-gray-700" : "bg-white shadow-sm border border-gray-100"}`}
          >
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md w-full">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isUrdu ? "نام یا ایجنٹ ID سے تلاش..." : "Search by name or agent ID..."}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border transition-all ${
                    dc ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300"
                  }`}
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={loadAgents}
                disabled={loading}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                } disabled:opacity-50`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                {isUrdu ? "تازہ کریں" : "Refresh Codes"}
              </motion.button>
            </div>
          </motion.div>

          {/* Agent Code Cards */}
          <div className="space-y-3">
            {filteredAgents.map((agent, idx) => {
              const isCopied = copiedId === agent.agentId;
              const isExpanded = expanded[agent.agentId] ?? true;
              return (
                <motion.div
                  key={agent.agentId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`rounded-xl border p-4 transition-all ${
                    !agent.active
                      ? dc
                        ? "bg-gray-900/40 border-gray-700/50 opacity-60"
                        : "bg-gray-50 border-gray-200/50 opacity-60"
                      : dc
                      ? "bg-gray-800/60 border-gray-700 hover:border-blue-600/40"
                      : "bg-white border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          agent.active
                            ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white"
                            : dc
                            ? "bg-gray-600 text-gray-400"
                            : "bg-gray-300 text-gray-500"
                        }`}
                      >
                        {agent.agentName.charAt(0)}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${txt}`}>{agent.agentName}</p>
                        <p className={`text-xs ${sub}`}>
                          {agent.agentId} • {isUrdu ? (agent.active ? "فعال" : "غیر فعال") : agent.active ? "Active" : "Inactive"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpanded((prev) => ({ ...prev, [agent.agentId]: !isExpanded }))}
                      className={`p-1.5 rounded-lg transition-colors ${dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {/* Code digits */}
                        <div className="flex items-center gap-3 mt-4">
                          <div className="flex gap-1.5 flex-1" dir="ltr">
                            {agent.code.split("").map((digit, i) => (
                              <span
                                key={i}
                                className={`w-9 h-10 sm:w-10 sm:h-11 rounded-lg flex items-center justify-center text-lg font-bold ${
                                  !agent.active
                                    ? dc
                                      ? "bg-gray-800 text-gray-600"
                                      : "bg-gray-200 text-gray-400"
                                    : dc
                                    ? "bg-gray-800 text-blue-400 border border-blue-700/30"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {digit}
                              </span>
                            ))}
                          </div>

                          {/* Copy */}
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleCopy(agent.agentId, agent.code)}
                            disabled={!agent.active}
                            className={`p-2.5 rounded-lg transition-all ${
                              isCopied
                                ? "bg-green-500 text-white"
                                : dc
                                ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                          >
                            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </motion.button>

                          {/* WhatsApp share */}
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleShareWhatsApp(agent)}
                            disabled={!agent.active}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                          >
                            <MessageCircle className="w-4 h-4" />
                            {isUrdu ? "واٹس ایپ" : "WhatsApp"}
                          </motion.button>
                        </div>

                        {/* Footer info */}
                        <div className={`mt-3 flex items-center gap-2 text-xs ${sub}`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {isUrdu
                              ? `کوڈ کی میعاد ${formatTimeRemaining(timeLeft)} میں ختم ہوگی`
                              : `Code expires in ${formatTimeRemaining(timeLeft)}`}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {filteredAgents.length === 0 && !loading && (
              <div className="text-center py-16">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${dc ? "bg-blue-950/30" : "bg-blue-100"}`}>
                  <Shield className={`w-8 h-8 ${dc ? "text-blue-400" : "text-blue-600"}`} />
                </div>
                <p className={`text-sm ${sub}`}>
                  {searchTerm
                    ? isUrdu
                      ? "تلاش سے کوئی ایجنٹ نہیں ملا"
                      : "No agents match your search"
                    : isUrdu
                    ? "ابھی کوئی ایجنٹ رجسٹرڈ نہیں"
                    : "No agents registered yet."}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
