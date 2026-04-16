import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, ShieldCheck, Link2, Clock, User, ChevronDown } from "lucide-react";
import { useVisaVerse } from "./VisaVerseContext";
import type { TimelineEvent } from "../../lib/mockData";

interface TrustTrailProps {
  timeline: TimelineEvent[];
  isUrdu?: boolean;
  compact?: boolean;
}

function generateHash() {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function TrustTrail({ timeline, isUrdu = false, compact = false }: TrustTrailProps) {
  const { features, classicMode } = useVisaVerse();
  const [expanded, setExpanded] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (classicMode || !features.trustTrail || timeline.length === 0) return null;

  const items = expanded ? timeline : timeline.slice(0, compact ? 3 : 5);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {isUrdu ? "بلاکچین ٹرسٹ ٹریل" : "Trust Trail"}
          </h4>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {isUrdu ? "تمام اقدامات تصدیق شدہ" : "All actions verified & immutable"}
          </p>
        </div>
        <div className="ml-auto">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
            <ShieldCheck className="w-3 h-3" /> 100% Verified
          </span>
        </div>
      </div>

      {/* Chain */}
      <div className="space-y-0">
        {items.map((event, idx) => {
          const hash = generateHash();
          const isHovered = hoveredIdx === idx;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              {/* Chain link connector */}
              {idx > 0 && (
                <div className="flex items-center gap-2 ml-3.5 py-0.5">
                  <div className="w-0.5 h-3 bg-indigo-300/50 dark:bg-indigo-700/50" />
                  <Link2 className="w-3 h-3 text-indigo-300 dark:text-indigo-700" />
                </div>
              )}

              <div
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(isHovered ? null : idx)}
                className={`relative flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer min-h-[44px]
                  ${isHovered
                    ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/60 dark:border-indigo-700/40 shadow-sm"
                    : "border border-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                  }`}
              >
                {/* Block icon */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isHovered ? "bg-indigo-500 text-white" : "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{event.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{event.description}</p>

                  {/* Expanded details on hover/tap */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <User className="w-3 h-3" />
                            <span>{event.user}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(event.date).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-indigo-600 dark:text-indigo-400">
                            <Link2 className="w-3 h-3" />
                            <span>0x{hash}...{generateHash()}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Verified badge */}
                <motion.div
                  animate={isHovered ? { scale: [1, 1.2, 1] } : {}}
                  className="shrink-0"
                >
                  <ShieldCheck className={`w-4 h-4 ${isHovered ? "text-emerald-500" : "text-gray-300 dark:text-gray-600"}`} />
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Show more */}
      {timeline.length > (compact ? 3 : 5) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 p-2 rounded-xl text-xs font-medium text-indigo-600 dark:text-indigo-400
            hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-1 min-h-[36px]"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded
            ? (isUrdu ? "کم دکھائیں" : "Show less")
            : (isUrdu ? `مزید ${timeline.length - (compact ? 3 : 5)} دکھائیں` : `Show ${timeline.length - (compact ? 3 : 5)} more`)}
        </button>
      )}
    </div>
  );
}
