/**
 * CRM Tools — gives the AI chatbot real access to CRM operations.
 * The AI outputs [CRM_ACTION:{...}] blocks in its response;
 * the client parses and executes them against CRMDataStore.
 */
import {
  type Case,
  WORKFLOW_STAGES,
  getStageLabel,
  getOverdueInfo,
} from "./mockData";
import { sendCaseStatusEmail, extractEmailsFromCase } from "./emailService";
import { supabase } from "./supabase";
import { mapSupabaseCaseToLocal } from "./caseMappers";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
export type CRMActionType =
  | "search_cases"
  | "get_case"
  | "update_status"
  | "add_note"
  | "add_payment"
  | "get_stats"
  | "list_overdue"
  | "list_by_agent"
  | "list_by_status"
  | "list_by_country"
  | "create_case"
  | "flag_case"
  | "analyze_performance"
  | "predict_delay";

export interface CRMAction {
  type: CRMActionType;
  // search_cases
  query?: string;
  // get_case / update_status / add_note / add_payment / flag_case
  caseId?: string;
  // update_status
  newStatus?: Case["status"];
  // add_note
  noteText?: string;
  noteAuthor?: string;
  noteImportant?: boolean;
  // add_payment
  paymentAmount?: number;
  paymentMethod?: "cash" | "bank" | "easypaisa" | "jazzcash" | "card";
  paymentDescription?: string;
  paymentCollectedBy?: string;
  // list_by_agent / analyze_performance
  agentName?: string;
  // list_by_status
  status?: Case["status"];
  // list_by_country
  country?: string;
  // create_case
  customerName?: string;
  fatherName?: string;
  phone?: string;
  cnic?: string;
  passport?: string;
  jobType?: string;
  countryDest?: string;
  agentAssign?: string;
  // flag_case
  flagReason?: string;
}

export interface CRMActionResult {
  success: boolean;
  message: string;       // Urdu response to show user
  data?: any;
}

async function fetchCases(): Promise<Case[]> {
  const { data, error } = await supabase.from("cases").select("*");
  if (error || !data) {
    return [];
  }
  return data.map((c: any) => mapSupabaseCaseToLocal(c, null));
}

// ──────────────────────────────────────────────
// Build CRM context snapshot for AI prompt
// ──────────────────────────────────────────────
/**
 * Smart CRM context builder — keeps prompt lean to maximize AI quality.
 * If userMessage is provided, only includes cases relevant to the query.
 * Otherwise includes: stats + overdue + most recent 15 active cases.
 */
export async function buildCRMContext(userMessage?: string): Promise<string> {
  const cases = await fetchCases();
  const totalCases = cases.length;
  const activeCases = cases.filter(c => !["completed", "rejected"].includes(c.status));
  const completedCases = cases.filter(c => c.status === "completed");
  const overdueCases = cases.filter(c => {
    const info = getOverdueInfo(c);
    return info.isOverdue;
  });

  const totalRevenue = cases.reduce((s, c) => s + c.paidAmount, 0);
  const totalPending = cases.reduce((s, c) => s + (c.totalFee - c.paidAmount), 0);

  // Agent breakdown (compact)
  const agentMap: Record<string, number> = {};
  activeCases.forEach(c => { agentMap[c.agentName] = (agentMap[c.agentName] || 0) + 1; });
  const agentSummary = Object.entries(agentMap).map(([n, c]) => `${n}:${c}`).join(", ");

  // Smart case selection — if user mentions a case ID or name, include only those
  let selectedCases: typeof cases = [];
  if (userMessage) {
    const msg = userMessage.toLowerCase();
    // Check for case ID mention (EMR-XXXX)
    const idMatch = msg.match(/emr[-\s]?\d{4}[-\s]?\d{0,4}/gi);
    if (idMatch) {
      const ids = idMatch.map(id => id.replace(/\s/g, "").toUpperCase());
      selectedCases = cases.filter(c => ids.some(id => c.id.includes(id)));
    }
    // Check for customer name mention
    if (selectedCases.length === 0) {
      selectedCases = cases.filter(c =>
        msg.includes(c.customerName.toLowerCase()) ||
        c.customerName.toLowerCase().split(" ").some(part => part.length > 2 && msg.includes(part))
      );
    }
    // Check for agent name mention
    if (selectedCases.length === 0) {
      selectedCases = cases.filter(c =>
        msg.includes(c.agentName.toLowerCase())
      );
    }
  }

  // If no specific match, include overdue + most recent active (capped at 15 total)
  if (selectedCases.length === 0) {
    const overdueSet = new Set(overdueCases.map(c => c.id));
    const recentActive = activeCases
      .filter(c => !overdueSet.has(c.id))
      .sort((a, b) => (b.updatedDate || b.createdDate || "").localeCompare(a.updatedDate || a.createdDate || ""))
      .slice(0, 15 - overdueCases.length);
    selectedCases = [...overdueCases, ...recentActive];
  }

  // Compact case format (saves ~40% tokens vs old format)
  const casesList = selectedCases.map(c => {
    const bal = c.totalFee - c.paidAmount;
    const od = getOverdueInfo(c);
    return `${c.id}|${c.customerName}|${c.country}|${getStageLabel(c.status)}|${c.agentName}|${c.totalFee}/${c.paidAmount}${bal > 0 ? "/bal:" + bal : ""}${od.isOverdue ? "|⚠OVERDUE" : ""}`;
  }).join("\n");

  // Compact valid statuses
  const validStatuses = WORKFLOW_STAGES
    .filter(s => !s.label.includes("Deprecated"))
    .map(s => `"${s.key}"`)
    .join(", ");

  return `=== CRM DATA ===
Stats: ${totalCases} total, ${activeCases.length} active, ${completedCases.length} done, ${overdueCases.length} overdue
Revenue: PKR ${totalRevenue.toLocaleString()} received, PKR ${totalPending.toLocaleString()} pending
Agents(active cases): ${agentSummary}
Cases(${selectedCases.length}/${totalCases}):
${casesList}
Statuses: ${validStatuses}
===`;
}

