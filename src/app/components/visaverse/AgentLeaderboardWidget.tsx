import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Medal, Star, Flame, Target, Share2, X, Crown, Zap } from "lucide-react";
import { useVisaVerse } from "./VisaVerseContext";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";

interface BadgeInfo {
  id: string;
  name: string;
  nameUrdu: string;
  icon: string;
  criteria: string;
  criteriaUrdu: string;
  color: string;
}

const BADGES: BadgeInfo[] = [
  { id: "5cases", name: "5 Cases Closed", nameUrdu: "5 کیسز بند", icon: "🎯", criteria: "Close 5 cases in a month", criteriaUrdu: "ایک ماہ میں 5 کیسز بند کریں", color: "from-blue-400 to-blue-600" },
  { id: "ontime", name: "100% On-Time", nameUrdu: "100% وقت پر", icon: "⚡", criteria: "Zero overdue cases this week", criteriaUrdu: "اس ہفتے کوئی تاخیر نہیں", color: "from-amber-400 to-orange-500" },
  { id: "favorite", name: "Client Favorite", nameUrdu: "کسٹمر پسندیدہ", icon: "❤️", criteria: "95%+ satisfaction rating", criteriaUrdu: "95%+ اطمینان", color: "from-pink-400 to-rose-500" },
  { id: "streak", name: "Hot Streak", nameUrdu: "مسلسل کامیاب", icon: "🔥", criteria: "3 cases completed consecutively", criteriaUrdu: "مسلسل 3 کیسز مکمل", color: "from-red-400 to-orange-500" },
  { id: "revenue", name: "Revenue Star", nameUrdu: "آمدنی سٹار", icon: "💰", criteria: "Highest revenue this month", criteriaUrdu: "اس ماہ سب سے زیادہ آمدنی", color: "from-emerald-400 to-teal-500" },
  { id: "speed", name: "Speed Demon", nameUrdu: "تیز رفتار", icon: "🚀", criteria: "Fastest avg processing time", criteriaUrdu: "سب سے تیز عملداری", color: "from-violet-400 to-purple-500" },
];

