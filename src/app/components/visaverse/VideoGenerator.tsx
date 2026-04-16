import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Video, X, Play, Send, Share2, Check, Sparkles } from "lucide-react";
import { useVisaVerse } from "./VisaVerseContext";
import { toast } from "../../lib/toast";

interface VideoGeneratorProps {
  customerName: string;
  stageName: string;
  nextStage?: string;
  isUrdu?: boolean;
}

export function VideoGenerator({ customerName, stageName, nextStage, isUrdu = false }: VideoGeneratorProps) {
  const { features, classicMode, addXP } = useVisaVerse();
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Award XP when video is generated (outside of render cycle)
  useEffect(() => {
    if (generated) {
      addXP(5);
    }
  }, [generated]);

  if (classicMode || !features.videoGenerator) return null;

  const handleGenerate = () => {
    setGenerating(true);
    setProgress(0);
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 8 + 2;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setProgress(100);
        setGenerating(false);
        setGenerated(true);
      } else {
        setProgress(currentProgress);
      }
    }, 150);
  };

  const handleSend = (method: string) => {
    toast.success(isUrdu ? `ویڈیو ${method} سے بھیج دی گئی` : `Video sent via ${method}!`);
    setShowModal(false);
  };

  const videoScript = isUrdu
    ? `السلام علیکم ${customerName}! آپ کا ${stageName} مکمل ہو گیا ہے۔ ${nextStage ? `اگلا مرحلہ: ${nextStage}` : "مبارک ہو!"}`
    : `Assalamualikum ${customerName}! Your ${stageName} is approved. ${nextStage ? `Next: ${nextStage}!` : "Congratulations!"}`;

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => { setShowModal(true); setGenerated(false); setPlaying(false); }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
          bg-gradient-to-r from-violet-500/10 to-purple-500/10
          border border-violet-300/40 dark:border-violet-700/40
          text-violet-700 dark:text-violet-300 cursor-pointer
          min-h-[44px] w-full sm:w-auto"
      >
        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
          <Video className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        </div>
        <span>{isUrdu ? "ویڈیو اپڈیٹ بھیجیں" : "Send Video Update"}</span>
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
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Mobile handle */}
              <div className="flex sm:hidden justify-center pt-3">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
              </div>

              {/* Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {isUrdu ? "AI ویڈیو جنریٹر" : "AI Video Generator"}
                  </h3>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video Preview */}
              <div className="mx-4 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-800 to-teal-900 aspect-video relative">
                {/* Branding */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  {!generated && !generating && (
                    <div className="space-y-3">
                      <div className="text-4xl">🎬</div>
                      <p className="text-white/80 text-sm">
                        {isUrdu ? "ذاتی ویڈیو تیار کریں" : "Generate personalized video"}
                      </p>
                    </div>
                  )}

                  {generating && (
                    <div className="space-y-3 w-full max-w-[200px]">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="text-4xl mx-auto w-fit"
                      >
                        ⚡
                      </motion.div>
                      <p className="text-white text-sm font-medium">
                        {isUrdu ? "ویڈیو بن رہی ہے..." : "Generating..."}
                      </p>
                      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          style={{ width: `${Math.min(progress, 100)}%` }}
                          className="h-full bg-emerald-400 rounded-full"
                        />
                      </div>
                      <p className="text-white/60 text-xs">{Math.round(Math.min(progress, 100))}%</p>
                    </div>
                  )}

                  {generated && (
                    <div className="space-y-4 w-full">
                      {/* Mock video content */}
                      <div className="flex items-center gap-3 px-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center text-2xl">
                          👋
                        </div>
                        <div className="text-left">
                          <p className="text-emerald-300 text-xs">Emerald Visa</p>
                          <p className="text-white text-sm font-medium">{customerName}</p>
                        </div>
                      </div>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-white text-sm px-4 leading-relaxed"
                      >
                        {videoScript}
                      </motion.p>

                      {/* Play button */}
                      {!playing ? (
                        <button
                          onClick={() => setPlaying(true)}
                          className="mx-auto w-12 h-12 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        </button>
                      ) : (
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 3 }}
                          className="mx-4 h-1 bg-emerald-400 rounded-full origin-left"
                          onAnimationComplete={() => setPlaying(false)}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Emerald branding watermark */}
                <div className="absolute bottom-2 right-3 text-white/30 text-[10px] font-medium">
                  Emerald Visa ✦
                </div>
              </div>

              {/* Script preview */}
              <div className="mx-4 mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400">
                <p className="text-xs font-medium text-gray-500 mb-1">{isUrdu ? "اسکرپٹ:" : "Script:"}</p>
                <p>{videoScript}</p>
              </div>

              {/* Actions */}
              <div className="p-4 space-y-2">
                {!generated ? (
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className={`w-full py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2 min-h-[48px]
                      ${generating ? "bg-gray-400" : "bg-gradient-to-r from-violet-500 to-purple-600 active:from-violet-600 active:to-purple-700"}
                    `}
                  >
                    <Sparkles className="w-4 h-4" />
                    {generating ? (isUrdu ? "بن رہی ہے..." : "Generating...") : (isUrdu ? "ویڈیو بنائیں" : "Generate Video")}
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSend("WhatsApp")}
                      className="py-3 rounded-xl font-medium text-white bg-green-600 active:bg-green-700 flex items-center justify-center gap-2 min-h-[48px]"
                    >
                      <Send className="w-4 h-4" /> WhatsApp
                    </button>
                    <button
                      onClick={() => handleSend("Email")}
                      className="py-3 rounded-xl font-medium text-white bg-blue-600 active:bg-blue-700 flex items-center justify-center gap-2 min-h-[48px]"
                    >
                      <Share2 className="w-4 h-4" /> Email
                    </button>
                  </div>
                )}
              </div>

              <div className="h-6 sm:h-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}