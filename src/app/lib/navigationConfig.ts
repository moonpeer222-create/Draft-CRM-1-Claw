/**
 * Unified Navigation Configuration
 * Single source of truth for ALL portal navigation items and permissions.
 * 
 * Role codes: admin | agent | customer | operator | master_admin
 * Each nav item specifies which roles can see it.
 */
import {
  LayoutDashboard, FileText, CreditCard, Users, Calendar,
  BarChart3, Settings, FolderOpen, Bot, Mic, UserCircle,
  Bell, Shield, ClipboardCheck, Briefcase, TrendingUp,
  Award, BookOpen, Clock, Database, Activity, Wrench,
  Sparkles, FlaskConical, ServerCog, History, Stamp,
  UserCheck, AlertTriangle, FileCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PortalRole = "admin" | "agent" | "customer" | "operator" | "master_admin";

export interface NavItem {
  id: string;
  label: string;
  labelUrdu: string;
  icon: LucideIcon;
  /** Path relative to role prefix — e.g. "" = dashboard, "cases" = /admin/cases */
  path: string;
  /** Roles that can see this item */
  roles: PortalRole[];
  /** Show in mobile bottom nav (max 5 per role) */
  mobileBottom?: boolean;
  /** Badge count key (optional) */
  badgeKey?: string;
  /** Group/section label */
  group: "main" | "documents" | "management" | "tools" | "system";
}

// ── Full navigation items ─────────────────────────────────────────────
export const NAV_ITEMS: NavItem[] = [
  // ─── MAIN GROUP ───
  {
    id: "dashboard",
    label: "Dashboard",
    labelUrdu: "ڈیش بورڈ",
    icon: LayoutDashboard,
    path: "",
    roles: ["admin", "agent", "customer", "operator", "master_admin"],
    mobileBottom: true,
    group: "main",
  },
  {
    id: "cases",
    label: "Cases",
    labelUrdu: "کیسز",
    icon: FileText,
    path: "cases",
    roles: ["admin", "agent", "master_admin"],
    mobileBottom: true,
    group: "main",
  },
  {
    id: "operations",
    label: "Operations",
    labelUrdu: "آپریشنز",
    icon: Briefcase,
    path: "operations",
    roles: ["operator", "admin", "master_admin"],
    mobileBottom: true,
    group: "main",
  },
  {
    id: "documents",
    label: "Document Center",
    labelUrdu: "دستاویز مرکز",
    icon: FolderOpen,
    path: "documents",
    roles: ["admin", "customer", "master_admin"],
    mobileBottom: true,
    group: "documents",
  },
  {
    id: "payments",
    label: "Payments",
    labelUrdu: "ادائیگیاں",
    icon: CreditCard,
    path: "payments",
    roles: ["customer"],
    mobileBottom: true,
    group: "main",
  },
  {
    id: "financials",
    label: "Financials",
    labelUrdu: "مالیات",
    icon: CreditCard,
    path: "financials",
    roles: ["admin", "master_admin"],
    group: "main",
  },
  {
    id: "notifications",
    label: "Notifications",
    labelUrdu: "اطلاعات",
    icon: Bell,
    path: "notifications",
    roles: ["customer"],
    mobileBottom: true,
    group: "main",
  },

  // ─── MANAGEMENT GROUP ───
  {
    id: "team",
    label: "Team",
    labelUrdu: "ٹیم",
    icon: Users,
    path: "team",
    roles: ["admin", "master_admin"],
    group: "management",
  },
  {
    id: "attendance",
    label: "Attendance",
    labelUrdu: "حاضری",
    icon: ClipboardCheck,
    path: "attendance",
    roles: ["admin", "agent", "master_admin"],
    group: "management",
  },
  {
    id: "calendar",
    label: "Calendar",
    labelUrdu: "کیلنڈر",
    icon: Calendar,
    path: "calendar",
    roles: ["agent"],
    group: "management",
  },
  {
    id: "performance",
    label: "Performance",
    labelUrdu: "کارکردگی",
    icon: TrendingUp,
    path: "performance",
    roles: ["agent"],
    mobileBottom: true,
    group: "management",
  },
  {
    id: "overdue-cases",
    label: "Overdue Cases",
    labelUrdu: "تاخیر والے کیسز",
    icon: AlertTriangle,
    path: "overdue-cases",
    roles: ["admin", "master_admin"],
    group: "management",
  },
  {
    id: "approval-queue",
    label: "Approval Queue",
    labelUrdu: "منظوری کی قطار",
    icon: FileCheck,
    path: "approval-queue",
    roles: ["admin", "master_admin"],
    group: "management",
  },
  {
    id: "passport-tracker",
    label: "Passport Tracker",
    labelUrdu: "پاسپورٹ ٹریکر",
    icon: Stamp,
    path: "passport-tracker",
    roles: ["admin", "master_admin"],
    group: "management",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    labelUrdu: "لیڈر بورڈ",
    icon: Award,
    path: "leaderboard",
    roles: ["admin", "master_admin"],
    group: "management",
  },
  {
    id: "agent-codes",
    label: "Agent Codes",
    labelUrdu: "ایجنٹ کوڈز",
    icon: UserCheck,
    path: "agent-codes",
    roles: ["admin", "master_admin"],
    group: "management",
  },
  {
    id: "user-management",
    label: "User Management",
    labelUrdu: "صارف انتظام",
    icon: Users,
    path: "user-management",
    roles: ["admin", "master_admin"],
    group: "management",
  },

  // ─── TOOLS GROUP ───
  {
    id: "ai-chatbot",
    label: "AI Chatbot",
    labelUrdu: "AI چیٹ بوٹ",
    icon: Bot,
    path: "ai-chatbot",
    roles: ["admin", "agent", "customer", "operator", "master_admin"],
    mobileBottom: true,
    group: "tools",
  },
  {
    id: "voice-assistant",
    label: "Voice Assistant",
    labelUrdu: "وائس اسسٹنٹ",
    icon: Mic,
    path: "voice-assistant",
    roles: ["admin", "agent", "customer", "operator", "master_admin"],
    group: "tools",
  },
  {
    id: "reports",
    label: "Reports",
    labelUrdu: "رپورٹس",
    icon: BarChart3,
    path: "reports",
    roles: ["admin", "master_admin"],
    group: "tools",
  },
  {
    id: "analytics",
    label: "Analytics",
    labelUrdu: "تجزیات",
    icon: TrendingUp,
    path: "analytics",
    roles: ["admin", "master_admin"],
    group: "tools",
  },
  {
    id: "business-intelligence",
    label: "Business Intel",
    labelUrdu: "بزنس انٹیلی جنس",
    icon: Sparkles,
    path: "business-intelligence",
    roles: ["admin", "master_admin"],
    group: "tools",
  },
  {
    id: "ai-tools",
    label: "AI Tools",
    labelUrdu: "AI ٹولز",
    icon: Sparkles,
    path: "ai-tools",
    roles: ["master_admin"],
    group: "tools",
  },
  {
    id: "stepfun-test",
    label: "StepFun Test",
    labelUrdu: "StepFun ٹیسٹ",
    icon: FlaskConical,
    path: "stepfun-test",
    roles: ["master_admin"],
    group: "tools",
  },

  // ─── SYSTEM GROUP ───
  {
    id: "profile",
    label: "Profile",
    labelUrdu: "پروفائل",
    icon: UserCircle,
    path: "profile",
    roles: ["admin", "agent", "master_admin"],
    group: "system",
  },
  {
    id: "settings",
    label: "Settings",
    labelUrdu: "ترتیبات",
    icon: Settings,
    path: "settings",
    roles: ["admin", "master_admin"],
    group: "system",
  },
  {
    id: "health",
    label: "System Health",
    labelUrdu: "سسٹم ہیلتھ",
    icon: Activity,
    path: "health",
    roles: ["admin", "master_admin"],
    group: "system",
  },
  {
    id: "audit-log",
    label: "Audit Log",
    labelUrdu: "آڈٹ لاگ",
    icon: BookOpen,
    path: "audit-log",
    roles: ["admin", "master_admin"],
    group: "system",
  },
  {
    id: "audit-dashboard",
    label: "Audit Dashboard",
    labelUrdu: "آڈٹ ڈیش بورڈ",
    icon: ServerCog,
    path: "audit-dashboard",
    roles: ["master_admin"],
    group: "system",
  },
  {
    id: "backup",
    label: "Backup & Sync",
    labelUrdu: "بیکاپ اور سنک",
    icon: Database,
    path: "backup",
    roles: ["admin", "master_admin"],
    group: "system",
  },
  {
    id: "sync-history",
    label: "Sync History",
    labelUrdu: "سنک ہسٹری",
    icon: History,
    path: "sync-history",
    roles: ["admin", "master_admin"],
    group: "system",
  },
];

// ── Helper: get items for a specific role ────────────────────────────
export function getNavForRole(role: PortalRole): NavItem[] {
  return NAV_ITEMS.filter(item => item.roles.includes(role));
}

// ── Helper: get mobile bottom nav items (max 5) ─────────────────────
export function getMobileBottomNav(role: PortalRole): NavItem[] {
  return NAV_ITEMS
    .filter(item => item.roles.includes(role) && item.mobileBottom)
    .slice(0, 5);
}

// ── Helper: get items grouped by section ─────────────────────────────
export function getGroupedNav(role: PortalRole): Record<string, NavItem[]> {
  const items = getNavForRole(role);
  const groups: Record<string, NavItem[]> = {
    main: [],
    documents: [],
    management: [],
    tools: [],
    system: [],
  };
  for (const item of items) {
    groups[item.group].push(item);
  }
  return groups;
}

// ── Group labels ─────────────────────────────────────────────────────
export const GROUP_LABELS: Record<string, { en: string; ur: string }> = {
  main: { en: "Main", ur: "اصل" },
  documents: { en: "Documents", ur: "دستاویزات" },
  management: { en: "Management", ur: "انتظام" },
  tools: { en: "Tools", ur: "ٹولز" },
  system: { en: "System", ur: "سسٹم" },
};

// ── Role display info ────────────────────────────────────────────────
export const ROLE_INFO: Record<PortalRole, { label: string; labelUrdu: string; color: string; bgClass: string }> = {
  admin: {
    label: "Admin",
    labelUrdu: "ایڈمن",
    color: "emerald",
    bgClass: "bg-gradient-to-br from-emerald-500 to-teal-600",
  },
  agent: {
    label: "Agent",
    labelUrdu: "ایجنٹ",
    color: "blue",
    bgClass: "bg-gradient-to-br from-blue-500 to-cyan-600",
  },
  customer: {
    label: "Customer",
    labelUrdu: "کسٹمر",
    color: "purple",
    bgClass: "bg-gradient-to-br from-purple-500 to-violet-600",
  },
  operator: {
    label: "Operator",
    labelUrdu: "آپریٹر",
    color: "orange",
    bgClass: "bg-gradient-to-br from-orange-500 to-amber-600",
  },
  master_admin: {
    label: "Master Admin",
    labelUrdu: "ماسٹر ایڈمن",
    color: "red",
    bgClass: "bg-gradient-to-br from-violet-500 to-fuchsia-600",
  },
};

// ── Permissions matrix (for reference / UI display) ──────────────────
export const PERMISSIONS_MATRIX = {
  viewAllCases:     { admin: true,  operator: true,  agent: false, customer: false, master_admin: true },
  viewOwnCases:     { admin: true,  operator: true,  agent: true,  customer: true,  master_admin: true },
  createCase:       { admin: true,  operator: true,  agent: true,  customer: false, master_admin: true },
  editCaseStatus:   { admin: true,  operator: false, agent: true,  customer: false, master_admin: true },
  uploadDocuments:  { admin: true,  operator: true,  agent: true,  customer: true,  master_admin: true },
  recordPayment:    { admin: true,  operator: true,  agent: true,  customer: false, master_admin: true },
  approvePayment:   { admin: true,  operator: false, agent: false, customer: false, master_admin: true },
  viewPayHistory:   { admin: true,  operator: true,  agent: false, customer: false, master_admin: true },
  markAttendance:   { admin: true,  operator: true,  agent: true,  customer: false, master_admin: true },
  viewAttendance:   { admin: true,  operator: true,  agent: false, customer: false, master_admin: true },
  generateReports:  { admin: true,  operator: true,  agent: false, customer: false, master_admin: true },
  accessOperations: { admin: true,  operator: true,  agent: false, customer: false, master_admin: true },
  systemSettings:   { admin: true,  operator: false, agent: false, customer: false, master_admin: true },
} as const;

// ── Helper: build full path from role + nav item ─────────────────────
export function buildPath(role: PortalRole, navItem: NavItem): string {
  const prefix = role === "master_admin" ? "/master" : `/${role}`;
  return navItem.path ? `${prefix}/${navItem.path}` : prefix;
}

// ── Helper: detect role from pathname ────────────────────────────────
export function detectRoleFromPath(pathname: string): PortalRole | null {
  if (pathname.startsWith("/master")) return "master_admin";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/agent")) return "agent";
  if (pathname.startsWith("/customer")) return "customer";
  if (pathname.startsWith("/operator")) return "operator";
  return null;
}