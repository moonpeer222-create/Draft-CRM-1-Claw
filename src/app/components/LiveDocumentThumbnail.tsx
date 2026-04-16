/**
 * LiveDocumentThumbnail — Fetches real signed URLs from Supabase Storage
 * for document thumbnails. Never uses placeholder images.
 */
import { useState, useEffect } from "react";
import { FileText, Image, Loader2, Download, Eye, AlertCircle } from "lucide-react";
import { documentUploadApi } from "../lib/api";
import { DocumentFileStore } from "../lib/documentStore";

interface Props {
  docId: string;
  fileName: string;
  fileType: string;
  storagePath?: string;
  className?: string;
  darkMode?: boolean;
  onClick?: (url: string) => void;
  onDownload?: (url: string) => void;
  showActions?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LiveDocumentThumbnail({
  docId, fileName, fileType, storagePath, className = "",
  darkMode: dc = false, onClick, onDownload, showActions = true, size = "md",
}: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = fileType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  const isPdf = fileType?.includes("pdf") || /\.pdf$/i.test(fileName);

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-32 h-32",
  };

  useEffect(() => {
    let cancelled = false;
    const loadUrl = async () => {
      setLoading(true);
      setError(false);

      // 1. Try Supabase Storage signed URL
      if (storagePath || docId) {
        try {
          const path = storagePath || `${docId}/${fileName}`;
          const res = await documentUploadApi.batchSignedUrls([path]);
          if (!cancelled && res.success && res.data) {
            const url = Object.values(res.data).find(v => v !== null) as string | null;
            if (url) {
              setSignedUrl(url);
              setLoading(false);
              return;
            }
          }
        } catch { /* fall through */ }
      }

      // 2. Try local DocumentFileStore
      try {
        const localFile = DocumentFileStore.getFile(docId);
        if (!cancelled && localFile?.base64) {
          setLocalUrl(localFile.base64);
          setLoading(false);
          return;
        }
        // Try cloud preview
        if (!cancelled && localFile?.isCloudStored) {
          const cloudUrl = await DocumentFileStore.getCloudPreviewUrl(docId);
          if (!cancelled && cloudUrl) {
            setSignedUrl(cloudUrl);
            setLoading(false);
            return;
          }
        }
      } catch { /* fall through */ }

      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    };

    loadUrl();
    return () => { cancelled = true; };
  }, [docId, fileName, storagePath]);

  const displayUrl = signedUrl || localUrl;

  const handleClick = () => {
    if (displayUrl && onClick) onClick(displayUrl);
  };

  const handleDownload = () => {
    if (displayUrl && onDownload) onDownload(displayUrl);
    else if (displayUrl) {
      const a = document.createElement("a");
      a.href = displayUrl;
      a.download = fileName || "document";
      a.target = "_blank";
      a.click();
    }
  };

  if (loading) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg flex items-center justify-center ${dc ? "bg-gray-700" : "bg-gray-100"} ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !displayUrl) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg flex flex-col items-center justify-center gap-1 ${dc ? "bg-gray-700" : "bg-gray-100"} ${className}`}>
        {isPdf ? (
          <FileText className={`w-5 h-5 ${dc ? "text-red-400" : "text-red-500"}`} />
        ) : (
          <AlertCircle className={`w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
        )}
        <span className={`text-[8px] font-medium truncate max-w-full px-1 ${dc ? "text-gray-500" : "text-gray-400"}`}>
          {fileName?.substring(0, 12) || "No preview"}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative group ${sizeClasses[size]} rounded-lg overflow-hidden ${className}`}>
      {isImage ? (
        <img
          src={displayUrl}
          alt={fileName}
          className="w-full h-full object-cover cursor-pointer"
          onClick={handleClick}
          onError={() => setError(true)}
        />
      ) : isPdf ? (
        <div
          className={`w-full h-full flex flex-col items-center justify-center cursor-pointer ${dc ? "bg-red-950/30" : "bg-red-50"}`}
          onClick={handleClick}
        >
          <FileText className={`w-6 h-6 ${dc ? "text-red-400" : "text-red-500"}`} />
          <span className={`text-[8px] font-medium mt-0.5 ${dc ? "text-red-300" : "text-red-600"}`}>PDF</span>
        </div>
      ) : (
        <div
          className={`w-full h-full flex flex-col items-center justify-center cursor-pointer ${dc ? "bg-gray-700" : "bg-gray-100"}`}
          onClick={handleClick}
        >
          <FileText className={`w-6 h-6 ${dc ? "text-gray-400" : "text-gray-500"}`} />
          <span className={`text-[8px] font-medium truncate max-w-full px-1 ${dc ? "text-gray-400" : "text-gray-500"}`}>
            {fileName?.substring(0, 12)}
          </span>
        </div>
      )}

      {/* Hover actions */}
      {showActions && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
          {onClick && (
            <button onClick={handleClick} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
              <Eye className="w-3.5 h-3.5 text-white" />
            </button>
          )}
          <button onClick={handleDownload} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
            <Download className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
