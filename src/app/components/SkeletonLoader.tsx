// Reusable Skeleton Loaders for dashboard loading states
import { useTheme } from "../lib/ThemeContext";

function Pulse({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const { darkMode } = useTheme();
  return (
    <div
      className={`relative overflow-hidden rounded-lg ${darkMode ? "bg-gray-800" : "bg-gray-100"} ${className}`}
      style={style}
    >
      <div
        className="absolute inset-0"
        style={{
          background: darkMode
            ? "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)"
            : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
          animation: "shimmer 1.8s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// Inject shimmer keyframe once
if (typeof document !== "undefined" && !document.getElementById("skeleton-shimmer")) {
  const style = document.createElement("style");
  style.id = "skeleton-shimmer";
  style.textContent = `@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`;
  document.head.appendChild(style);
}

// Stat card skeleton (used in dashboards)
export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  const { darkMode } = useTheme();
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(count, 4)} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-900/50 border-white/[0.06]" : "bg-white border-gray-100"}`}>
          <Pulse className="h-3 w-20 mb-3 rounded-md" />
          <Pulse className="h-8 w-16 mb-2 rounded-lg" />
          <Pulse className="h-2 w-24 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

// Case card skeleton
export function CaseCardSkeleton({ count = 3 }: { count?: number }) {
  const { darkMode } = useTheme();
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-2xl border p-4 ${darkMode ? "bg-gray-900/50 border-white/[0.06]" : "bg-white border-gray-100"}`}>
          <div className="flex items-center gap-3 mb-3">
            <Pulse className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Pulse className="h-4 w-32 rounded-md" />
              <Pulse className="h-3 w-48 rounded-md" />
            </div>
            <Pulse className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Pulse className="h-3 w-24 rounded-sm" />
            <Pulse className="h-3 w-16 rounded-sm" />
            <Pulse className="h-3 w-20 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  const { darkMode } = useTheme();
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className={`flex gap-3 px-4 py-3 rounded-xl ${darkMode ? "bg-gray-900/50" : "bg-gray-50"}`}>
        {Array.from({ length: cols }).map((_, i) => (
          <Pulse key={i} className="h-3 flex-1 rounded-md" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`flex gap-3 px-4 py-3 rounded-xl border ${darkMode ? "bg-gray-900/30 border-white/[0.04]" : "bg-white border-gray-50"}`}>
          {Array.from({ length: cols }).map((_, j) => (
            <Pulse key={j} className={`h-4 flex-1 rounded-md ${j === 0 ? "max-w-[100px]" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Chart/graph area skeleton
export function ChartSkeleton() {
  const { darkMode } = useTheme();
  return (
    <div className={`rounded-2xl border p-5 ${darkMode ? "bg-gray-900/50 border-white/[0.06]" : "bg-white border-gray-100"}`}>
      <div className="flex items-center justify-between mb-4">
        <Pulse className="h-4 w-32 rounded-md" />
        <Pulse className="h-6 w-24 rounded-full" />
      </div>
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 12 }).map((_, i) => (
          <Pulse key={i} className="flex-1 rounded-t-lg" style={{ height: `${20 + Math.random() * 80}%` }} />
        ))}
      </div>
      <div className="flex justify-between mt-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Pulse key={i} className="h-2 w-8 rounded-sm" />
        ))}
      </div>
    </div>
  );
}

// Full page loading skeleton
export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Pulse className="h-7 w-48 rounded-lg" />
        <div className="flex gap-2">
          <Pulse className="h-9 w-24 rounded-xl" />
          <Pulse className="h-9 w-24 rounded-xl" />
        </div>
      </div>
      <StatCardSkeleton count={4} />
      <ChartSkeleton />
      <CaseCardSkeleton count={3} />
    </div>
  );
}

// Notification skeleton
export function NotificationSkeleton({ count = 4 }: { count?: number }) {
  const { darkMode } = useTheme();
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex items-start gap-3 px-4 py-3 border-b ${darkMode ? "border-white/[0.04]" : "border-gray-50"}`}>
          <Pulse className="w-8 h-8 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-3.5 w-40 rounded-md" />
            <Pulse className="h-2.5 w-full max-w-[200px] rounded-sm" />
            <Pulse className="h-2 w-16 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Profile section skeleton
export function ProfileSkeleton() {
  const { darkMode } = useTheme();
  return (
    <div className={`rounded-2xl border p-6 ${darkMode ? "bg-gray-900/50 border-white/[0.06]" : "bg-white border-gray-100"}`}>
      <div className="flex items-center gap-4 mb-5">
        <Pulse className="w-16 h-16 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-6 w-40 rounded-lg" />
          <Pulse className="h-3 w-56 rounded-md" />
          <Pulse className="h-3 w-32 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Pulse className="h-20 rounded-xl" />
        <Pulse className="h-20 rounded-xl" />
      </div>
    </div>
  );
}
