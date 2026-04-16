import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, X, Volume2 } from "lucide-react";
import { useVisaVerse } from "./VisaVerseContext";

const SAMPLE_RESPONSES: Record<string, { en: string; ur: string }> = {
  default: {
    en: "I can help you manage cases, check status, and more. Try asking about a specific client!",
    ur: "میں کیسز کا انتظام، اسٹیٹس چیک، اور مزید میں مدد کر سکتا ہوں۔"
  },
  next: {
    en: "Next step: Upload the medical report. Tap the documents section to start.",
    ur: "اگلا قدم: میڈیکل رپورٹ اپلوڈ کریں۔ دستاویزات پر ٹیپ کریں۔"
  },
  medical: {
    en: "Medical status: Scheduled for tomorrow at 10 AM. GAMCA Center, Lahore.",
    ur: "میڈیکل: کل صبح 10 بجے مقرر ہے۔ گامکا سینٹر، لاہور۔"
  },
  payment: {
    en: "Payment reminder sent to the client via WhatsApp. Balance: PKR 45,000.",
    ur: "ادائیگی کی یاد دہانی واٹس ایپ پر بھیج دی گئی۔ بقایا: 45,000 روپے"
  },
  status: {
    en: "3 cases at Document Collection, 2 at Medical, 1 awaiting Payment Confirmation.",
    ur: "3 کیسز دستاویزات جمع، 2 میڈیکل، 1 ادائیگی تصدیق پر۔"
  },
};

function getResponse(input: string): { en: string; ur: string } {
  const lower = input.toLowerCase();
  if (lower.includes("next") || lower.includes("اگلا")) return SAMPLE_RESPONSES.next;
  if (lower.includes("medical") || lower.includes("میڈیکل")) return SAMPLE_RESPONSES.medical;
  if (lower.includes("payment") || lower.includes("ادائیگی")) return SAMPLE_RESPONSES.payment;
  if (lower.includes("status") || lower.includes("اسٹیٹس")) return SAMPLE_RESPONSES.status;
  return SAMPLE_RESPONSES.default;
}

export function VoiceAssistant() {
  const { features, classicMode, addXP } = useVisaVerse();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [waveformValues, setWaveformValues] = useState<number[]>(Array(20).fill(0.1));
  const animFrameRef = useRef<number>();

  if (classicMode || !features.voiceAssistant) return null;

  // Animate waveform
  useEffect(() => {
    if (!isListening) {
      setWaveformValues(Array(20).fill(0.1));
      return;
    }
    const animate = () => {
      setWaveformValues(prev => prev.map(() => Math.random() * 0.7 + 0.3));
      animFrameRef.current = requestAnimationFrame(animate);
    };
    // Slower update rate
    const interval = setInterval(() => {
      animFrameRef.current = requestAnimationFrame(animate);
    }, 100);
    return () => {
      clearInterval(interval);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isListening]);

  const startListening = () => {
    setIsListening(true);
    setTranscript("");
    setResponse("");
    addXP(3);

    // Simulate speech recognition
    setTimeout(() => {
      const phrases = ["What's next for the case?", "Check medical status", "Send payment reminder", "Show case status"];
      setTranscript(phrases[Math.floor(Math.random() * phrases.length)]);
    }, 2000);

    setTimeout(() => {
      setIsListening(false);
    }, 3000);
  };

  // Generate response after transcript
  useEffect(() => {
    if (transcript && !isListening) {
      const timeout = setTimeout(() => {
        const res = getResponse(transcript);
        setResponse(res.en);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [transcript, isListening]);

  return (
    <>
      {/* Floating mic button - fixed bottom right, thumb zone */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-4 z-[150] w-14 h-14 rounded-full
            bg-gradient-to-br from-emerald-500 to-teal-600 text-white
            shadow-lg shadow-emerald-500/30 flex items-center justify-center"
        >
          <Mic className="w-6 h-6" />
        </motion.button>
      )}

      {/* Voice assistant panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed bottom-20 sm:bottom-6 right-4 z-[150]
              w-[calc(100vw-2rem)] max-w-sm
              bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
              border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Header */}
            <div className="p-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Hey Emerald!</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Voice Assistant</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 min-h-[120px]">
              {/* Waveform visualization */}
              {isListening && (
                <div className="flex items-center justify-center gap-0.5 h-12 mb-3">
                  {waveformValues.map((v, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: `${v * 100}%` }}
                      transition={{ duration: 0.1 }}
                      className="w-1.5 rounded-full bg-emerald-500"
                      style={{ minHeight: 4 }}
                    />
                  ))}
                </div>
              )}

              {/* Transcript */}
              {transcript && (
                <div className="mb-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-xs text-gray-500 mb-0.5">You said:</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{transcript}</p>
                </div>
              )}

              {/* Response */}
              {response && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/30"
                >
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-0.5">Emerald:</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{response}</p>
                </motion.div>
              )}

              {!isListening && !transcript && (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">
                  Tap the mic to ask Emerald anything
                </p>
              )}
            </div>

            {/* Quick commands */}
            <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {["What's next?", "Medical status", "Payment reminder"].map(cmd => (
                <button
                  key={cmd}
                  onClick={() => {
                    setTranscript(cmd);
                    setIsListening(false);
                    setTimeout(() => {
                      const res = getResponse(cmd);
                      setResponse(res.en);
                    }, 500);
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium
                    bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300
                    hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors
                    min-h-[32px] whitespace-nowrap"
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Mic button */}
            <div className="p-4 flex justify-center">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={isListening ? () => setIsListening(false) : startListening}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors
                  ${isListening
                    ? "bg-red-500 shadow-red-500/30"
                    : "bg-emerald-500 shadow-emerald-500/30"
                  }`}
              >
                {isListening ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
