import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useVisaVerse } from "./VisaVerseContext";
import type { Case } from "../../lib/mockData";

interface DynamicThemeEffectProps {
  caseData?: Case | null;
}

type ThemeEffect = "none" | "medical-blue" | "approved-gold" | "overdue-red" | "completed-confetti";

function getThemeEffect(caseData?: Case | null): ThemeEffect {
  if (!caseData) return "none";
  if (caseData.status === "completed") return "completed-confetti";
  if (caseData.status === "approved") return "approved-gold";
  if (caseData.isOverdue) return "overdue-red";
  if (caseData.status === "check_medical" || caseData.status === "medical_token") return "medical-blue";
  return "none";
}

const EFFECT_CONFIG: Record<ThemeEffect, { gradient: string; pulse: boolean; label: string }> = {
  "none": { gradient: "", pulse: false, label: "" },
  "medical-blue": {
    gradient: "from-blue-500/5 via-transparent to-cyan-500/5",
    pulse: true,
    label: "Medical Stage",
  },
  "approved-gold": {
    gradient: "from-amber-500/8 via-transparent to-yellow-500/5",
    pulse: false,
    label: "Approved!",
  },
  "overdue-red": {
    gradient: "from-red-500/5 via-transparent to-orange-500/3",
    pulse: true,
    label: "Overdue Alert",
  },
  "completed-confetti": {
    gradient: "from-emerald-500/5 via-transparent to-teal-500/5",
    pulse: false,
    label: "Completed!",
  },
};

export function DynamicThemeEffect({ caseData }: DynamicThemeEffectProps) {
  const { features, classicMode } = useVisaVerse();
  const [prevEffect, setPrevEffect] = useState<ThemeEffect>("none");

  if (classicMode || !features.dynamicTheme) return null;

  const effect = getThemeEffect(caseData);
  const config = EFFECT_CONFIG[effect];

  if (effect === "none") return null;

  return (
    <>
      {/* Background gradient overlay - very subtle */}
      <motion.div
        key={effect}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1 }}
        className={`fixed inset-0 pointer-events-none z-[1] bg-gradient-to-br ${config.gradient}`}
      />

      {/* Pulse animation for urgent states */}
      {config.pulse && (
        <motion.div
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className={`fixed inset-0 pointer-events-none z-[1] bg-gradient-to-br ${config.gradient}`}
        />
      )}

      {/* Gold confetti for approved */}
      {effect === "approved-gold" && (
        <div className="fixed inset-0 pointer-events-none z-[2] overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                x: `${Math.random() * 100}vw`,
                y: -20,
                rotate: 0,
                opacity: 0.8,
              }}
              animate={{
                y: "110vh",
                rotate: Math.random() * 720,
                opacity: 0,
              }}
              transition={{
                duration: 4 + Math.random() * 3,
                delay: Math.random() * 5,
                repeat: Infinity,
                repeatDelay: Math.random() * 8,
              }}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                backgroundColor: ["#F59E0B", "#FBBF24", "#D97706"][i % 3],
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
