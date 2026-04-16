import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, X, CheckCircle, AlertTriangle, RotateCcw, Zap, Scan } from "lucide-react";
import { useVisaVerse } from "./VisaVerseContext";

interface ARScannerProps {
  onScanComplete?: (quality: "good" | "blurry" | "partial") => void;
  isUrdu?: boolean;
}

export function ARScannerButton({ onScanComplete, isUrdu = false }: ARScannerProps) {
  const { features, classicMode, addXP } = useVisaVerse();
  const [isOpen, setIsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<null | "good" | "blurry" | "partial">(null);
  const [scanProgress, setScanProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  if (classicMode || !features.arScanner) return null;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      // Camera not available - show mock overlay
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setScanResult(null);
    setScanProgress(0);
    setScanning(false);
    setTimeout(startCamera, 300);
  };

  const handleClose = () => {
    stopCamera();
    setIsOpen(false);
    setScanResult(null);
    setScanning(false);
  };

  const handleScan = () => {
    setScanning(true);
    setScanProgress(0);
    setScanResult(null);

    // Simulate scanning progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      setScanProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(interval);
        const results: ("good" | "blurry" | "partial")[] = ["good", "good", "good", "partial", "blurry"];
        const result = results[Math.floor(Math.random() * results.length)];
        setScanResult(result);
        setScanning(false);
        if (result === "good") addXP(10);
        onScanComplete?.(result);
      }
    }, 200);
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
          bg-gradient-to-r from-blue-500/10 to-indigo-500/10
          border border-blue-300/40 dark:border-blue-700/40
          text-blue-700 dark:text-blue-300 cursor-pointer
          min-h-[44px] w-full sm:w-auto"
      >
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Scan className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <span>{isUrdu ? "AR اسکین" : "AR Scan"}</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-black flex flex-col"
          >
            {/* Camera view */}
            <div className="relative flex-1 overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Mock camera background if no camera */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 -z-10 flex items-center justify-center">
                <Camera className="w-16 h-16 text-gray-600" />
              </div>

              {/* Scan overlay guides */}
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <motion.div
                  animate={scanning ? { borderColor: ["rgba(16,185,129,0.8)", "rgba(16,185,129,0.3)", "rgba(16,185,129,0.8)"] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-full max-w-xs sm:max-w-sm aspect-[3/4] border-2 border-white/50 rounded-2xl relative"
                >
                  {/* Corner markers */}
                  {["top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl",
                    "top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl",
                    "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl",
                    "bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl"
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-8 h-8 ${cls} border-emerald-400`} />
                  ))}

                  {/* Scanning line */}
                  {scanning && (
                    <motion.div
                      animate={{ y: ["0%", "100%", "0%"] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                    />
                  )}

                  {/* Center text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {!scanning && !scanResult && (
                      <p className="text-white/70 text-sm text-center px-4">
                        {isUrdu ? "دستاویز یہاں رکھیں" : "Place document here"}
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Scan progress */}
              {scanning && (
                <div className="absolute bottom-24 left-4 right-4">
                  <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <RotateCcw className="w-4 h-4 text-emerald-400" />
                      </motion.div>
                      <span className="text-white text-sm">
                        {isUrdu ? "اسکین ہو رہا ہے..." : "Scanning..."} {Math.round(scanProgress)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <motion.div
                        style={{ width: `${scanProgress}%` }}
                        className="h-full bg-emerald-400 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Scan result */}
              <AnimatePresence>
                {scanResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-24 left-4 right-4"
                  >
                    <div className={`rounded-xl p-4 backdrop-blur-sm ${
                      scanResult === "good" ? "bg-emerald-500/90" :
                      scanResult === "partial" ? "bg-amber-500/90" : "bg-red-500/90"
                    }`}>
                      <div className="flex items-center gap-3">
                        {scanResult === "good" ? (
                          <CheckCircle className="w-8 h-8 text-white" />
                        ) : (
                          <AlertTriangle className="w-8 h-8 text-white" />
                        )}
                        <div>
                          <p className="text-white font-bold">
                            {scanResult === "good" ? (isUrdu ? "بہترین اسکین! +10 XP" : "Perfect scan! +10 XP") :
                             scanResult === "partial" ? (isUrdu ? "جزوی - دوبارہ اسکین کریں" : "Partial - Retake recommended") :
                             (isUrdu ? "دھندلا - دوبارہ لیں" : "Blurry - Please retake")}
                          </p>
                          <p className="text-white/80 text-sm">
                            {scanResult === "good" ? (isUrdu ? "دستاویز واضح ہے" : "Document is clear and readable") :
                             (isUrdu ? "بہتر روشنی میں دوبارہ کوشش کریں" : "Try again in better lighting")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Top bar */}
              <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between" style={{ paddingTop: "env(safe-area-inset-top, 16px)" }}>
                <button onClick={handleClose} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <X className="w-5 h-5 text-white" />
                </button>
                <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">
                    {isUrdu ? "AR دستاویز اسکینر" : "AR Document Scanner"}
                  </span>
                </div>
                <div className="w-10" /> {/* Spacer */}
              </div>
            </div>

            {/* Bottom controls */}
            <div className="bg-black p-4 pb-8 flex items-center justify-center gap-6" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 16px), 32px)" }}>
              {scanResult && (
                <button
                  onClick={() => { setScanResult(null); setScanProgress(0); }}
                  className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <RotateCcw className="w-5 h-5 text-white" />
                </button>
              )}
              <button
                onClick={handleScan}
                disabled={scanning}
                className={`w-16 h-16 rounded-full flex items-center justify-center
                  ${scanning ? "bg-gray-500" : "bg-emerald-500 active:bg-emerald-600"}
                  shadow-lg shadow-emerald-500/30 transition-colors`}
              >
                {scanning ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <RotateCcw className="w-6 h-6 text-white" />
                  </motion.div>
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
              {scanResult === "good" && (
                <button
                  onClick={handleClose}
                  className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