// ──────────────────────────────────────────────
// CRM Action Instructions for AI system prompt
// ──────────────────────────────────────────────
export const CRM_ACTION_INSTRUCTIONS = `
=== CRM OPERATIONS (VERY IMPORTANT) ===
You have DIRECT access to operate the CRM system. When the user asks you to perform a CRM action, you MUST include a [CRM_ACTION:{...}] block in your response.

Available actions and their JSON format:

1. SEARCH cases by name/phone/passport/ID:
   [CRM_ACTION:{"type":"search_cases","query":"Ahmed Khan"}]

2. GET specific case details:
   [CRM_ACTION:{"type":"get_case","caseId":"EMR-2026-0001"}]

3. UPDATE case status (advance to next stage):
   [CRM_ACTION:{"type":"update_status","caseId":"EMR-2026-0001","newStatus":"original_documents"}]

4. ADD a note to a case:
   [CRM_ACTION:{"type":"add_note","caseId":"EMR-2026-0001","noteText":"Follow up done via WhatsApp","noteAuthor":"AI Assistant","noteImportant":false}]

5. ADD payment record:
   [CRM_ACTION:{"type":"add_payment","caseId":"EMR-2026-0001","paymentAmount":15000,"paymentMethod":"cash","paymentDescription":"Third installment","paymentCollectedBy":"Faizan"}]

6. GET CRM statistics:
   [CRM_ACTION:{"type":"get_stats"}]

7. LIST overdue cases:
   [CRM_ACTION:{"type":"list_overdue"}]

8. LIST cases by agent:
   [CRM_ACTION:{"type":"list_by_agent","agentName":"Faizan"}]

9. LIST cases by status:
   [CRM_ACTION:{"type":"list_by_status","status":"payment_confirmation"}]

10. LIST cases by country:
    [CRM_ACTION:{"type":"list_by_country","country":"Saudi Arabia"}]

11. CREATE new case:
    [CRM_ACTION:{"type":"create_case","customerName":"New Client","fatherName":"Father Name","phone":"+92 300 1234567","cnic":"35201-1234567-1","passport":"AB1234567","jobType":"Driver","countryDest":"Saudi Arabia","agentAssign":"Faizan"}]

12. FLAG case for Admin review:
     [CRM_ACTION:{"type":"flag_case","caseId":"EMR-2026-0001","flagReason":"Document rejected twice"}]

13. ANALYZE agent performance:
     [CRM_ACTION:{"type":"analyze_performance","agentName":"Faizan"}]

14. PREDICT delay risk for a case:
     [CRM_ACTION:{"type":"predict_delay","caseId":"EMR-2026-0001"}]

RULES:
- Always include the [CRM_ACTION:...] block BEFORE your conversational Urdu response.
- You can include MULTIPLE actions in one response.
- When the user asks to SEE data, use search/get/list actions AND also describe the results in Urdu.
- When the user asks to CHANGE data, use update/add/create actions AND confirm the action in Urdu.
- Use real case IDs from the CRM data provided above.
- For status updates, ONLY use valid status values from the list above.
- ALWAYS respond in Urdu script after the action block.
- When flagging cases, always include a clear reason.
- For performance analysis, provide insights with recommendations.
=== END CRM OPERATIONS ===`;

