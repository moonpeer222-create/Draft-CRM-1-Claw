/**
 * UnifiedBottomNav — Mobile bottom tab bar (lg:hidden).
 * Shows max 5 items based on the current role's mobileBottom config.
 * Thumb-friendly: 48px+ touch targets, fixed to bottom, safe-area padding.
 * Uses role-specific accent colors and animated sliding pill indicator.
 */
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { getMobileBottomNav, buildPath, type PortalRole } from "../lib/navigationConfig";

const ROLE_ACTIVE_COLORS: Record<PortalRole, { text: string; textDark: string; bg: string; bgDark: string; pill: string; pillDark: string }> = {
  admin:       { text: "text-emerald-700", textDark: "text-emerald-400", bg: "bg-emerald-50",  bgDark: "bg-emerald-500/12", pill: "bg-emerald-600", pillDark: "bg-emerald-400" },
  agent:       { text: "text-blue-700",    textDark: "text-blue-400",    bg: "bg-blue-50",     bgDark: "bg-blue-500/12",    pill: "bg-blue-600",    pillDark: "bg-blue-400" },
  customer:    { text: "text-purple-700",  textDark: "text-purple-400",  bg: "bg-purple-50",   bgDark: "bg-purple-500/12",  pill: "bg-purple-600",  pillDark: "bg-purple-400" },
  operator:    { text: "text-orange-700",  textDark: "text-orange-400",  bg: "bg-orange-50",   bgDark: "bg-orange-500/12",  pill: "bg-orange-600",  pillDark: "bg-orange-400" },
  master_admin:{ text: "text-amber-700",   textDark: "text-amber-400",   bg: "bg-amber-50",    bgDark: "bg-amber-500/12",   pill: "bg-amber-600",   pillDark: "bg-amber-400" },
};

export function UnifiedBottomNav() {
  const { darkMode, isUrdu } = useTheme();
  const { role } = useUnifiedLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const dc = darkMode;

  const items = getMobileBottomNav(role);
  const prefix = role === "master_admin" ? "/master" : `/${role}`;
  const colors = ROLE_ACTIVE_COLORS[role];

  const isActive = (path: string) => {
    if (path === prefix) return location.pathname === prefix || location.pathname === prefix + "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t ${
        dc
          ? "bg-gray-950/95 backdrop-blur-2xl border-white/[0.06]"
          : "bg-white/95 backdrop-blur-2xl border-gray-100"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      
    </nav>
  );
}
