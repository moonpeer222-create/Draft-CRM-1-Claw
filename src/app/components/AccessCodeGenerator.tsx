import { useState, useEffect, useCallback } from "react";
import { Copy, RefreshCw, Check, Key, Users, User, ShieldCheck, ShieldOff, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../lib/toast";
import { useTheme } from "../lib/ThemeContext";
import { AccessCodeService } from "../lib/accessCode";
import { getAgentCodesFromSupabase, AgentCodeInfo } from "../lib/agentAuth";
import { copyToClipboard } from "../lib/clipboard";

export function AccessCodeGenerator() {
  const { darkMode, t, isUrdu } = useTheme();
  const dc = darkMode;

  const [agentCodes, setAgentCodes] = useState<AgentCodeInfo[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const loadCodes = useCallback(async () => {
    const codes = await getAgentCodesFromSupabase();
    setAgentCodes(codes);
  }, []);

  useEffect(() => {
    loadCodes();
    // Refresh every 30 seconds so codes update as the TOTP window rotates
    const iv = setInterval(() => loadCodes(), 30000);
    return () => clearInterval(iv);
  }, [loadCodes]);

  const handleGenerateForAgent = async (agentId: string) => {
    setGeneratingId(agentId);
    // TOTP codes are deterministic — "refresh" just re-fetches from Supabase
    setTimeout(async () => {
      await loadCodes();
      const agent = agentCodes.find(a => a.agentId === agentId);
      toast.success(`${t("auth.newCodeGenerated")} ${agent?.agentName || agentId}`);
      setGeneratingId(null);
    }, 400);
  };

  const handleGenerateAll = () => {
    setGeneratingAll(true);
    setTimeout(async () => {
      await loadCodes();
      toast.success(t("auth.allCodesGenerated"));
      setGeneratingAll(false);
    }, 600);
  };

  const handleCopyCode = async (agentId: string, code: string) => {
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
    toast.success(t("auth.codeCopied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleActive = (agentId: string) => {
    const updated = AccessCodeService.toggleAgentActive(agentId);
    if (updated) {
      setAgentCodes(AccessCodeService.getAllAgentCodes());
      toast.success(updated.active ? t("auth.agentActivated") : t("auth.agentDeactivated"));
    }
  };

  const getTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    if (mins < 1) return t("notif.justNow");
    if (mins < 60) return `${mins}m`;
    return `${hrs}h`;
  };

  const activeCount = agentCodes.filter((a) => a.active).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 ${
        dc ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      } shadow-lg`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Key className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-bold ${dc ? "text-white" : "text-gray-900"}`}>
              {t("auth.agentAccessCodes")}
            </h3>
            <p className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
              {activeCount} {t("auth.activeAgents")} &bull; {t("auth.perAgentCodes")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleGenerateAll}
            disabled={generatingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 shadow-md shadow-blue-500/20"
          >
            <motion.div animate={generatingAll ? { rotate: 360 } : {}} transition={{ duration: 0.5 }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </motion.div>
            {t("auth.refreshAll")}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setExpanded(!expanded)}
            className={`p-1.5 rounded-lg transition-all ${
              dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </motion.button>
        </div>
      </div>

      {/* Agent List */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {agentCodes.map((agent, idx) => {
                const isGenerating = generatingId === agent.agentId || generatingAll;
                const isCopied = copiedId === agent.agentId;

                return (
                  <motion.div
                    key={agent.agentId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`rounded-xl border p-3 transition-all ${
                      !agent.active
                        ? dc
                          ? "bg-gray-900/50 border-gray-700/50 opacity-60"
                          : "bg-gray-50 border-gray-200/50 opacity-60"
                        : dc
                        ? "bg-gray-700/50 border-gray-600/50 hover:border-blue-600/50"
                        : "bg-gray-50/80 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {/* Agent info row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
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
                          <p className={`text-sm font-semibold ${dc ? "text-white" : "text-gray-900"}`}>
                            {agent.agentName}
                          </p>
                          <p className={`text-[10px] ${dc ? "text-gray-500" : "text-gray-400"}`}>
                            {agent.agentId} &bull; {t("auth.generated")} {getTimeAgo(agent.generatedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Toggle active */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleToggleActive(agent.agentId)}
                        className={`p-1.5 rounded-lg transition-all ${
                          agent.active
                            ? dc
                              ? "text-green-400 hover:bg-green-900/30"
                              : "text-green-600 hover:bg-green-50"
                            : dc
                            ? "text-gray-500 hover:bg-gray-600"
                            : "text-gray-400 hover:bg-gray-200"
                        }`}
                        title={agent.active ? "Deactivate" : "Activate"}
                      >
                        {agent.active ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : (
                          <ShieldOff className="w-4 h-4" />
                        )}
                      </motion.button>
                    </div>

                    {/* Code display + actions */}
                    <div className="flex items-center gap-2">
                      {/* Code digits */}
                      <div className="flex gap-1 flex-1" dir="ltr">
                        {(agent.code || "------").split("").map((digit, i) => (
                          <motion.span
                            key={`${agent.agentId}-digit-${i}`}
                            initial={isGenerating ? { rotateX: 90, opacity: 0 } : false}
                            animate={{ rotateX: 0, opacity: 1 }}
                            transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 20 }}
                            className={`w-8 h-9 rounded-lg flex items-center justify-center text-lg font-bold ${
                              !agent.active
                                ? dc
                                  ? "bg-gray-800 text-gray-600"
                                  : "bg-gray-200 text-gray-400"
                                : dc
                                ? "bg-gray-800 text-blue-400 border border-blue-700/30"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {isGenerating ? (
                              <motion.span
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                              >
                                ?
                              </motion.span>
                            ) : (
                              digit
                            )}
                          </motion.span>
                        ))}
                      </div>

                      {/* Copy button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCopyCode(agent.agentId, agent.code)}
                        disabled={!agent.active}
                        className={`p-2 rounded-lg transition-all ${
                          isCopied
                            ? "bg-green-500 text-white"
                            : dc
                            ? "bg-gray-600 hover:bg-gray-500 text-gray-300"
                            : "bg-gray-200 hover:bg-gray-300 text-gray-600"
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </motion.button>

                      {/* Regenerate button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleGenerateForAgent(agent.agentId)}
                        disabled={isGenerating || !agent.active}
                        className={`p-2 rounded-lg transition-all bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm`}
                      >
                        <motion.div
                          animate={isGenerating ? { rotate: 360 } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </motion.div>
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}

              {agentCodes.length === 0 && (
                <div className={`text-center py-8 ${dc ? "text-gray-500" : "text-gray-400"}`}>
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("auth.noAgentsRegistered")}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}