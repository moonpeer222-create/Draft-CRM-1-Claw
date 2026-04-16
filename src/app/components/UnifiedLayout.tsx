/**
 * UnifiedLayout — Single layout shell for ALL CRM portals.
 *
 * Renders:
 *  - UnifiedSidebar (desktop lg+)
 *  - UnifiedHeader (top bar)
 *  - UnifiedBottomNav (mobile bottom tabs)
 *  - Content via <Outlet /> or children
 *
 * Detects the current portal role from the URL path and passes it down
 * via React Context so child pages can skip rendering their own sidebars.
 */
import { createContext, useContext, useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { useTheme } from "../lib/ThemeContext";
import { detectRoleFromPath, type PortalRole } from "../lib/navigationConfig";
import { UnifiedSidebar } from "./UnifiedSidebar";
import { UnifiedHeader } from "./UnifiedHeader";
import { UnifiedBottomNav } from "./UnifiedBottomNav";

// ── Layout Context ───────────────────────────────────────────────────
interface LayoutContextValue {
  /** True when the page is rendered inside the unified shell */
  insideUnifiedLayout: boolean;
  /** Current portal role */
  role: PortalRole;
  /** Sidebar collapsed state (desktop) */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  /** Mobile sidebar open state */
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;
  /** Whether currently on mobile */
  isMobile: boolean;
}

const LayoutContext = createContext<LayoutContextValue>({
  insideUnifiedLayout: false,
  role: "admin",
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
  mobileSidebarOpen: false,
  setMobileSidebarOpen: () => {},
  isMobile: false,
});

export function useUnifiedLayout() {
  return useContext(LayoutContext);
}

// ── Component ────────────────────────────────────────────────────────
interface UnifiedLayoutProps {
  /** Override role (normally auto-detected from URL) */
  forceRole?: PortalRole;
  children?: React.ReactNode;
}

export function UnifiedLayout({ forceRole, children }: UnifiedLayoutProps) {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const role = forceRole || detectRoleFromPath(location.pathname) || "admin";

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Detect small screens and auto-collapse sidebar
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileSidebarOpen]);

  const ctx: LayoutContextValue = {
    insideUnifiedLayout: true,
    role,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    isMobile,
  };

  return (
    <LayoutContext.Provider value={ctx}>
      <div
        className={`${isUrdu ? fontClass : ""} flex min-h-[100dvh] transition-colors duration-300 ${
          darkMode ? "bg-gray-950 text-white" : "bg-gray-50/80 text-gray-900"
        }`}
      >
        {/* Desktop sidebar */}
        <UnifiedSidebar />

        {/* Main content area */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-out ${
            sidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[260px]"
          }`}
        >
          <UnifiedHeader />

          {/* Content area — child pages provide their own padding */}
          <main
            className="flex-1 pb-[calc(68px+env(safe-area-inset-bottom,0px))] lg:pb-0"
            data-unified-shell
          >
            {children || <Outlet />}
          </main>
        </div>

        {/* Mobile bottom nav */}
        <UnifiedBottomNav />

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </div>
    </LayoutContext.Provider>
  );
}