export function AgentLeaderboardWidget({ isUrdu = false }: { isUrdu?: boolean }) {
  const { features, classicMode, addXP, addBadge, badges } = useVisaVerse();
  const [showBadgeModal, setShowBadgeModal] = useState<BadgeInfo | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockBadge, setUnlockBadge] = useState<BadgeInfo | null>(null);

  if (classicMode || !features.agentLeaderboard) return null;

  // Derive agent leaderboard from live Supabase cases
  const [cases, setCases] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('cases').select('*').then(({ data }) => {
      setCases((data || []).map(mapSupabaseCaseToLocal));
    });
  }, []);

  // Build agent map from cases
  const agentMap: Record<string, { name: string; completed: number; active: number; revenue: number; totalRating: number; ratingCount: number }> = {};
  cases.forEach(c => {
    const key = c.agentId || c.agentName;
    if (!agentMap[key]) {
      agentMap[key] = { name: c.agentName, completed: 0, active: 0, revenue: 0, totalRating: 0, ratingCount: 0 };
    }
    if (c.status === "completed") {
      agentMap[key].completed++;
    } else if (c.status !== "rejected") {
      agentMap[key].active++;
    }
    agentMap[key].revenue += c.paidAmount;
  });

  const leaderboard = Object.entries(agentMap)
    .map(([id, data]) => ({
      id,
      name: data.name,
      completed: data.completed,
      active: data.active,
      revenue: data.revenue,
      rating: data.completed > 0 ? Math.min(5, 3.5 + (data.completed / 10) * 1.5) : 3.5,
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  const handleBadgeUnlock = (badge: BadgeInfo) => {
    if (!badges.includes(badge.id)) {
      setUnlockBadge(badge);
      setShowUnlock(true);
      addBadge(badge.id);
      addXP(20);
      setTimeout(() => setShowUnlock(false), 3000);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Leaderboard */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {isUrdu ? "ٹاپ ایجنٹس اس ہفتے" : "Top Agents This Week"}
          </h3>
        </div>

        <div className="space-y-2">
          {leaderboard.map((agent, idx) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-center gap-3 p-2.5 rounded-xl min-h-[52px]
                ${idx === 0 ? "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 border border-amber-200/50 dark:border-amber-700/30" :
                  "bg-gray-50/50 dark:bg-gray-800/30 border border-gray-200/30 dark:border-gray-700/20"}`}
            >
              {/* Rank */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${idx === 0 ? "bg-amber-400 text-white" :
                  idx === 1 ? "bg-gray-400 text-white" :
                  idx === 2 ? "bg-amber-700 text-white" :
                  "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}
              >
                {idx === 0 ? <Crown className="w-4 h-4" /> : idx + 1}
              </div>

              {/* Agent info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{agent.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {agent.completed} {isUrdu ? "مکمل" : "completed"} · {agent.active} {isUrdu ? "فعال" : "active"}
                </p>
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {agent.rating.toFixed(1)} ⭐
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Medal className="w-5 h-5 text-purple-500" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {isUrdu ? "بیجز" : "Badges"}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {BADGES.map(badge => {
            const earned = badges.includes(badge.id);
            return (
              <motion.button
                key={badge.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => earned ? setShowBadgeModal(badge) : handleBadgeUnlock(badge)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl min-h-[80px] transition-all
                  ${earned
                    ? "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/10 border border-purple-200/50 dark:border-purple-700/30"
                    : "bg-gray-50 dark:bg-gray-800/30 border border-gray-200/30 dark:border-gray-700/20 opacity-60"
                  }`}
              >
                <span className="text-2xl">{badge.icon}</span>
                <span className={`text-[10px] font-medium text-center leading-tight
                  ${earned ? "text-purple-700 dark:text-purple-300" : "text-gray-400 dark:text-gray-500"}`}>
                  {isUrdu ? badge.nameUrdu : badge.name}
                </span>
                {!earned && <span className="text-[9px] text-gray-400">Tap to earn</span>}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Badge unlock celebration */}
      <AnimatePresence>
        {showUnlock && unlockBadge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-white dark:bg-gray-900 rounded-2xl p-6 sm:p-8 text-center max-w-xs w-full shadow-2xl"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-6xl mb-4"
              >
                {unlockBadge.icon}
              </motion.div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {isUrdu ? "بیج حاصل ہوا!" : "Badge Unlocked!"}
              </h3>
              <p className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">
                {isUrdu ? unlockBadge.nameUrdu : unlockBadge.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                +20 XP · {isUrdu ? unlockBadge.criteriaUrdu : unlockBadge.criteria}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUnlock(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium min-h-[44px]"
                >
                  {isUrdu ? "ٹھیک" : "OK"}
                </button>
                <button
                  onClick={() => {
                    setShowUnlock(false);
                    const text = `I earned the "${unlockBadge.name}" badge on Emerald Visa CRM! ${unlockBadge.icon}`;
                    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                    window.open(url, "_blank");
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-medium flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge detail modal */}
      <AnimatePresence>
        {showBadgeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
            onClick={() => setShowBadgeModal(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex sm:hidden justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
              </div>
              <div className="text-center">
                <span className="text-5xl mb-3 block">{showBadgeModal.icon}</span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isUrdu ? showBadgeModal.nameUrdu : showBadgeModal.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {isUrdu ? showBadgeModal.criteriaUrdu : showBadgeModal.criteria}
                </p>
                <button
                  onClick={() => setShowBadgeModal(null)}
                  className="mt-4 w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium min-h-[44px]"
                >
                  {isUrdu ? "بند کریں" : "Close"}
                </button>
              </div>
              <div className="h-4 sm:h-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}