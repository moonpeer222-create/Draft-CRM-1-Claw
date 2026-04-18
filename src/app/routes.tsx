import { type ReactNode, lazy, Suspense } from "react";
import { createBrowserRouter, createHashRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { UnifiedLayout } from "./components/UnifiedLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useSupabaseAuth } from "./context/SupabaseAuthContext";

// Retry wrapper for lazy imports — handles transient CDN/network failures gracefully
function lazyRetry<T extends { [key: string]: any }>(
  factory: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (remaining: number) => {
      factory()
        .then(resolve)
        .catch((err: any) => {
          if (remaining <= 0) {
            reject(err);
            return;
          }
          console.warn(`[LazyRetry] Module fetch failed, retrying (${remaining} left)...`, err?.message);
          setTimeout(() => attempt(remaining - 1), delay);
        });
    };
    attempt(retries);
  });
}

// Lazy-load all page components
const LandingPage = lazy(() => lazyRetry(() => import("./pages/LandingPage").then(m => ({ default: m.LandingPage }))));
const AdminLogin = lazy(() => lazyRetry(() => import("./pages/admin/AdminLogin").then(m => ({ default: m.AdminLogin }))));
const AdminDashboard = lazy(() => lazyRetry(() => import("./pages/admin/AdminDashboardEnhanced").then(m => ({ default: m.AdminDashboard }))));
const AdminReports = lazy(() => lazyRetry(() => import("./pages/admin/AdminReports").then(m => ({ default: m.AdminReports }))));
const AdminTeam = lazy(() => lazyRetry(() => import("./pages/admin/AdminTeamEnhanced").then(m => ({ default: m.AdminTeam }))));
const AdminAttendance = lazy(() => lazyRetry(() => import("./pages/admin/AdminAttendance").then(m => ({ default: m.AdminAttendance }))));
const AdminFinancials = lazy(() => lazyRetry(() => import("./pages/admin/AdminFinancials").then(m => ({ default: m.AdminFinancials }))));
const AdminSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminSettings").then(m => ({ default: m.AdminSettings }))));
const AdminCaseManagement = lazy(() => lazyRetry(() => import("./pages/admin/AdminCaseManagement").then(m => ({ default: m.AdminCaseManagement }))));
const AdminBusinessIntelligence = lazy(() => lazyRetry(() => import("./pages/admin/AdminBusinessIntelligence").then(m => ({ default: m.AdminBusinessIntelligence }))));
const AdminUserManagement = lazy(() => lazyRetry(() => import("./pages/admin/AdminUserManagement").then(m => ({ default: m.AdminUserManagement }))));
const AdminProfile = lazy(() => lazyRetry(() => import("./pages/admin/AdminProfile").then(m => ({ default: m.AdminProfile }))));
const AdminOverdueCases = lazy(() => lazyRetry(() => import("./pages/admin/AdminOverdueCases").then(m => ({ default: m.AdminOverdueCases }))));
const AdminAgentCodes = lazy(() => lazyRetry(() => import("./pages/admin/AdminAgentCodes").then(m => ({ default: m.AdminAgentCodes }))));
const AdminAnalytics = lazy(() => lazyRetry(() => import("./pages/admin/AdminAnalytics").then(m => ({ default: m.AdminAnalytics }))));
const AdminLeaderboard = lazy(() => lazyRetry(() => import("./pages/admin/AdminLeaderboard").then(m => ({ default: m.AdminLeaderboard }))));
const AdminDocuments = lazy(() => lazyRetry(() => import("./pages/admin/AdminDocumentCenter").then(m => ({ default: m.AdminDocumentCenter }))));
const AdminPanicTest = lazy(() => lazyRetry(() => import("./pages/admin/AdminPanicTest").then(m => ({ default: m.AdminPanicTest }))));
const AdminPassportTracker = lazy(() => lazyRetry(() => import("./pages/admin/AdminPassportTracker").then(m => ({ default: m.AdminPassportTracker }))));
const AdminApprovalQueue = lazy(() => lazyRetry(() => import("./pages/admin/AdminApprovalQueue").then(m => ({ default: m.AdminApprovalQueue }))));
const AdminAuditLog = lazy(() => lazyRetry(() => import("./pages/admin/AdminAuditLog").then(m => ({ default: m.AdminAuditLog }))));
const AdminBackup = lazy(() => lazyRetry(() => import("./pages/admin/AdminBackup").then(m => ({ default: m.AdminBackup }))));
const AdminSyncHistory = lazy(() => lazyRetry(() => import("./pages/admin/AdminSyncHistory").then(m => ({ default: m.AdminSyncHistory }))));
const AdminAIChatbot = lazy(() => lazyRetry(() => import("./pages/admin/AdminAIChatbot").then(m => ({ default: m.AdminAIChatbot }))));
const AdminVoiceAssistant = lazy(() => lazyRetry(() => import("./pages/admin/AdminVoiceAssistant").then(m => ({ default: m.AdminVoiceAssistant }))));
const MasterLogin = lazy(() => lazyRetry(() => import("./pages/master/MasterLogin").then(m => ({ default: m.MasterLogin }))));
const MasterTenantsList = lazy(() => lazyRetry(() => import("./pages/master/MasterTenantsList").then(m => ({ default: m.MasterTenantsList }))));
const TenantSignup = lazy(() => lazyRetry(() => import("./pages/TenantSignup").then(m => ({ default: m.TenantSignup }))));
const OnboardingWizard = lazy(() => lazyRetry(() => import("./pages/OnboardingWizard").then(m => ({ default: m.OnboardingWizard }))));
const MasterDashboard = lazy(() => lazyRetry(() => import("./pages/master/MasterDashboard").then(m => ({ default: m.MasterDashboard }))));
const MasterAIChatbot = lazy(() => lazyRetry(() => import("./pages/master/MasterAIChatbot").then(m => ({ default: m.MasterAIChatbot }))));
const MasterVoiceAssistant = lazy(() => lazyRetry(() => import("./pages/master/MasterVoiceAssistant").then(m => ({ default: m.MasterVoiceAssistant }))));
const MasterProfile = lazy(() => lazyRetry(() => import("./pages/master/MasterProfile").then(m => ({ default: m.MasterProfile }))));
const MasterAITools = lazy(() => lazyRetry(() => import("./pages/master/MasterAITools").then(m => ({ default: m.MasterAITools }))));
const MasterQwenTest = lazy(() => lazyRetry(() => import("./pages/master/MasterQwenTest").then(m => ({ default: m.MasterQwenTest }))));
const AgentLogin = lazy(() => lazyRetry(() => import("./pages/agent/AgentLogin").then(m => ({ default: m.AgentLogin }))));
const AgentDashboard = lazy(() => lazyRetry(() => import("./pages/agent/AgentDashboard").then(m => ({ default: m.AgentDashboard }))));
const AgentCases = lazy(() => lazyRetry(() => import("./pages/agent/AgentCases").then(m => ({ default: m.AgentCases }))));
const AgentCalendar = lazy(() => lazyRetry(() => import("./pages/agent/AgentCalendar").then(m => ({ default: m.AgentCalendar }))));
const AgentPerformance = lazy(() => lazyRetry(() => import("./pages/agent/AgentPerformance").then(m => ({ default: m.AgentPerformance }))));
const AgentAttendance = lazy(() => lazyRetry(() => import("./pages/agent/AgentAttendance").then(m => ({ default: m.AgentAttendance }))));
const AgentProfile = lazy(() => lazyRetry(() => import("./pages/agent/AgentProfile").then(m => ({ default: m.AgentProfile }))));
const AgentAIChatbot = lazy(() => lazyRetry(() => import("./pages/agent/AgentAIChatbot").then(m => ({ default: m.AgentAIChatbot }))));
const AgentVoiceAssistant = lazy(() => lazyRetry(() => import("./pages/agent/AgentVoiceAssistant").then(m => ({ default: m.AgentVoiceAssistant }))));
const CustomerLogin = lazy(() => lazyRetry(() => import("./pages/customer/CustomerLogin").then(m => ({ default: m.CustomerLogin }))));
const CustomerDashboard = lazy(() => lazyRetry(() => import("./pages/customer/CustomerDashboard").then(m => ({ default: m.CustomerDashboard }))));
const CustomerDocuments = lazy(() => lazyRetry(() => import("./pages/customer/CustomerDocuments").then(m => ({ default: m.CustomerDocuments }))));
const CustomerPayments = lazy(() => lazyRetry(() => import("./pages/customer/CustomerPayments").then(m => ({ default: m.CustomerPayments }))));
const CustomerNotifications = lazy(() => lazyRetry(() => import("./pages/customer/CustomerNotifications").then(m => ({ default: m.CustomerNotifications }))));
const CustomerAIChatbot = lazy(() => lazyRetry(() => import("./pages/customer/CustomerAIChatbot").then(m => ({ default: m.CustomerAIChatbot }))));
const CustomerVoiceAssistant = lazy(() => lazyRetry(() => import("./pages/customer/CustomerVoiceAssistant").then(m => ({ default: m.CustomerVoiceAssistant }))));
const OperatorLogin = lazy(() => lazyRetry(() => import("./pages/operator/OperatorLogin").then(m => ({ default: m.OperatorLogin }))));
const UpdatePassword = lazy(() => lazyRetry(() => import("./pages/UpdatePassword").then(m => ({ default: m.UpdatePassword }))));
const TermsOfService = lazy(() => lazyRetry(() => import("./pages/TermsOfService").then(m => ({ default: m.TermsOfService }))));
const PrivacyPolicy = lazy(() => lazyRetry(() => import("./pages/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy }))));
const PricingPage = lazy(() => lazyRetry(() => import("./pages/PricingPage").then(m => ({ default: m.PricingPage }))));
const OperatorOperations = lazy(() => lazyRetry(() => import("./pages/operator/OperatorOperations").then(m => ({ default: m.OperatorOperations }))));
const OperatorAIChatbot = lazy(() => lazyRetry(() => import("./pages/operator/OperatorAIChatbot").then(m => ({ default: m.OperatorAIChatbot }))));
const OperatorVoiceAssistant = lazy(() => lazyRetry(() => import("./pages/operator/OperatorVoiceAssistant").then(m => ({ default: m.OperatorVoiceAssistant }))));
const AdminHealthDashboard = lazy(() => lazyRetry(() => import("./pages/admin/AdminHealthDashboard").then(m => ({ default: m.AdminHealthDashboard }))));
const MasterAuditDashboard = lazy(() => lazyRetry(() => import("./pages/master/MasterAuditDashboard").then(m => ({ default: m.MasterAuditDashboard }))));
const NotFound = lazy(() => lazyRetry(() => import("./pages/NotFound").then(m => ({ default: m.NotFound }))));

// Lazy loading fallback spinner
function LazyFallback() {
  return (
    <div className="flex items-center justify-center p-8 min-h-[200px]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-[3px] border-emerald-100 dark:border-emerald-900/40 rounded-full" />
          <div className="absolute inset-0 w-10 h-10 sm:w-12 sm:h-12 border-[3px] border-transparent border-t-emerald-500 rounded-full animate-spin" />
        </div>
        <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-600 font-medium tracking-wide">Loading...</p>
      </div>
    </div>
  );
}

function SuspenseWrap({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LazyFallback />}>{children}</Suspense>;
}

// Route-level error element
function RouteErrorFallback() {
  return (
    <ErrorBoundary portalName="route-error" fallbackTitle="Page Load Error">
      <div className="min-h-[50dvh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-rose-500 px-5 sm:px-6 py-5 sm:py-6 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <h2 className="text-lg font-bold">Page Failed to Load</h2>
            <p className="text-white/70 text-sm mt-1">This page encountered an error during loading.</p>
          </div>
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-gray-500 text-sm">Your data is safe. This is typically a temporary issue.</p>
            <div className="flex gap-2">
              <button onClick={() => window.location.reload()} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition-colors min-h-[44px] active:bg-emerald-800">
                Reload Page
              </button>
              <button onClick={() => window.location.href = "/"} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-semibold transition-colors min-h-[44px] active:bg-gray-300">
                Go Home
              </button>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Emerald Tech Partner | If this persists, contact 03186986259</p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// ── Auth guards ──────────────────────────────────────────────────────
function AdminGuard({ children }: { children: ReactNode }) {
  const { profile, loading } = useSupabaseAuth();
  if (loading) return <LazyFallback />;
  if (!profile || !['admin', 'master_admin'].includes(profile.role)) {
    return <Navigate to="/admin/login" replace />;
  }
  
  // Force onboarding if owner hasn't completed it
  if (profile.role === 'master_admin' && profile.tenants && !profile.tenants.onboarding_completed) {
     return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
}

function MasterGuard({ children }: { children: ReactNode }) {
  const { profile, loading } = useSupabaseAuth();
  if (loading) return <LazyFallback />;
  if (!profile || profile.role !== 'master_admin') {
    return <Navigate to="/master/login" replace />;
  }
  return <>{children}</>;
}

function AgentGuard({ children }: { children: ReactNode }) {
  const { profile, loading } = useSupabaseAuth();
  if (loading) return <LazyFallback />;
  if (!profile || profile.role !== 'agent') {
    return <Navigate to="/agent/login" replace />;
  }
  return <>{children}</>;
}

function CustomerGuard({ children }: { children: ReactNode }) {
  const { profile, loading } = useSupabaseAuth();
  if (loading) return <LazyFallback />;
  if (!profile || profile.role !== 'customer') {
    return <Navigate to="/customer/login" replace />;
  }
  return <>{children}</>;
}

function OperatorGuard({ children }: { children: ReactNode }) {
  const { profile, loading } = useSupabaseAuth();
  if (loading) return <LazyFallback />;
  if (!profile || profile.role !== 'operator') {
    return <Navigate to="/operator/login" replace />;
  }
  return <>{children}</>;
}

// ── Unified Layout wrapper per role ──────────────────────────────────
// Wraps all authenticated routes for a role in the single unified shell.
function AdminLayout() { return <AdminGuard><UnifiedLayout forceRole="admin" /></AdminGuard>; }
function MasterLayout() { return <MasterGuard><UnifiedLayout forceRole="master_admin" /></MasterGuard>; }
function AgentLayout() { return <AgentGuard><UnifiedLayout forceRole="agent" /></AgentGuard>; }
function CustomerLayout() { return <CustomerGuard><UnifiedLayout forceRole="customer" /></CustomerGuard>; }
function OperatorLayout() { return <OperatorGuard><UnifiedLayout forceRole="operator" /></OperatorGuard>; }

// ── Router ───────────────────────────────────────────────────────────
const routeConfig = [
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      // Landing
      { index: true, element: <SuspenseWrap><LandingPage /></SuspenseWrap> },

      // ── Login pages (no unified layout) ────────────────────────────
      { path: "admin/login", element: <SuspenseWrap><AdminLogin /></SuspenseWrap> },
      { path: "master/login", element: <SuspenseWrap><MasterLogin /></SuspenseWrap> },
      { path: "agent/login", element: <SuspenseWrap><AgentLogin /></SuspenseWrap> },
      { path: "customer/login", element: <SuspenseWrap><CustomerLogin /></SuspenseWrap> },
      { path: "operator/login", element: <SuspenseWrap><OperatorLogin /></SuspenseWrap> },

      // ── Admin Portal (unified layout) ─────────────────────────────
      {
        path: "admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <SuspenseWrap><AdminDashboard /></SuspenseWrap> },
          { path: "reports", element: <SuspenseWrap><AdminReports /></SuspenseWrap> },
          { path: "team", element: <SuspenseWrap><AdminTeam /></SuspenseWrap> },
          { path: "attendance", element: <SuspenseWrap><AdminAttendance /></SuspenseWrap> },
          { path: "financials", element: <SuspenseWrap><AdminFinancials /></SuspenseWrap> },
          { path: "settings", element: <SuspenseWrap><AdminSettings /></SuspenseWrap> },
          { path: "cases", element: <SuspenseWrap><AdminCaseManagement /></SuspenseWrap> },
          { path: "cases/:caseId", element: <SuspenseWrap><AdminCaseManagement /></SuspenseWrap> },
          { path: "business-intelligence", element: <SuspenseWrap><AdminBusinessIntelligence /></SuspenseWrap> },
          { path: "user-management", element: <SuspenseWrap><AdminUserManagement /></SuspenseWrap> },
          { path: "profile", element: <SuspenseWrap><AdminProfile /></SuspenseWrap> },
          { path: "overdue-cases", element: <SuspenseWrap><AdminOverdueCases /></SuspenseWrap> },
          { path: "agent-codes", element: <SuspenseWrap><AdminAgentCodes /></SuspenseWrap> },
          { path: "analytics", element: <SuspenseWrap><AdminAnalytics /></SuspenseWrap> },
          { path: "leaderboard", element: <SuspenseWrap><AdminLeaderboard /></SuspenseWrap> },
          { path: "documents", element: <SuspenseWrap><AdminDocuments /></SuspenseWrap> },
          { path: "panic-test", element: <SuspenseWrap><AdminPanicTest /></SuspenseWrap> },
          { path: "passport-tracker", element: <SuspenseWrap><AdminPassportTracker /></SuspenseWrap> },
          { path: "approval-queue", element: <SuspenseWrap><AdminApprovalQueue /></SuspenseWrap> },
          { path: "audit-log", element: <SuspenseWrap><AdminAuditLog /></SuspenseWrap> },
          { path: "backup", element: <SuspenseWrap><AdminBackup /></SuspenseWrap> },
          { path: "sync-history", element: <SuspenseWrap><AdminSyncHistory /></SuspenseWrap> },
          { path: "ai-chatbot", element: <SuspenseWrap><AdminAIChatbot /></SuspenseWrap> },
          { path: "voice-assistant", element: <SuspenseWrap><AdminVoiceAssistant /></SuspenseWrap> },
          { path: "operations", element: <SuspenseWrap><OperatorOperations /></SuspenseWrap> },
          { path: "health", element: <SuspenseWrap><AdminHealthDashboard /></SuspenseWrap> },
        ],
      },

      // ── Master Admin Portal (unified layout) ──────────────────────
      {
        path: "master",
        element: <MasterLayout />,
        children: [
          { index: true, element: <SuspenseWrap><MasterDashboard /></SuspenseWrap> },
          { path: "ai-chatbot", element: <SuspenseWrap><MasterAIChatbot /></SuspenseWrap> },
          { path: "voice-assistant", element: <SuspenseWrap><MasterVoiceAssistant /></SuspenseWrap> },
          { path: "profile", element: <SuspenseWrap><MasterProfile /></SuspenseWrap> },
          { path: "ai-tools", element: <SuspenseWrap><MasterAITools /></SuspenseWrap> },
          { path: "stepfun-test", element: <SuspenseWrap><MasterQwenTest /></SuspenseWrap> },
          { path: "qwen-test", element: <Navigate to="/master/stepfun-test" replace /> },
          { path: "tenants", element: <SuspenseWrap><MasterTenantsList /></SuspenseWrap> },
          { path: "audit-dashboard", element: <SuspenseWrap><MasterAuditDashboard /></SuspenseWrap> },
          // Master admin reuses admin pages for shared functionality
          { path: "cases", element: <SuspenseWrap><AdminCaseManagement /></SuspenseWrap> },
          { path: "cases/:caseId", element: <SuspenseWrap><AdminCaseManagement /></SuspenseWrap> },
          { path: "operations", element: <SuspenseWrap><OperatorOperations /></SuspenseWrap> },
          { path: "documents", element: <SuspenseWrap><AdminDocuments /></SuspenseWrap> },
          { path: "financials", element: <SuspenseWrap><AdminFinancials /></SuspenseWrap> },
          { path: "team", element: <SuspenseWrap><AdminTeam /></SuspenseWrap> },
          { path: "attendance", element: <SuspenseWrap><AdminAttendance /></SuspenseWrap> },
          { path: "overdue-cases", element: <SuspenseWrap><AdminOverdueCases /></SuspenseWrap> },
          { path: "approval-queue", element: <SuspenseWrap><AdminApprovalQueue /></SuspenseWrap> },
          { path: "passport-tracker", element: <SuspenseWrap><AdminPassportTracker /></SuspenseWrap> },
          { path: "leaderboard", element: <SuspenseWrap><AdminLeaderboard /></SuspenseWrap> },
          { path: "agent-codes", element: <SuspenseWrap><AdminAgentCodes /></SuspenseWrap> },
          { path: "user-management", element: <SuspenseWrap><AdminUserManagement /></SuspenseWrap> },
          { path: "reports", element: <SuspenseWrap><AdminReports /></SuspenseWrap> },
          { path: "analytics", element: <SuspenseWrap><AdminAnalytics /></SuspenseWrap> },
          { path: "business-intelligence", element: <SuspenseWrap><AdminBusinessIntelligence /></SuspenseWrap> },
          { path: "settings", element: <SuspenseWrap><AdminSettings /></SuspenseWrap> },
          { path: "health", element: <SuspenseWrap><AdminHealthDashboard /></SuspenseWrap> },
          { path: "audit-log", element: <SuspenseWrap><AdminAuditLog /></SuspenseWrap> },
          { path: "backup", element: <SuspenseWrap><AdminBackup /></SuspenseWrap> },
          { path: "sync-history", element: <SuspenseWrap><AdminSyncHistory /></SuspenseWrap> },
        ],
      },

      // ── Agent Portal (unified layout) ──────────────────────────────
      {
        path: "agent",
        element: <AgentLayout />,
        children: [
          { index: true, element: <SuspenseWrap><AgentDashboard /></SuspenseWrap> },
          { path: "cases", element: <SuspenseWrap><AgentCases /></SuspenseWrap> },
          { path: "cases/:caseId", element: <SuspenseWrap><AgentCases /></SuspenseWrap> },
          { path: "calendar", element: <SuspenseWrap><AgentCalendar /></SuspenseWrap> },
          { path: "performance", element: <SuspenseWrap><AgentPerformance /></SuspenseWrap> },
          { path: "attendance", element: <SuspenseWrap><AgentAttendance /></SuspenseWrap> },
          { path: "profile", element: <SuspenseWrap><AgentProfile /></SuspenseWrap> },
          { path: "ai-chatbot", element: <SuspenseWrap><AgentAIChatbot /></SuspenseWrap> },
          { path: "voice-assistant", element: <SuspenseWrap><AgentVoiceAssistant /></SuspenseWrap> },
        ],
      },

      // ── Customer Portal (unified layout) ───────────────────────────
      {
        path: "customer",
        element: <CustomerLayout />,
        children: [
          { index: true, element: <SuspenseWrap><CustomerDashboard /></SuspenseWrap> },
          { path: "documents", element: <SuspenseWrap><CustomerDocuments /></SuspenseWrap> },
          { path: "payments", element: <SuspenseWrap><CustomerPayments /></SuspenseWrap> },
          { path: "notifications", element: <SuspenseWrap><CustomerNotifications /></SuspenseWrap> },
          { path: "ai-chatbot", element: <SuspenseWrap><CustomerAIChatbot /></SuspenseWrap> },
          { path: "voice-assistant", element: <SuspenseWrap><CustomerVoiceAssistant /></SuspenseWrap> },
        ],
      },

      // ── Operator Portal (unified layout) ───────────────────────────
      {
        path: "operator",
        element: <OperatorLayout />,
        children: [
          { index: true, element: <SuspenseWrap><OperatorOperations /></SuspenseWrap> },
          { path: "operations", element: <SuspenseWrap><OperatorOperations /></SuspenseWrap> },
          { path: "ai-chatbot", element: <SuspenseWrap><OperatorAIChatbot /></SuspenseWrap> },
          { path: "voice-assistant", element: <SuspenseWrap><OperatorVoiceAssistant /></SuspenseWrap> },
        ],
      },

      { path: "signup", element: <SuspenseWrap><TenantSignup /></SuspenseWrap> },
      { path: "onboarding", element: <SuspenseWrap><OnboardingWizard /></SuspenseWrap> },
      { path: "update-password", element: <SuspenseWrap><UpdatePassword /></SuspenseWrap> },
      { path: "terms", element: <SuspenseWrap><TermsOfService /></SuspenseWrap> },
      { path: "privacy", element: <SuspenseWrap><PrivacyPolicy /></SuspenseWrap> },
      { path: "pricing", element: <SuspenseWrap><PricingPage /></SuspenseWrap> },
      // 404
      { path: "*", element: <SuspenseWrap><NotFound /></SuspenseWrap> },
    ],
  },
];

export const router = import.meta.env.VITE_USE_HASH_ROUTER === "true" ? createHashRouter(routeConfig) : createBrowserRouter(routeConfig);