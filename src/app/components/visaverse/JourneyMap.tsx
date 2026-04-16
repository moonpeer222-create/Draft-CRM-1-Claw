import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Lock, Star, Trophy, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useVisaVerse } from "./VisaVerseContext";
import type { Case } from "../../lib/mockData";
import { getStageLabel, getStageNumber, WORKFLOW_STAGES } from "../../lib/mockData";

interface JourneyMapProps {
  caseData: Case;
  isUrdu?: boolean;
}

const STAGE_ICONS = ["🏁", "📚", "📞", "🏥", "🔍", "🛡️", "💰", "📄", "📬", "✅", "💳", "✈️"];
const STAGE_TITLES = [
  "Start Quest", "Document Quest", "Selection Call", "Medical Token",
  "Medical Check", "Biometric Boss", "Payment Gate", "Documents Vault",
  "Manager Review", "Approval!", "Final Payment", "Ticket & Deploy"
];
const BADGE_NAMES = [
  "Starter", "Document Master", "Call Champion", "Medical Hero",
  "Health Guardian", "Bio Verified", "Payment Pro", "Paper Perfect",
  "Under Review", "Approved Star", "Paid Up", "Visa Hero"
];

export function JourneyMap({ caseData, isUrdu = false }: JourneyMapProps) {
  const { features, classicMode, addXP, addBadge } = useVisaVerse();
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiStage, setConfettiStage] = useState(-1);

  if (classicMode || !features.journeyMap) return null;

  const currentStage = getStageNumber(caseData.status);
  const mainStages = WORKFLOW_STAGES.filter(s => s.stageNumber >= 1 && s.stageNumber <= 12)
    .sort((a, b) => a.stageNumber - b.stageNumber);

  const handleStageClick = (stageNum: number) => {
    if (stageNum > currentStage) return;
    setExpandedStage(expandedStage === stageNum ? null : stageNum);
    if (stageNum === currentStage && confettiStage !== stageNum) {
      setShowConfetti(true);
      setConfettiStage(stageNum);
      addXP(5);
      addBadge(BADGE_NAMES[stageNum - 1] || "Explorer");
      setTimeout(() => setShowConfetti(false), 2500);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-emerald-500" />
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
          {isUrdu ? "ویزا ایڈونچر میپ" : "Visa Adventure Map"}
        </h3>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
          {currentStage}/12
        </span>
      </div>

      {/* Confetti overlay */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center"
          >
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: 0, y: 0, scale: 0, rotate: 0,
                }}
                animate={{
                  x: (Math.random() - 0.5) * 400,
                  y: (Math.random() - 0.5) * 400,
                  scale: [0, 1, 0],
                  rotate: Math.random() * 720,
                }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: ["#10B981", "#F59E0B", "#3B82F6", "#EF4444", "#8B5CF6", "#EC4899"][i % 6],
                }}
              />
            ))}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.5 }}
              className="text-5xl sm:text-6xl"
            >
              🎉
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vertical Journey Map - mobile scrollable */}
      <div className="relative space-y-0">
        {mainStages.map((stage, idx) => {
          const num = stage.stageNumber;
          const completed = num < currentStage;
          const active = num === currentStage;
          const locked = num > currentStage;
          const isExpanded = expandedStage === num;

          return (
            <motion.div
              key={num}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              {/* Connector line */}
              {idx > 0 && (
                <div className="flex items-center ml-6 sm:ml-7">
                  <div className={`w-0.5 h-4 ${
                    completed ? "bg-emerald-400" : active ? "bg-emerald-300" : "bg-gray-200 dark:bg-gray-700"
                  }`} />
                </div>
              )}

              <button
                onClick={() => handleStageClick(num)}
                disabled={locked}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all min-h-[52px]
                  ${completed ? "bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30" :
                    active ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-300/60 dark:border-emerald-700/40 shadow-sm" :
                    "bg-gray-50/50 dark:bg-gray-800/30 border border-gray-200/50 dark:border-gray-700/30 opacity-60"
                  }
                  ${!locked ? "cursor-pointer active:scale-[0.98]" : "cursor-not-allowed"}
                `}
              >
                {/* Stage icon */}
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg shrink-0
                  ${completed ? "bg-emerald-500 text-white" :
                    active ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30" :
                    "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {completed ? <Check className="w-5 h-5" /> :
                   locked ? <Lock className="w-4 h-4" /> :
                   STAGE_ICONS[idx] || "🎯"}
                </div>

                {/* Stage info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium ${
                      completed ? "text-emerald-600 dark:text-emerald-400" :
                      active ? "text-emerald-700 dark:text-emerald-300" :
                      "text-gray-400"
                    }`}>
                      Level {num}
                    </span>
                    {completed && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                        ✓ {BADGE_NAMES[idx]}
                      </span>
                    )}
                    {active && (
                      <motion.span
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                      >
                        Current
                      </motion.span>
                    )}
                  </div>
                  <div className={`text-sm font-medium truncate ${
                    locked ? "text-gray-400 dark:text-gray-600" : "text-gray-800 dark:text-gray-200"
                  }`}>
                    {STAGE_TITLES[idx] || stage.label}
                  </div>
                </div>

                {!locked && (
                  <div className="shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                )}
              </button>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && !locked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden ml-6 sm:ml-7"
                  >
                    <div className="p-3 mt-1 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/30 text-sm">
                      <p className="text-gray-600 dark:text-gray-400">
                        {isUrdu ? stage.labelUrdu : stage.label}
                      </p>
                      {completed && (
                        <div className="flex items-center gap-1.5 mt-2 text-emerald-600 dark:text-emerald-400">
                          <Trophy className="w-4 h-4" />
                          <span className="text-xs font-medium">Badge earned: {BADGE_NAMES[idx]}</span>
                        </div>
                      )}
                      {active && (
                        <div className="flex items-center gap-1.5 mt-2 text-amber-600 dark:text-amber-400">
                          <Star className="w-4 h-4" />
                          <span className="text-xs font-medium">Complete this stage to earn: {BADGE_NAMES[idx]}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span>{isUrdu ? "مجموعی پیشرفت" : "Overall Progress"}</span>
          <span>{Math.round((currentStage / 12) * 100)}%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(currentStage / 12) * 100}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
          />
        </div>
      </div>
    </div>
  );
}