// ──────────────────────────────────────────────
// Parse [CRM_ACTION:{...}] blocks from AI text
// ──────────────────────────────────────────────
// Note: regex must be created fresh each call to avoid stale lastIndex
export function parseActions(text: string): { actions: CRMAction[]; cleanText: string } {
  const ACTION_REGEX = /\[CRM_ACTION:([\s\S]*?)\]/g;
  const actions: CRMAction[] = [];
  let cleanText = text;

  let match;
  while ((match = ACTION_REGEX.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed.type) {
        actions.push(parsed as CRMAction);
      }
    } catch (e) {
    }
    cleanText = cleanText.replace(match[0], "");
  }

  // Clean up extra whitespace
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  return { actions, cleanText };
}

// ──────────────────────────────────────────────
// Execute a single CRM action
// ──────────────────────────────────────────────
export async function executeAction(action: CRMAction): Promise<CRMActionResult> {
  try {
    switch (action.type) {

      case "search_cases": {
        const q = (action.query || "").toLowerCase();
        if (!q) return { success: false, message: "تلاش کے لیے نام یا ID درج کریں" };
        const cases = await fetchCases();
        const results = cases.filter(c =>
          c.customerName.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.passport.toLowerCase().includes(q) ||
          c.cnic.includes(q)
        );
        if (results.length === 0) {
          return { success: true, message: `"${action.query}" سے متعلق کوئی کیس نہیں ملا`, data: [] };
        }
        const summary = results.map(c =>
          `${c.id} — ${c.customerName} — ${c.country} ${c.jobType} — مرحلہ ${c.currentStage}: ${getStageLabel(c.status, true)} — ایجنٹ: ${c.agentName}`
        ).join("\n");
        return {
          success: true,
          message: `${results.length} کیس ملے:\n${summary}`,
          data: results.map(c => ({ id: c.id, name: c.customerName, status: c.status, stage: c.currentStage, agent: c.agentName })),
        };
      }

      case "get_case": {
        if (!action.caseId) return { success: false, message: "کیس ID درج کریں" };
        const cases = await fetchCases();
        const c = cases.find(cs => cs.id === action.caseId);
        if (!c) return { success: false, message: `کیس ${action.caseId} نہیں ملا` };
        const overdueInfo = getOverdueInfo(c);
        const docs = c.documents.map(d => `${d.name} (${d.status === "verified" ? "تصدیق شدہ" : d.status === "rejected" ? "مسترد" : "زیرِ التوا"})`).join("، ");
        const pays = c.payments.map(p => `PKR ${p.amount.toLocaleString()} (${p.method}) — ${p.description}`).join("\n  ");
        const detail = [
          `کیس: ${c.id}`,
          `کسٹمر: ${c.customerName} ولد ${c.fatherName}`,
          `فون: ${c.phone} | CNIC: ${c.cnic} | پاسپورٹ: ${c.passport}`,
          `ملک: ${c.country} | جاب: ${c.jobType}`,
          `مرحلہ: ${c.currentStage}/12 — ${getStageLabel(c.status, true)}`,
          overdueInfo.isOverdue ? `تاخیر: ${overdueInfo.timeLabel}` : `ڈیڈلائن: ${overdueInfo.timeLabel}`,
          `ایجنٹ: ${c.agentName} | ترجیح: ${c.priority}`,
          `فیس: PKR ${c.totalFee.toLocaleString()} | ادا شدہ: PKR ${c.paidAmount.toLocaleString()} | باقی: PKR ${(c.totalFee - c.paidAmount).toLocaleString()}`,
          `دستاویزات: ${docs || "کوئی نہیں"}`,
          `ادائیگیاں:\n  ${pays || "کوئی نہیں"}`,
          `نوٹس: ${c.notes.length} | ٹائم لائن: ${c.timeline.length} ایونٹس`,
        ].join("\n");
        return { success: true, message: detail, data: c };
      }

      case "update_status":
        return { success: false, message: "AI case actions are temporarily disabled while we migrate to the cloud database. Please use the dashboard to make changes." };

      case "add_note":
        return { success: false, message: "AI case actions are temporarily disabled while we migrate to the cloud database. Please use the dashboard to make changes." };

      case "add_payment":
        return { success: false, message: "AI case actions are temporarily disabled while we migrate to the cloud database. Please use the dashboard to make changes." };

      case "get_stats": {
        const cases = await fetchCases();
        const active = cases.filter(c => !["completed", "rejected"].includes(c.status));
        const completed = cases.filter(c => c.status === "completed");
        const overdue = cases.filter(c => getOverdueInfo(c).isOverdue);
        const revenue = cases.reduce((s, c) => s + c.paidAmount, 0);
        const pending = cases.reduce((s, c) => s + (c.totalFee - c.paidAmount), 0);
        // Cases per agent
        const agentMap: Record<string, number> = {};
        cases.forEach(c => { agentMap[c.agentName] = (agentMap[c.agentName] || 0) + 1; });
        const agentStats = Object.entries(agentMap).map(([name, count]) => `${name}: ${count}`).join("، ");
        // Cases per country
        const countryMap: Record<string, number> = {};
        cases.forEach(c => { countryMap[c.country] = (countryMap[c.country] || 0) + 1; });
        const countryStats = Object.entries(countryMap).map(([name, count]) => `${name}: ${count}`).join("، ");

        const statsText = [
          `کل کیسز: ${cases.length}`,
          `فعال: ${active.length} | مکمل: ${completed.length} | تاخیر: ${overdue.length}`,
          `آمدنی: PKR ${revenue.toLocaleString()} | باقی ادائیگیاں: PKR ${pending.toLocaleString()}`,
          `ایجنٹ وائز: ${agentStats}`,
          `ملک وائز: ${countryStats}`,
        ].join("\n");
        return { success: true, message: statsText, data: { total: cases.length, active: active.length, completed: completed.length, overdue: overdue.length, revenue, pending } };
      }

      case "list_overdue": {
        const cases = await fetchCases();
        const overdue = cases.filter(c => getOverdueInfo(c).isOverdue);
        if (overdue.length === 0) return { success: true, message: "کوئی تاخیر والا کیس نہیں ہے۔ الحمدللہ!", data: [] };
        const list = overdue.map(c => {
          const info = getOverdueInfo(c);
          return `${c.id} — ${c.customerName} — ${getStageLabel(c.status, true)} — ${info.timeLabel} — ایجنٹ: ${c.agentName}`;
        }).join("\n");
        return { success: true, message: `${overdue.length} تاخیر والے کیسز:\n${list}`, data: overdue.map(c => ({ id: c.id, name: c.customerName })) };
      }

      case "list_by_agent": {
        if (!action.agentName) return { success: false, message: "ایجنٹ کا نام درج کریں" };
        const cases = await fetchCases();
        const filtered = cases.filter(c => c.agentName.toLowerCase() === action.agentName!.toLowerCase());
        if (filtered.length === 0) return { success: true, message: `${action.agentName} کا کوئی کیس نہیں ملا`, data: [] };
        const list = filtered.map(c => `${c.id} — ${c.customerName} — ${getStageLabel(c.status, true)}`).join("\n");
        return { success: true, message: `${action.agentName} کے ${filtered.length} کیسز:\n${list}`, data: filtered.map(c => ({ id: c.id, name: c.customerName })) };
      }

      case "list_by_status": {
        if (!action.status) return { success: false, message: "حیثیت درج کریں" };
        const cases = await fetchCases();
        const filtered = cases.filter(c => c.status === action.status);
        if (filtered.length === 0) return { success: true, message: `"${getStageLabel(action.status, true)}" حیثیت کا کوئی کیس نہیں`, data: [] };
        const list = filtered.map(c => `${c.id} — ${c.customerName} — ایجنٹ: ${c.agentName}`).join("\n");
        return { success: true, message: `${getStageLabel(action.status, true)} — ${filtered.length} کیسز:\n${list}`, data: filtered.map(c => ({ id: c.id, name: c.customerName })) };
      }

      case "list_by_country": {
        if (!action.country) return { success: false, message: "ملک کا نام درج کریں" };
        const cases = await fetchCases();
        const filtered = cases.filter(c => c.country.toLowerCase().includes(action.country!.toLowerCase()));
        if (filtered.length === 0) return { success: true, message: `${action.country} کا کوئی کیس نہیں ملا`, data: [] };
        const list = filtered.map(c => `${c.id} — ${c.customerName} — ${getStageLabel(c.status, true)} — ایجنٹ: ${c.agentName}`).join("\n");
        return { success: true, message: `${action.country} — ${filtered.length} کیسز:\n${list}`, data: filtered.map(c => ({ id: c.id, name: c.customerName })) };
      }

      case "create_case":
        return { success: false, message: "AI case actions are temporarily disabled while we migrate to the cloud database. Please use the dashboard to make changes." };

      case "flag_case":
        return { success: false, message: "AI case actions are temporarily disabled while we migrate to the cloud database. Please use the dashboard to make changes." };

      case "analyze_performance": {
        if (!action.agentName) return { success: false, message: "ایجنٹ کا نام درج کریں" };
        const cases = await fetchCases();
        const filtered = cases.filter(c => c.agentName.toLowerCase() === action.agentName!.toLowerCase());
        if (filtered.length === 0) return { success: true, message: `${action.agentName} کا کوئی کیس نہیں ملا`, data: [] };
        const completed = filtered.filter(c => c.status === "completed").length;
        const overdue = filtered.filter(c => getOverdueInfo(c).isOverdue).length;
        const performanceText = [
          `${action.agentName} کے کل کیسز: ${filtered.length}`,
          `مکمل: ${completed} | تاخیر: ${overdue}`,
          `مکملیت درصد: ${filtered.length > 0 ? ((completed / filtered.length) * 100).toFixed(2) : 0}%`,
          `تاخیر درصد: ${filtered.length > 0 ? ((overdue / filtered.length) * 100).toFixed(2) : 0}%`,
          `پیشنهادات:`,
          `  - تاخیر والے کیسز کو تیم میں مراجعت کریں۔`,
          `  - مکملیت کے لیے ایجنٹ کو تربیتی کاروائی کیا جائے۔`,
        ].join("\n");
        return { success: true, message: performanceText, data: { total: filtered.length, completed, overdue } };
      }

      case "predict_delay": {
        // Improvement #15: Enhanced multi-factor delay prediction
        if (!action.caseId) return { success: false, message: "کیس ID درج کریں" };
        const cases = await fetchCases();
        const c = cases.find(cs => cs.id === action.caseId);
        if (!c) return { success: false, message: `کیس ${action.caseId} نہیں ملا` };
        const overdueInfo = getOverdueInfo(c);

        // Multi-factor risk scoring
        let riskScore = 0;
        const riskFactors: string[] = [];

        // Factor 1: Current overdue status
        if (overdueInfo.isOverdue) { riskScore += 30; riskFactors.push("مرحلے کی ڈیڈلائن گزر چکی ہے"); }

        // Factor 2: Payment ratio
        const payRatio = c.totalFee > 0 ? c.paidAmount / c.totalFee : 0;
        if (payRatio < 0.3 && c.currentStage > 3) { riskScore += 20; riskFactors.push("ادائیگی 30% سے کم ہے — ادائیگی کی تاخیر"); }
        else if (payRatio < 0.5 && c.currentStage > 5) { riskScore += 15; riskFactors.push("ادائیگی 50% سے کم ہے"); }

        // Factor 3: Document completion
        const totalDocs = c.documents.length;
        const verifiedDocs = c.documents.filter(d => d.status === "verified").length;
        const rejectedDocs = c.documents.filter(d => d.status === "rejected").length;
        if (rejectedDocs > 0) { riskScore += 15; riskFactors.push(`${rejectedDocs} دستاویز مسترد ہوئے — دوبارہ جمع کروائیں`); }
        if (totalDocs > 0 && verifiedDocs / totalDocs < 0.5 && c.currentStage > 3) { riskScore += 10; riskFactors.push("50% سے کم دستاویزات تصدیق شدہ ہیں"); }

        // Factor 4: Stage velocity — time spent on current stage
        const stageStartMs = c.stageStartedAt ? new Date(c.stageStartedAt).getTime() : 0;
        const daysOnStage = stageStartMs > 0 ? (Date.now() - stageStartMs) / (1000 * 60 * 60 * 24) : 0;
        if (daysOnStage > 7) { riskScore += 15; riskFactors.push(`موجودہ مرحلے پر ${Math.floor(daysOnStage)} دن — سست رفتار`); }
        else if (daysOnStage > 3) { riskScore += 5; riskFactors.push(`${Math.floor(daysOnStage)} دن — توجہ درکار`); }

        // Factor 5: Priority
        if (c.priority === "urgent") { riskScore += 10; riskFactors.push("فوری ترجیح — تاخیر زیادہ نقصاندہ"); }
        else if (c.priority === "high") { riskScore += 5; }

        // Factor 6: Agent historical performance (compare to avg)
        const agentCases = cases.filter(cs => cs.agentName === c.agentName);
        const agentOverdue = agentCases.filter(cs => getOverdueInfo(cs).isOverdue).length;
        const agentOverdueRate = agentCases.length > 0 ? agentOverdue / agentCases.length : 0;
        if (agentOverdueRate > 0.3) { riskScore += 10; riskFactors.push(`ایجنٹ ${c.agentName} کی تاخیر شرح ${(agentOverdueRate * 100).toFixed(0)}% — اوپر اوسط`); }

        // Risk classification
        const riskLevel = riskScore >= 50 ? "ہائی (خطرناک)" : riskScore >= 25 ? "میڈیم (توجہ)" : "لو (محفوظ)";
        const riskEmoji = riskScore >= 50 ? "🔴" : riskScore >= 25 ? "🟡" : "🟢";

        // Recommendations based on risk factors
        const recommendations: string[] = [];
        if (overdueInfo.isOverdue) recommendations.push("فوری طور پر اگلے مرحلے کی کارروائی شروع کریں");
        if (payRatio < 0.5) recommendations.push("ادائیگی کی یاد دہانی بھیجیں (واٹس ایپ/فون)");
        if (rejectedDocs > 0) recommendations.push("مسترد دستاویزات دوبارہ جمع کروائیں");
        if (daysOnStage > 5) recommendations.push("ایجنٹ سے فالو اپ لیں — مرحلہ آگے بڑھائیں");
        if (agentOverdueRate > 0.3) recommendations.push("ایجنٹ کی کارکردگی جائزہ لیں — تربیت یا ری اسائنمنٹ");
        if (recommendations.length === 0) recommendations.push("کیس ٹریک پر ہے — معمول کی نگرانی جاری رکھیں");

        // Estimated completion
        const remainingStages = 12 - c.currentStage;
        const avgDaysPerStage = daysOnStage > 0 ? daysOnStage : 3;
        const estimatedDays = Math.ceil(remainingStages * avgDaysPerStage * (riskScore >= 50 ? 1.5 : 1));

        const predictionText = [
          `${riskEmoji} تاخیر رسک اسسمنٹ — ${c.id}`,
          `کسٹمر: ${c.customerName} | ایجنٹ: ${c.agentName}`,
          `مرحلہ: ${c.currentStage}/12 — ${getStageLabel(c.status, true)}`,
          ``,
          `📊 رسک سکور: ${riskScore}/100 — ${riskLevel}`,
          ``,
          `⚠️ خطرے کے عوامل:`,
          ...riskFactors.map(f => `  • ${f}`),
          ``,
          `💡 تجاویز:`,
          ...recommendations.map((r, i) => `  ${i + 1}. ${r}`),
          ``,
          `📅 تخمینی مکمل ہونے کا وقت: ~${estimatedDays} دن`,
          `💰 باقی ادائیگی: PKR ${(c.totalFee - c.paidAmount).toLocaleString()}`,
        ].join("\n");

        return {
          success: true,
          message: predictionText,
          data: {
            id: c.id,
            riskScore,
            riskLevel,
            riskFactors,
            recommendations,
            estimatedDays,
            paymentBalance: c.totalFee - c.paidAmount,
          },
        };
      }

      default:
        return { success: false, message: `نامعلوم CRM ایکشن: ${(action as any).type}` };
    }
  } catch (err: any) {
    return { success: false, message: `CRM ایکشن میں خرابی: ${err.message || err}` };
  }
}

// ──────────────────────────────────────────────
// Execute all actions and return combined result
// ──────────────────────────────────────────────
export async function executeAllActions(actions: CRMAction[]): Promise<CRMActionResult[]> {
  const results: CRMActionResult[] = [];
  for (const action of actions) {
    results.push(await executeAction(action));
  }
  return results;
}