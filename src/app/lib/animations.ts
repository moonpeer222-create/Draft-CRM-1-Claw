// ============================================================
// Core Animation Library — Mobile-First, RTL-Aware, Performance-Optimized
// ============================================================

// Detect reduced motion preference
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

// Duration scale — shorter on mobile for snappier feel
const d = (ms: number) => (prefersReducedMotion ? 0 : ms);
const ease = [0.16, 1, 0.3, 1] as const;

// ---- Page-Level Transitions ----

export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: d(0.35), ease },
  },
  exit: { opacity: 0, y: -8, transition: { duration: d(0.2) } },
};

export const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: d(0.3), ease },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
  transition: { duration: d(0.2), ease },
};

// ---- Directional Slides (RTL-aware) ----

export const slideIn = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 16 },
  transition: { duration: d(0.3), ease },
};

export const slideFromLeft = {
  initial: { opacity: 0, x: -32 },
  animate: { opacity: 1, x: 0, transition: { duration: d(0.35), ease } },
  exit: { opacity: 0, x: -32, transition: { duration: d(0.2) } },
};

export const slideFromRight = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: { duration: d(0.35), ease } },
  exit: { opacity: 0, x: 32, transition: { duration: d(0.2) } },
};

export const slideFromBottom = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: d(0.35), ease } },
  exit: { opacity: 0, y: 32, transition: { duration: d(0.2) } },
};

// ---- Header ----

export const headerDrop = {
  initial: { opacity: 0, y: -24 },
  animate: { opacity: 1, y: 0, transition: { duration: d(0.4), ease } },
};

// ---- Stagger Containers ----

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: d(0.35), ease },
  },
};

// Stat card grid — faster stagger for dashboards
export const statCardContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const statCardItem = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: d(0.4), ease },
  },
};

// ---- Modal / Overlay ----

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: d(0.25), ease },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 16,
    transition: { duration: d(0.15), ease: "easeIn" },
  },
};

export const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: d(0.15) } },
  exit: { opacity: 0, transition: { duration: d(0.1) } },
};

// ---- Interactive Elements ----

// Use these on motion elements — touch-optimized (no hover scale on mobile)
export const tapScale = { whileTap: { scale: 0.96 } };

export const cardHover = {
  rest: { y: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  hover: {
    y: -4,
    boxShadow: "0 12px 32px rgba(0,0,0,0.1)",
    transition: { duration: d(0.25), ease: "easeOut" },
  },
};

// ---- Navigation ----

export const navItemVariants = {
  rest: { x: 0, backgroundColor: "transparent" },
  hover: { x: 3, transition: { duration: d(0.15) } },
  active: { x: 0 },
};

// ---- Table / List Rows ----

export const tableRowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: d(0.25) },
  }),
};

// ---- Decorative / Status ----

export const pulseGlow = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(16, 185, 129, 0.4)",
      "0 0 0 6px rgba(16, 185, 129, 0)",
    ],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeOut" },
  },
};

export const numberPop = {
  initial: { scale: 0.6, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
};

export const floating = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
};

export const shimmer = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: { duration: 1.5, repeat: Infinity, ease: "linear" },
  },
};

// ---- Mobile-First Tab Transition ----

export const tabContent = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: d(0.25), ease } },
  exit: { opacity: 0, y: -8, transition: { duration: d(0.15) } },
};

// ---- Expandable / Collapsible ----

export const expandCollapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1, transition: { duration: d(0.25), ease } },
  exit: { height: 0, opacity: 0, transition: { duration: d(0.15) } },
};

// ---- RTL-aware slide (flips direction in RTL) ----

export function rtlSlide(isRtl: boolean) {
  const dir = isRtl ? 1 : -1;
  return {
    initial: { opacity: 0, x: dir * 20 },
    animate: { opacity: 1, x: 0, transition: { duration: d(0.3), ease } },
    exit: { opacity: 0, x: dir * -20, transition: { duration: d(0.2) } },
  };
}
