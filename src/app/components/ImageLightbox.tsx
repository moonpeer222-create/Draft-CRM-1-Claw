import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ZoomIn, ZoomOut, Download, RotateCw } from "lucide-react";
import { useState } from "react";

interface Props {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt = "Image", onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "+" || e.key === "=") setZoom(z => Math.min(z + 0.25, 3));
    if (e.key === "-") setZoom(z => Math.max(z - 0.25, 0.5));
    if (e.key === "r") setRotation(r => r + 90);
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = src ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown, src]);

  const handleDownload = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = alt || "receipt";
    a.target = "_blank";
    a.click();
  };

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Toolbar */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/70 to-transparent"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-white/80 text-sm font-medium truncate max-w-[200px]">{alt}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                onClick={() => setRotation(r => r + 90)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <button
                onClick={handleDownload}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          {/* Image */}
          <motion.img
            key={src}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            src={src}
            alt={alt}
            onClick={e => e.stopPropagation()}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl cursor-default select-none"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: "transform 0.3s ease",
            }}
            draggable={false}
          />

          {/* Zoom indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 text-white/80 text-xs font-mono">
            {Math.round(zoom * 100)}% {rotation > 0 ? `| ${rotation}°` : ""}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
