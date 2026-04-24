import { useState } from "react";
import {
  AlertTriangle, CheckCircle2, RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "../../../lib/toast";
import { type Case } from "../../../lib/mockData";
import { load, save } from "./operatorTypes";

export function AgentSupportSection({ u, dc, card, txt, sub, cases, agents }: any) {
  const [takenIds, setTakenIds] = useState<string[]>(() => load("emr-op-taken-tasks", []));
  const [viewMode, setViewMode] = useState<"tasks" | "agents">("agents");

  const missedTasks = cases
    .filter((c: Case) => c.isOverdue || c.status === "document_collection")
    .map((c: Case) => ({
      id: `task-${c.id}`, caseId: c.id, agentName: c.agentName, customerName: c.customerName,
      description: c.isOverdue ? u(`Overdue: ${c.status.replace(/_/g, " ")}`, `تاخیر: ${c.status.replace(/_/g, " ")}`)
        : u(`Missing documents for ${c.customerName}`, `${c.customerName} کے کاغزات نامکمل`),
    }));

  const agentWorkloads = agents.map((agent: any) => {
    const agentCases = cases.filter((c: Case) => c.agentName === agent.fullName);
    return {
      ...agent,
      totalCases: agentCases.length,
      overdue: agentCases.filter((c: Case) => c.isOverdue).length,
      pending: agentCases.filter((c: Case) => c.status !== "completed" && c.status !== "rejected").length,
      completed: agentCases.filter((c: Case) => c.status === "completed").length,
      cases: agentCases,
    };
  });

  const takeOver = (taskId: string) => {
    const updated = [...takenIds, taskId];
    setTakenIds(updated); save("emr-op-taken-tasks", updated);
    toast.success(u("Task taken over!", "کام آپ نے لے لیا!"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setViewMode("agents")}
          className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold min-h-[40px] ${viewMode === "agents" ? "bg-blue-600 text-white" : dc ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-white text-gray-500 border border-gray-200"}`}>
          👥 {u("Agent Workload", "ایجنٹ کا کام")}
        </button>
        <button onClick={() => setViewMode("tasks")}
          className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold min-h-[40px] ${viewMode === "tasks" ? "bg-blue-600 text-white" : dc ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-white text-gray-500 border border-gray-200"}`}>
          ⚠️ {u("Pending Tasks", "باقی کام")} ({missedTasks.length})
        </button>
      </div>

      {viewMode === "agents" ? (
        <div className="space-y-2">
          {agentWorkloads.length === 0 ? (
            <p className={`text-center py-8 ${sub}`}>{u("No agents found", "کوئی ایجنٹ نہیں ملا")}</p>
          ) : agentWorkloads.map((agent: any) => (
            <div key={agent.id} className={`rounded-xl border p-3 sm:p-4 ${card}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${dc ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
                  {agent.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${txt}`}>{agent.fullName}</p>
                  <p className={`text-xs ${sub}`}>{agent.meta?.title || u("Agent", "ایجنٹ")} — {agent.phone || ""}</p>
                </div>
                {agent.overdue > 0 && (
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"}`}>
                    ⚠️ {agent.overdue} {u("overdue", "تاخیر")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-lg p-2 text-center ${dc ? "bg-blue-900/20" : "bg-blue-50"}`}>
                  <p className={`text-lg font-bold ${dc ? "text-blue-400" : "text-blue-600"}`}>{agent.totalCases}</p>
                  <p className={`text-[10px] ${sub}`}>{u("Total", "کل")}</p>
                </div>
                <div className={`rounded-lg p-2 text-center ${dc ? "bg-amber-900/20" : "bg-amber-50"}`}>
                  <p className={`text-lg font-bold ${dc ? "text-amber-400" : "text-amber-600"}`}>{agent.pending}</p>
                  <p className={`text-[10px] ${sub}`}>{u("Active", "فعال")}</p>
                </div>
                <div className={`rounded-lg p-2 text-center ${dc ? "bg-emerald-900/20" : "bg-emerald-50"}`}>
                  <p className={`text-lg font-bold ${dc ? "text-emerald-400" : "text-emerald-600"}`}>{agent.completed}</p>
                  <p className={`text-[10px] ${sub}`}>{u("Done", "مکمل")}</p>
                </div>
              </div>
              {agent.cases.length > 0 && (
                <div className={`mt-2 pt-2 border-t ${dc ? "border-gray-700" : "border-gray-200"} space-y-1`}>
                  {agent.cases.slice(0, 3).map((c: Case) => (
                    <div key={c.id} className={`flex items-center gap-2 text-xs ${sub}`}>
                      <span className="font-mono">{c.id}</span>
                      <span className={txt}>{c.customerName}</span>
                      <span className={`ms-auto text-[10px] px-1.5 py-0.5 rounded ${
                        c.isOverdue ? (dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600")
                          : (dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500")
                      }`}>{c.status.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                  {agent.cases.length > 3 && (
                    <p className={`text-[10px] ${sub}`}>+{agent.cases.length - 3} {u("more", "اور")}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={`rounded-xl border p-3 ${dc ? "bg-amber-900/20 border-amber-700/30" : "bg-amber-50 border-amber-200"}`}>
            <p className={`text-sm font-medium ${dc ? "text-amber-400" : "text-amber-700"}`}>
              <AlertTriangle className="w-4 h-4 inline" /> {missedTasks.length} {u("pending agent tasks", "ایجنٹ کے باقی کام")}
            </p>
          </div>
          <div className="space-y-2">
            {missedTasks.length === 0 ? (
              <p className={`text-center py-8 ${sub}`}>{u("All agent tasks up to date!", "سب کام مکمل ہیں!")}</p>
            ) : missedTasks.map((task: any) => {
              const taken = takenIds.includes(task.id);
              return (
                <div key={task.id} className={`rounded-xl border p-3 sm:p-4 ${card} ${taken ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${dc ? "bg-red-900/30" : "bg-red-100"}`}>
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${dc ? "text-red-400" : "text-red-600"} font-medium`}>{u("Agent", "ایجنٹ")} {task.agentName} — {task.caseId}</p>
                      <p className={`text-sm font-semibold mt-0.5 ${txt}`}>{task.description}</p>
                    </div>
                    {taken ? (
                      <span className="text-xs text-emerald-500 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {u("Taken", "لے لیا")}</span>
                    ) : (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => takeOver(task.id)}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold min-h-[44px] whitespace-nowrap">
                        <RefreshCw className="w-4 h-4" /> {u("I'll Do This", "میں کرتا ہوں")}
                      </motion.button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}
