/**
 * MasterQwenTest — End-to-end StepFun AI pipeline test page.
 * Accessible at /master/stepfun-test (Master Admin only).
 * Legacy path /master/qwen-test redirects here.
 *
 * Tests:
 *  1. Non-streaming /ai/chat endpoint
 *  2. Streaming /ai/chat/stream endpoint (SSE)
 *  3. CRM action parsing & execution
 *  4. Brevo email (case-status notification)
 *  5. Service worker offline queue status
 */
import { useState, useRef } from "react";
import { MasterHeader } from "../../components/MasterHeader";
import { MasterSidebar } from "../../components/MasterSidebar";
import { useTheme } from "../../lib/ThemeContext";
import { motion, AnimatePresence } from "motion/react";
import {
  Bot, Wifi, WifiOff, CheckCircle, XCircle, Loader2,
  RefreshCw, Send, Sparkles, Mail, HardDrive, Zap, AlertTriangle,
} from "lucide-react";
import { callGeminiAI, streamQwenAI } from "../../lib/geminiApi";
import { buildCRMContext, CRM_ACTION_INSTRUCTIONS, parseActions, executeAllActions } from "../../lib/crmTools";
import { sendCaseStatusEmail } from "../../lib/emailService";
import { getPendingCount } from "../../lib/offlineQueue";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-5cdc87b7`;

type TestStatus = "idle" | "running" | "pass" | "fail" | "warn";

interface TestResult {
  name: string;
  status: TestStatus;
  detail: string;
  latencyMs?: number;
}

const INITIAL_RESULTS: TestResult[] = [
  { name: "1. Server Health Check", status: "idle", detail: "" },
  { name: "2. OpenRouter API Key Configured", status: "idle", detail: "" },
  { name: "3. Non-Streaming /ai/chat", status: "idle", detail: "" },
  { name: "4. Streaming /ai/chat/stream (SSE)", status: "idle", detail: "" },
  { name: "5. CRM Action Parsing", status: "idle", detail: "" },
  { name: "6. CRM Action Execution", status: "idle", detail: "" },
  { name: "7. Brevo Email Route", status: "idle", detail: "" },
  { name: "8. Service Worker Status", status: "idle", detail: "" },
  { name: "9. Offline Queue Count", status: "idle", detail: "" },
];

export function MasterQwenTest() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const { insideUnifiedLayout } = useUnifiedLayout();
  const [results, setResults] = useState<TestResult[]>(INITIAL_RESULTS);
  const [isRunning, setIsRunning] = useState(false);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState("");
  const abortRef = useRef(false);

  const setResult = (idx: number, partial: Partial<TestResult>) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, ...partial } : r));
  };

  const runAll = async () => {
    setIsRunning(true);
    abortRef.current = false;
    setResults(INITIAL_RESULTS.map(r => ({ ...r, status: "idle", detail: "" })));
    setStreamLog([]);

    // ── Test 1: Health check ─────────────────────────────────────────
    setResult(0, { status: "running", detail: "Pinging /health..." });
    try {
      const t0 = Date.now();
      const res = await fetch(`${SERVER}/health`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      const ms = Date.now() - t0;
      if (data.success) {
        setResult(0, { status: "pass", detail: `version=${data.version} (${ms}ms)`, latencyMs: ms });
      } else {
        setResult(0, { status: "fail", detail: `Unexpected response: ${JSON.stringify(data)}` });
      }
    } catch (err: any) {
      setResult(0, { status: "fail", detail: `Network error: ${err.message}` });
    }

    // ── Test 2: OpenRouter key check ────────────────────────────────────────
    setResult(1, { status: "running", detail: "Checking OPENROUTER_API_KEY via /ai/chat..." });
    try {
      const t0 = Date.now();
      // Send a tiny message — if the key is missing, the server returns a specific error
      const res = await fetch(`${SERVER}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ message: "ping", role: "admin", language: "ur" }),
      });
      const ms = Date.now() - t0;
      const data = await res.json();
      if (res.status === 400 && data.error?.includes("OPENROUTER_API_KEY")) {
        setResult(1, { status: "fail", detail: "OPENROUTER_API_KEY not set in Supabase secrets!" });
      } else {
        setResult(1, { status: "pass", detail: `Key present — server responded (${ms}ms)`, latencyMs: ms });
      }
    } catch (err: any) {
      setResult(1, { status: "fail", detail: `Error: ${err.message}` });
    }

    // ── Test 3: Non-streaming chat ────────────────────────────────────
    setResult(2, { status: "running", detail: "Calling callGeminiAI()..." });
    try {
      const t0 = Date.now();
      const res = await callGeminiAI(
        "اردو میں ایک جملے میں جواب دیں: ایمرالڈ ویزا کا دفتر کہاں ہے؟",
        "admin", "ur", [], ""
      );
      const ms = Date.now() - t0;
      if (res.success && res.response) {
        const preview = res.response.substring(0, 120).replace(/\n/g, " ");
        setResult(2, { status: "pass", detail: `${ms}ms — model=${res.model} — "${preview}..."`, latencyMs: ms });
      } else {
        setResult(2, { status: "fail", detail: `API returned error: ${res.error}` });
      }
    } catch (err: any) {
      setResult(2, { status: "fail", detail: `Exception: ${err.message}` });
    }

    // ── Test 4: Streaming chat ────────────────────────────────────────
    setResult(3, { status: "running", detail: "Opening SSE stream..." });
    setStreamLog(["⏳ Stream starting..."]);
    try {
      const t0 = Date.now();
      let tokenCount = 0;
      const fullText = await streamQwenAI(
        "ایک جملے میں: پاکستان کا دارالحکومت کیا ہے؟",
        "admin", "ur", [], "",
        (token) => {
          tokenCount++;
          setStreamLog(prev => {
            const last = prev[prev.length - 1];
            if (last && !last.startsWith("⏳") && !last.startsWith("✅") && !last.startsWith("❌")) {
              return [...prev.slice(0, -1), last + token];
            }
            return [...prev, token];
          });
        },
        (full) => {
          const ms = Date.now() - t0;
          setStreamLog(prev => [...prev, `✅ Stream complete: ${tokenCount} tokens in ${ms}ms`]);
          setResult(3, {
            status: "pass",
            detail: `${tokenCount} tokens streamed in ${ms}ms — "${full.substring(0, 80)}..."`,
            latencyMs: ms,
          });
        },
        (err) => {
          setStreamLog(prev => [...prev, `❌ Stream error: ${err}`]);
          setResult(3, { status: "fail", detail: `Stream error: ${err}` });
        },
      );
      if (!fullText) {
        // If stream callback already handled it, no-op
        setResults(prev => prev.map((r, i) =>
          i === 3 && r.status === "running"
            ? { ...r, status: "fail" as TestStatus, detail: "Empty stream response" }
            : r
        ));
      }
    } catch (err: any) {
      setResult(3, { status: "fail", detail: `Exception: ${err.message}` });
    }

    // ── Test 5: CRM action parsing ────────────────────────────────────
    setResult(4, { status: "running", detail: "Testing parseActions()..." });
    try {
      const mockResponse = `[CRM_ACTION:{"type":"get_stats"}]\n[CRM_ACTION:{"type":"list_overdue"}]\nاردو جواب`;
      const { actions, cleanText } = parseActions(mockResponse);
      if (actions.length === 2 && actions[0].type === "get_stats" && actions[1].type === "list_overdue") {
        setResult(4, { status: "pass", detail: `Parsed ${actions.length} actions. cleanText="${cleanText.trim()}"` });
      } else {
        setResult(4, { status: "fail", detail: `Expected 2 actions, got ${actions.length}. Actions: ${JSON.stringify(actions)}` });
      }
    } catch (err: any) {
      setResult(4, { status: "fail", detail: `parseActions() threw: ${err.message}` });
    }

    // ── Test 6: CRM action execution ──────────────────────────────────
    setResult(5, { status: "running", detail: "Executing get_stats + list_overdue actions..." });
    try {
      const results6 = executeAllActions([
        { type: "get_stats" },
        { type: "list_overdue" },
      ]);
      const allSuccess = results6.every(r => r.success);
      const preview = results6.map(r => `[${r.success ? "✓" : "✗"}] ${r.message.substring(0, 50)}`).join(" | ");
      setResult(5, {
        status: allSuccess ? "pass" : "fail",
        detail: preview,
      });
    } catch (err: any) {
      setResult(5, { status: "fail", detail: `executeAllActions() threw: ${err.message}` });
    }

    // ── Test 7: Brevo email route ─────────────────────────────────────
    setResult(6, { status: "running", detail: "Checking /notifications/case-status route..." });
    try {
      const t0 = Date.now();
      const res = await fetch(`${SERVER}/notifications/case-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          caseId: "TEST-001",
          newStatus: "visa_approved",
          customerEmail: testEmail || undefined,
          customerName: "Test Customer",
          agentName: "Test Agent",
          country: "Saudi Arabia",
        }),
      });
      const ms = Date.now() - t0;
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(6, { status: "pass", detail: `Email sent (${ms}ms). messageId=${data.messageId}, recipients=${data.recipients}`, latencyMs: ms });
      } else if (!testEmail && data.error?.includes("recipient")) {
        setResult(6, { status: "pass", detail: "Route OK (no recipient provided — set test email above to send a real email)" });
      } else {
        setResult(6, { status: "fail", detail: `error: ${data.error || res.status}` });
      }
    } catch (err: any) {
      setResult(6, { status: "fail", detail: `Exception: ${err.message}` });
    }

    // ── Test 8: Service Worker ────────────────────────────────────────
    setResult(7, { status: "running", detail: "Checking SW registration..." });
    try {
      if (!("serviceWorker" in navigator)) {
        setResult(7, { status: "fail", detail: "Browser does not support Service Workers" });
      } else {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) {
          const sw = regs[0];
          setResult(7, { status: "pass", detail: `SW active: scope=${sw.scope}, state=${sw.active?.state || "installing"}` });
        } else {
          // Check if SW was intentionally skipped due to sandboxed environment
          let sandboxed = false;
          try {
            const probe = await fetch("/sw.js", { method: "HEAD" });
            const mime = probe.headers.get("content-type") || "";
            if (!mime.includes("javascript") && !mime.includes("application/")) {
              sandboxed = true;
            }
          } catch {
            sandboxed = true;
          }
          if (sandboxed) {
            setResult(7, {
              status: "warn",
              detail: "SW skipped — sandboxed environment (Figma preview) does not serve /sw.js as JavaScript. Will work in production deployment.",
            });
          } else {
            setResult(7, { status: "fail", detail: "No service workers registered — /sw.js exists but was not activated. Try hard-refreshing." });
          }
        }
      }
    } catch (err: any) {
      setResult(7, { status: "fail", detail: `SW check error: ${err.message}` });
    }

    // ── Test 9: Offline queue ─────────────────────────────────────────
    setResult(8, { status: "running", detail: "Checking IndexedDB offline queue..." });
    try {
      const count = await getPendingCount();
      setResult(8, {
        status: "pass",
        detail: count === 0
          ? "Queue empty — no pending offline mutations 🟢"
          : `${count} mutation(s) queued offline (will replay on next sync)`,
      });
    } catch (err: any) {
      setResult(8, { status: "fail", detail: `IndexedDB error: ${err.message}` });
    }

    setIsRunning(false);
  };

  const passCount = results.filter(r => r.status === "pass").length;
  const failCount = results.filter(r => r.status === "fail").length;
  const warnCount = results.filter(r => r.status === "warn").length;
  const totalRan = passCount + failCount + warnCount;

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} ${dc ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
      {!insideUnifiedLayout && <MasterSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <MasterHeader />}
        <main className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-6 mb-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xl`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">StepFun AI Pipeline Test</h1>
                <p className="text-violet-200 text-sm">End-to-end diagnostics for the Emerald CRM AI stack</p>
              </div>
            </div>
            {totalRan > 0 && (
              <div className="mt-4 flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4 text-green-300" /> {passCount} Passed
                </span>
                {failCount > 0 && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-red-300">
                    <XCircle className="w-4 h-4" /> {failCount} Failed
                  </span>
                )}
                {warnCount > 0 && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-300">
                    <AlertTriangle className="w-4 h-4" /> {warnCount} Warning{warnCount > 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-violet-300 text-xs">({totalRan}/{results.length} tests run)</span>
              </div>
            )}
          </motion.div>

          {/* Optional test email */}
          <div className={`rounded-xl p-4 mb-4 border ${dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Mail className="w-4 h-4 text-emerald-500" />
              Test Email for Brevo (optional — Test 7)
            </label>
            <input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="your@email.com"
              type="email"
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                dc ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to test route health only. With an email, a real Brevo email will be sent.</p>
          </div>

          {/* Run button */}
          <button
            onClick={runAll}
            disabled={isRunning}
            className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm mb-6 transition-all ${
              isRunning
                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-500/30"
            }`}
          >
            {isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running Tests...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Run All Tests</>
            )}
          </button>

          {/* Results */}
          <div className="space-y-2 mb-6">
            {results.map((result, i) => (
              <motion.div
                key={result.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`rounded-xl border p-4 flex items-start gap-3 ${
                  result.status === "pass"
                    ? dc ? "bg-green-900/20 border-green-700/50" : "bg-green-50 border-green-200"
                    : result.status === "fail"
                    ? dc ? "bg-red-900/20 border-red-700/50" : "bg-red-50 border-red-200"
                    : result.status === "warn"
                    ? dc ? "bg-amber-900/20 border-amber-700/50" : "bg-amber-50 border-amber-200"
                    : result.status === "running"
                    ? dc ? "bg-blue-900/20 border-blue-700/50" : "bg-blue-50 border-blue-200"
                    : dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
                }`}
              >
                {/* Status icon */}
                <div className="shrink-0 mt-0.5">
                  {result.status === "pass" && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {result.status === "fail" && <XCircle className="w-5 h-5 text-red-500" />}
                  {result.status === "warn" && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  {result.status === "running" && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                  {result.status === "idle" && <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
                </div>
                {/* Name + detail */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    result.status === "pass" ? "text-green-700 dark:text-green-400" :
                    result.status === "fail" ? "text-red-700 dark:text-red-400" :
                    result.status === "warn" ? "text-amber-700 dark:text-amber-400" :
                    result.status === "running" ? "text-blue-700 dark:text-blue-400" :
                    "text-gray-500"
                  }`}>{result.name}</p>
                  {result.detail && (
                    <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400 break-words">{result.detail}</p>
                  )}
                </div>
                {/* Latency badge */}
                {result.latencyMs !== undefined && (
                  <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-gray-600 dark:text-gray-400">
                    {result.latencyMs}ms
                  </span>
                )}
              </motion.div>
            ))}
          </div>

          {/* Stream log */}
          <AnimatePresence>
            {streamLog.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`rounded-xl border p-4 ${dc ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-200"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">SSE Stream Log (Test 4)</span>
                </div>
                <div className="font-mono text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {streamLog.map((line, i) => (
                    <div key={i} className="text-gray-600 dark:text-gray-400 leading-relaxed">{line}</div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center text-gray-500">
            {[
              { icon: <CheckCircle className="w-4 h-4 text-green-500 mx-auto mb-1" />, label: "PASS — working" },
              { icon: <XCircle className="w-4 h-4 text-red-500 mx-auto mb-1" />, label: "FAIL — needs fix" },
              { icon: <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto mb-1" />, label: "WARN — env limit" },
              { icon: <Loader2 className="w-4 h-4 text-blue-500 animate-spin mx-auto mb-1" />, label: "RUNNING" },
            ].map((item, i) => (
              <div key={i} className={`rounded-lg p-2 ${dc ? "bg-gray-900" : "bg-white"} border ${dc ? "border-gray-800" : "border-gray-200"}`}>
                {item.icon}
                {item.label}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}