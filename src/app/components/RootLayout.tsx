import { Outlet, useLocation, useNavigate } from "react-router";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "../lib/ThemeContext";
import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { DataSync } from "../lib/dataSync";
import { listenForPanic, SAFE_ROUTES } from "../lib/panicMode";

import { NetworkStatusBanner } from "./NetworkStatusBanner";
import { ErrorBoundary } from "./ErrorBoundary";
import { authApi, getSessionToken, clearSessionToken } from "../lib/api";

// Lazy load heavy components
const VisaVerseProvider = lazy(() => import("./visaverse").then(m => ({ default: m.VisaVerseProvider })));
const VisaVerseOverlay = lazy(() => import("./visaverse").then(m => ({ default: m.VisaVerseOverlay })));
const KeyboardShortcuts = lazy(() => import("./KeyboardShortcuts").then(m => ({ default: m.KeyboardShortcuts })));
const CommandPalette = lazy(() => import("./CommandPalette").then(m => ({ default: m.CommandPalette })));
const GlobalAIChatbot = lazy(() => import("./GlobalAIChatbot").then(m => ({ default: m.GlobalAIChatbot })));

// Detect current portal role from URL path
function useCurrentRole(): "admin" | "agent" | "customer" | "operator" | "master" | null {
  const location = useLocation();
  const path = location.pathname;
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/agent")) return "agent";
  if (path.startsWith("/customer")) return "customer";
  if (path.startsWith("/operator")) return "operator";
  if (path.startsWith("/master")) return "master";
  return null;
}

// Improvement #12: Session timeout — auto-logout after inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_WARNING_MS = 25 * 60 * 1000; // Warning at 25 minutes

function useSessionTimeout() {
  const navigate = useNavigate();
  const role = useCurrentRole();
  const lastActivityRef = useRef(Date.now());
  const [showWarning, setShowWarning] = useState(false);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!role) return; // Only active on portal pages

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    const handler = () => resetTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= SESSION_TIMEOUT_MS) {
        // Auto-logout
        const loginPath = `/${role}/login`;
        navigate(loginPath, { replace: true });
      } else if (elapsed >= SESSION_WARNING_MS) {
        setShowWarning(true);
      }
    }, 15000); // Check every 15s

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clearInterval(interval);
    };
  }, [role, navigate, resetTimer]);

  return { showWarning, resetTimer };
}

// Improvement #11: RTL wrapper for Urdu
function RTLWrapper({ children }: { children: React.ReactNode }) {
  const { isUrdu } = useTheme();

  useEffect(() => {
    document.documentElement.dir = isUrdu ? "rtl" : "ltr";
    document.documentElement.lang = isUrdu ? "ur" : "en";
    if (isUrdu) {
      document.documentElement.classList.add("rtl-mode");
    } else {
      document.documentElement.classList.remove("rtl-mode");
    }
    return () => {
      document.documentElement.dir = "ltr";
      document.documentElement.classList.remove("rtl-mode");
    };
  }, [isUrdu]);

  return <>{children}</>;
}

// Session timeout warning banner
function SessionTimeoutWarning({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium shadow-lg animate-pulse"
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 8px)" }}
    >
      Session expiring soon due to inactivity — move your mouse to stay logged in
      <button onClick={onDismiss} className="ml-3 underline hover:no-underline text-xs">
        Dismiss
      </button>
    </div>
  );
}

// Improvement #2: Server-side session expiry validation
function useServerSessionValidator() {
  const navigate = useNavigate();
  const role = useCurrentRole();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (!role) return; // Only on portal pages

    const token = getSessionToken();
    if (!token) return; // No server session to validate

    let cancelled = false;

    // Check on mount
    const checkSession = async () => {
      try {
        const res = await authApi.validate();
        if (cancelled) return;
        if (res.success && res.data && (res.data as any).valid === false) {
          // Server session expired
          setSessionExpired(true);
          clearSessionToken();
          // Auto-dismiss after 5 seconds and redirect
          setTimeout(() => {
            if (!cancelled) {
              setSessionExpired(false);
              navigate(`/${role}/login`, { replace: true });
            }
          }, 5000);
        }
      } catch {
        // Network error — don't invalidate (offline-first)
      }
    };

    checkSession();

    // Re-validate every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [role, navigate]);

  return { sessionExpired, setSessionExpired };
}

// Session expired banner
function SessionExpiredBanner({ role, onDismiss }: { role: string; onDismiss: () => void }) {
  const navigate = useNavigate();
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-3 text-center text-sm font-medium shadow-lg flex items-center justify-center gap-3"
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 8px)" }}
    >
      <span>Your server session has expired. Please log in again.</span>
      <button
        onClick={() => {
          onDismiss();
          navigate(`/${role}/login`, { replace: true });
        }}
        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors"
      >
        Log In
      </button>
      <button onClick={onDismiss} className="ml-1 underline hover:no-underline text-xs">
        Dismiss
      </button>
    </div>
  );
}

// Lazy fallback for heavy components
function LazyComponentFallback() {
  return null; // Don't show loading for background components
}

function InnerLayout() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const role = useCurrentRole();
  const { showWarning, resetTimer } = useSessionTimeout();
  const { sessionExpired, setSessionExpired } = useServerSessionValidator();

  // Detect mobile for toast positioning
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Run data sync on mount
  useEffect(() => {
    DataSync.fullSync();
    
    const validation = DataSync.validateDataIntegrity();
    if (!validation.valid) {
      const { fixed } = DataSync.autoFix();
      if (fixed > 0) {
        console.log(`Auto-fixed ${fixed} data issues`);
      }
    }
  }, []);

  // Initialize panic mode listener ONLY on protected routes
  useEffect(() => {
    const isSafe = SAFE_ROUTES.some(route => location.pathname === route);
    if (isSafe) return;
    const cleanupPanic = listenForPanic();
    return () => cleanupPanic();
  }, [location.pathname]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <RTLWrapper>
      <NetworkStatusBanner />
      {sessionExpired && role && <SessionExpiredBanner role={role} onDismiss={() => setSessionExpired(false)} />}
      {showWarning && !sessionExpired && <SessionTimeoutWarning onDismiss={resetTimer} />}
      
      {/* Lazy loaded heavy components */}
      <Suspense fallback={<LazyComponentFallback />}>
        {role && <KeyboardShortcuts role={role} />}
        {role && <CommandPalette role={role} />}
      </Suspense>
      
      <ErrorBoundary portalName={role || undefined}>
        <Outlet />
      </ErrorBoundary>
      
      <Suspense fallback={<LazyComponentFallback />}>
        <VisaVerseOverlay />
        <GlobalAIChatbot />
      </Suspense>
      
      
      <Toaster 
        position="top-center" 
        expand={false} 
        richColors 
        closeButton 
        duration={3000}
        toastOptions={{
          className: "!text-sm",
          style: {
            maxWidth: "92vw",
            fontSize: "14px",
          },
        }}
        mobileOffset={isMobile ? 16 : 60}
        offset={isMobile ? 8 : undefined}
      />
    </RTLWrapper>
  );
}

export function RootLayout() {
  return (
    
      <ThemeProvider>
        <Suspense fallback={null}>
          <VisaVerseProvider>
            <InnerLayout />
          </VisaVerseProvider>
        </Suspense>
      </ThemeProvider>
    
  );
}
