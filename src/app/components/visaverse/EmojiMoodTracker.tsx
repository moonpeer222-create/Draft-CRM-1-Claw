import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart, X } from "lucide-react";
import { useVisaVerse } from "./VisaVerseContext";
import { toast } from "../../lib/toast";

interface EmojiMoodTrackerProps {
  stageLabel: string;
  caseId: string;
  isUrdu?: boolean;
  onFeedback?: (rating: number, caseId: string, stage: string) => void;
}

const MOODS = [
  { emoji: "😊", label: "Great", labelUrdu: "بہترین", value: 5, color: "from-emerald-400 to-green-500" },
  { emoji: "🙂", label: "Good", labelUrdu: "اچھا", value: 4, color: "from-blue-400 to-cyan-500" },
  { emoji: "😐", label: "Okay", labelUrdu: "ٹھیک", value: 3, color: "from-amber-400 to-yellow-500" },
  { emoji: "😕", label: "Not Good", labelUrdu: "اچھا نہیں", value: 2, color: "from-orange-400 to-red-400" },
  { emoji: "😞", label: "Bad", labelUrdu: "خراب", value: 1, color: "from-red-400 to-red-600" },
];

export function EmojiMoodTracker({ stageLabel, caseId, isUrdu = false, onFeedback }: EmojiMoodTrackerProps) {
  const { features, classicMode, addXP, addSatisfaction } = useVisaVerse();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (classicMode || !features.emojiTracker || dismissed) return null;

  // Check if already submitted for this stage
  const storageKey = `mood_${caseId}_${stageLabel}`;
  const alreadySubmitted = localStorage.getItem(storageKey);
  if (alreadySubmitted && !submitted) return null;

  const handleSubmit = (value: number) => {
    setSelected(value);
    setSubmitted(true);
    addXP(3);
    addSatisfaction(value);
    localStorage.setItem(storageKey, String(value));
    onFeedback?.(value, caseId, stageLabel);
    toast.success(isUrdu ? "آپ کی رائے کا شکریہ!" : "Thank you for your feedback!");
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/30 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ duration: 0.5 }}
          className="text-3xl mb-1"
        >
          {MOODS.find(m => m.value === selected)?.emoji || "✓"}
        </motion.div>
        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
          {isUrdu ? "شکریہ! +3 XP" : "Thanks! +3 XP"}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20
        border border-purple-200/50 dark:border-purple-700/30"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {isUrdu ? "آپ کا تجربہ کیسا رہا؟" : "How was your experience?"}
          </span>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 rounded-full hover:bg-white/50 dark:hover:bg-gray-700/50">
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {isUrdu ? `مرحلہ: ${stageLabel}` : `Stage: ${stageLabel}`}
      </p>

      <div className="flex items-center justify-around">
        {MOODS.map((mood) => (
          <motion.button
            key={mood.value}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSubmit(mood.value)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/60 dark:hover:bg-gray-700/40
              transition-colors cursor-pointer min-w-[48px] min-h-[48px]"
          >
            <span className="text-2xl sm:text-3xl">{mood.emoji}</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {isUrdu ? mood.labelUrdu : mood.label}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// Satisfaction meter for admin dashboard
export function SatisfactionMeter({ isUrdu = false }: { isUrdu?: boolean }) {
  const { satisfaction, classicMode, features } = useVisaVerse();
  if (classicMode || !features.emojiTracker) return null;
  if (satisfaction.length === 0) return null;

  const avg = satisfaction.reduce((a, b) => a + b, 0) / satisfaction.length;
  const percent = Math.round((avg / 5) * 100);
  const emoji = avg >= 4 ? "😊" : avg >= 3 ? "😐" : "😞";

  return (
    <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-900/20 border border-purple-200/40 dark:border-purple-700/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {isUrdu ? "کسٹمر اطمینان" : "Client Satisfaction"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {satisfaction.length} {isUrdu ? "جوابات" : "responses"}
          </p>
        </div>
        <span className="ml-auto text-lg font-bold text-purple-600 dark:text-purple-400">{percent}%</span>
      </div>
      <div className="w-full h-2 bg-purple-200/50 dark:bg-purple-800/30 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1 }}
          className="h-full bg-gradient-to-r from-purple-400 to-pink-500 rounded-full"
        />
      </div>
    </div>
  );
}
