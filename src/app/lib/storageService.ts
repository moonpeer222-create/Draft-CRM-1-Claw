/**
 * Supabase Storage Service — real file uploads/downloads via the server
 * Handles receipt photos, document scans, and any binary files.
 */
import { projectId, publicAnonKey } from '/utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5cdc87b7`;

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
});

export interface UploadResult {
  success: boolean;
  path?: string;
  size?: number;
  error?: string;
}

export interface SignedUrlResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

/**
 * Upload a file to Supabase Storage via the server.
 * @param docId — unique identifier prefix (e.g. case ID, payment ID)
 * @param fileName — the file name to store
 * @param file — a File object from an input element
 * @param onProgress — optional callback for UI progress (simulated)
 */
export async function uploadFile(
  docId: string,
  fileName: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  try {
    // Convert file to base64
    onProgress?.(10);
    const base64 = await fileToBase64(file);
    onProgress?.(30);

    const res = await fetch(`${BASE_URL}/storage/documents/upload`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        docId,
        fileName: sanitizeFileName(fileName),
        mimeType: file.type,
        base64Data: base64,
      }),
    });

    onProgress?.(80);
    const json = await res.json();
    onProgress?.(100);

    if (!res.ok || !json.success) {
      console.error("Storage upload failed:", json.error);
      return { success: false, error: json.error || `HTTP ${res.status}` };
    }

    return { success: true, path: json.data?.path || json.path, size: json.data?.size || json.size };
  } catch (err: any) {
    console.error("Upload error:", err);
    return { success: false, error: err?.message || "Upload failed" };
  }
}

/**
 * Upload a base64 data URL directly (e.g. from a canvas capture or existing base64).
 */
export async function uploadBase64(
  docId: string,
  fileName: string,
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<UploadResult> {
  try {
    const res = await fetch(`${BASE_URL}/storage/documents/upload`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ docId, fileName: sanitizeFileName(fileName), mimeType, base64Data }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || `HTTP ${res.status}` };
    }
    return { success: true, path: json.data?.path || json.path, size: json.data?.size || json.size };
  } catch (err: any) {
    return { success: false, error: err?.message || "Upload failed" };
  }
}

/**
 * Get a signed URL for a stored file (1-hour expiry).
 */
export async function getSignedUrl(docId: string, fileName: string): Promise<SignedUrlResult> {
  try {
    const res = await fetch(
      `${BASE_URL}/storage/documents/${encodeURIComponent(docId)}/${encodeURIComponent(sanitizeFileName(fileName))}`,
      { headers: headers() }
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || `HTTP ${res.status}` };
    }
    return { success: true, signedUrl: json.data?.signedUrl || json.signedUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to get URL" };
  }
}

/**
 * Delete a stored file.
 */
export async function deleteFile(docId: string, fileName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${BASE_URL}/storage/documents/${encodeURIComponent(docId)}/${encodeURIComponent(sanitizeFileName(fileName))}`,
      { method: "DELETE", headers: headers() }
    );
    const json = await res.json();
    return { success: json.success, error: json.error };
  } catch (err: any) {
    return { success: false, error: err?.message || "Delete failed" };
  }
}

/**
 * List files for a given doc prefix.
 */
export async function listFiles(docId: string): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    const res = await fetch(
      `${BASE_URL}/storage/documents/${encodeURIComponent(docId)}`,
      { headers: headers() }
    );
    const json = await res.json();
    return { success: json.success, files: json.data, error: json.error };
  } catch (err: any) {
    return { success: false, error: err?.message || "List failed" };
  }
}

// ── Helpers ──

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 200);
}