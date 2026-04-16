import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, TrendingUp, CheckCircle, AlertCircle, FileText, DollarSign, Stethoscope, Sparkles, ChevronRight } from "lucide-react";
import { useVisaVerse } from "./VisaVerseContext";
import type { Case } from "../../lib/mockData";

interface AIVisaPredictorProps {
  caseData: Case;
  compact?: boolean;
}

function calculateProbability(c: Case) {
  let score = 40;
  const factors: { label: string; labelUrdu: string; met: boolean; impact: number }[] = [];

  // Document completeness
  const verifiedDocs = c.documents.filter(d => d.status === "verified").length;
  const totalDocs = Math.max(c.documents.length, 1);
  const docScore = Math.round((verifiedDocs / totalDocs) * 20);
  score += docScore;
  factors.push({
    label: `Document Completeness (${verifiedDocs}/${totalDocs})`,
    labelUrdu: `دستاویزات مکمل (${verifiedDocs}/${totalDocs})`,
    met: docScore >= 15,
    impact: docScore,
  });

  // Payment status
  const payPercent = c.totalFee > 0 ? (c.paidAmount / c.totalFee) : 0;
  const payScore = Math.round(payPercent * 15);
  score += payScore;
  factors.push({
    label: `Payment Status (${Math.round(payPercent * 100)}%)`,
    labelUrdu: `ادائیگی (${Math.round(payPercent * 100)}%)`,
    met: payPercent >= 0.5,
    impact: payScore,
  });

  // Medical fitness
  const medFit = c.medical?.status === "completed" && c.medical?.result === "fit";
  if (medFit) score += 15;
  factors.push({
    label: "Medical Fitness",
    labelUrdu: "طبی فٹنس",
    met: medFit,
    impact: medFit ? 15 : 0,
  });

  // Stage progress
  const stageProgress = Math.min(c.currentStage / 12, 1);
  const stageScore = Math.round(stageProgress * 10);
  score += stageScore;
  factors.push({
    label: `Stage Progress (${c.currentStage}/12)`,
    labelUrdu: `مرحلہ پیشرفت (${c.currentStage}/12)`,
    met: stageProgress >= 0.5,
    impact: stageScore,
  });

  return { score: Math.min(score, 98), factors };
}

function getSuggestions(c: Case, isUrdu: boolean) {
  const suggestions: { text: string; impact: string }[] = [];
  const unverified = c.documents.filter(d => d.status !== "verified");
  if (unverified.length > 0) {
    suggestions.push({
      text: isUrdu ? `${unverified.length} دستاویزات تصدیق کروائیں` : `Verify ${unverified.length} pending document(s)`,
      impact: "+5%",
    });
  }
  if (c.paidAmount < c.totalFee) {
    suggestions.push({
      text: isUrdu ? "باقی ادائیگی مکمل کریں" : "Complete remaining payment",
      impact: "+3%",
    });
  }
  if (!c.medical || c.medical.status !== "completed") {
    suggestions.push({
      text: isUrdu ? "میڈیکل مکمل کروائیں" : "Complete medical examination",
      impact: "+8%",
    });
  }
  if (suggestions.length === 0) {
    suggestions.push({
      text: isUrdu ? "تمام مراحل مکمل ہیں!" : "All factors are looking great!",
      impact: "✓",
    });
  }
  return suggestions;
}

export function AIVisaPredictor({ caseData, compact = false }: AIVisaPredictorProps) {
  const { features, classicMode, addXP } = useVisaVerse();
  const [showModal, setShowModal] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (classicMode || !features.aiPredictor) return null;

  const { score, factors } = calculateProbability(caseData);

  useEffect(() => {
    if (!showModal) return;
    let frame: number;
    let start = 0;
    const animate = () => {
      start += 2;
      setAnimatedScore(Math.min(start, score));
      if (start < score) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [showModal, score]);

  // Draw progress ring
  useEffect(() => {
    if (!showModal || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 12;
    const lineWidth = 10;

    ctx.clearRect(0, 0, size, size);

    // Background ring
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Progress ring
    const progress = animatedScore / 100;
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#10B981");
    gradient.addColorStop(1, "#059669");
    ctx.beginPath();
    ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
  }, [animatedScore, showModal]);

  if (compact) {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { setShowModal(true); addXP(2); }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
          bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-700 dark:text-emerald-300
          border border-emerald-300/50 dark:border-emerald-600/50 cursor-pointer min-h-[32px]"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>{score}%</span>
      </motion.button>
    );
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => { setShowModal(true); addXP(2); }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
          bg-gradient-to-r from-emerald-500/10 to-teal-500/10
          border border-emerald-300/40 dark:border-emerald-700/40
          text-emerald-700 dark:text-emerald-300 cursor-pointer
          min-h-[44px] w-full sm:w-auto"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="text-left">
          <div className="text-xs opacity-70">AI Prediction</div>
          <div className="font-bold">{score}% Approval</div>
        </div>
        <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
      </motion.button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl
                shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain"
            >
              {/* Handle bar (mobile) */}
              <div className="flex sm:hidden justify-center pt-3">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
              </div>

              {/* Header */}
              <div className="p-4 sm:p-6 pb-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI Visa Predictor</h3>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Score Ring */}
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <canvas ref={canvasRef} width={160} height={160} className="w-32 h-32 sm:w-40 sm:h-40" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl sm:text-4xl font-bold text-emerald-600 dark:text-emerald-400">{animatedScore}%</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Approval</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Factors */}
              <div className="px-4 sm:px-6 pb-2">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Analysis Factors</h4>
                <div className="space-y-2">
                  {factors.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 min-h-[44px]"
                    >
                      {f.met ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                      )}
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{f.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        f.met ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>+{f.impact}%</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Suggestions */}
              <div className="p-4 sm:p-6 pt-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Improve Chances
                </h4>
                <div className="space-y-2">
                  {getSuggestions(caseData, false).map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10 min-h-[44px]">
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{s.text}</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{s.impact}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safe area padding for mobile bottom */}
              <div className="h-6 sm:h-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
