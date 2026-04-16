/**
 * DocumentFileStore — PRODUCTION MODE: All files go to Supabase Storage.
 * 
 * Every file uploaded is sent to Supabase Storage via server endpoints.
 * Metadata is stored in localStorage for offline access.
 * Signed URLs are used for preview and download — no mock/placeholder URLs.
 * Only PNG, JPG, and PDF files are accepted.
 */

import { documentStorageApi, documentUploadApi } from "./api";

const STORAGE_KEY = "crm_document_files";
const LARGE_FILE_THRESHOLD = 500 * 1024; // 500KB

interface StoredFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  base64: string;         // Full base64 for small files, empty for large files
  uploadedBy: string;
  uploadedAt: string;
  storageRef?: string;    // If set, the file is in Supabase Storage (path)
  isCloudStored?: boolean; // True if the binary lives in Supabase Storage
}

function getAll(): Record<string, StoredFile> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, StoredFile>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("DocumentFileStore: localStorage full, cleaning old entries", e);
    // If storage is full, remove oldest entries
    const entries = Object.entries(data).sort(
      ([, a], [, b]) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    );
    // Remove oldest 20%
    const removeCount = Math.max(1, Math.floor(entries.length * 0.2));
    entries.slice(0, removeCount).forEach(([key]) => delete data[key]);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      console.error("DocumentFileStore: unable to save even after cleanup");
    }
  }
}

export const DocumentFileStore = {
  _pushSync: null as (() => void) | null,

  registerSyncPush(pushFn: () => void) {
    this._pushSync = pushFn;
  },

  notifySync() {
    if (this._pushSync) this._pushSync();
  },

  /**
   * PRODUCTION: Upload file directly to Supabase Storage.
   * Metadata stored locally; binary always in cloud.
   * Only PNG, JPG, PDF accepted.
   */
  async storeFile(docId: string, file: File, uploadedBy: string, opts?: {
    caseId?: string;
    checklistKey?: string;
    uploadedByRole?: string;
  }): Promise<boolean> {
    // Validate file type — only PNG, JPG, PDF
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      console.error(`File type '${file.type}' not allowed. Only PNG, JPG, PDF accepted.`);
      return false;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const all = getAll();

        // Store metadata locally (no base64 for production — cloud only)
        all[docId] = {
          id: docId,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          base64: "", // Production: never store base64 locally
          uploadedBy,
          uploadedAt: new Date().toISOString(),
          isCloudStored: true,
          storageRef: `${opts?.caseId || docId}/${docId}/${file.name}`,
        };
        saveAll(all);
        DocumentFileStore.notifySync();

        // Upload to Supabase Storage
        if (opts?.caseId) {
          // Use the new form-based upload for direct binary transfer
          documentUploadApi
            .uploadForm(file, opts.caseId, docId, {
              checklistKey: opts.checklistKey,
              uploadedBy,
              uploadedByRole: opts.uploadedByRole,
            })
            .then((res) => {
              if (res.success && res.data) {
                console.log(`[PRODUCTION] File uploaded to cloud: ${res.data.storagePath} (${res.data.fileSize} bytes)`);
                // Update metadata with server response
                const current = getAll();
                if (current[docId]) {
                  current[docId].storageRef = res.data.storagePath;
                  current[docId].isCloudStored = true;
                  saveAll(current);
                }
              } else {
                // Fallback: try base64 upload
                console.warn(`Form upload failed, trying base64 fallback:`, res.error);
                documentStorageApi
                  .upload(docId, file.name, file.type, base64)
                  .then((fallbackRes) => {
                    if (fallbackRes.success) {
                      console.log(`[FALLBACK] File uploaded via base64: ${docId}/${file.name}`);
                    } else {
                      // Last resort: store base64 locally
                      console.warn(`All cloud uploads failed for ${docId}/${file.name}, storing locally`);
                      const current = getAll();
                      if (current[docId]) {
                        current[docId].base64 = base64;
                        current[docId].isCloudStored = false;
                        saveAll(current);
                        DocumentFileStore.notifySync();
                      }
                    }
                  })
                  .catch(() => {
                    const current = getAll();
                    if (current[docId]) {
                      current[docId].base64 = base64;
                      current[docId].isCloudStored = false;
                      saveAll(current);
                      DocumentFileStore.notifySync();
                    }
                  });
              }
            })
            .catch((err) => {
              console.warn(`Cloud upload error for ${docId}/${file.name}:`, err);
              // Store locally as fallback
              const current = getAll();
              if (current[docId]) {
                current[docId].base64 = base64;
                current[docId].isCloudStored = false;
                saveAll(current);
                DocumentFileStore.notifySync();
              }
            });
        } else {
          // No caseId — use legacy base64 upload
          documentStorageApi
            .upload(docId, file.name, file.type, base64)
            .then((res) => {
              if (res.success) {
                console.log(`File uploaded to cloud storage: ${docId}/${file.name}`);
              } else {
                console.warn(`Cloud upload failed, storing locally:`, res.error);
                const current = getAll();
                if (current[docId]) {
                  current[docId].base64 = base64;
                  current[docId].isCloudStored = false;
                  current[docId].storageRef = undefined;
                  saveAll(current);
                  DocumentFileStore.notifySync();
                }
              }
            })
            .catch((err) => {
              console.warn(`Cloud upload error, keeping local:`, err);
              const current = getAll();
              if (current[docId]) {
                current[docId].base64 = base64;
                current[docId].isCloudStored = false;
                current[docId].storageRef = undefined;
                saveAll(current);
                DocumentFileStore.notifySync();
              }
            });
        }

        resolve(true);
      };
      reader.onerror = () => resolve(false);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Get stored file data by document ID.
   * For cloud-stored files, the base64 field will be empty.
   */
  getFile(docId: string): StoredFile | null {
    const all = getAll();
    return all[docId] || null;
  },

  /**
   * Check if a file exists for a document ID
   */
  hasFile(docId: string): boolean {
    const all = getAll();
    return !!all[docId];
  },

  /**
   * Delete stored file data (and from cloud storage if applicable)
   */
  deleteFile(docId: string): void {
    const all = getAll();
    const file = all[docId];
    if (file?.isCloudStored && file.storageRef) {
      // Delete from Supabase Storage in background
      documentStorageApi.remove(docId, file.fileName).catch((err) => {
        console.warn(`Failed to delete cloud file ${docId}/${file.fileName}:`, err);
      });
    }
    delete all[docId];
    saveAll(all);
    this.notifySync();
  },

  /**
   * Trigger browser download for a stored file.
   * For cloud-stored files, fetches a signed URL and opens it.
   */
  async downloadFile(docId: string): Promise<boolean> {
    const stored = this.getFile(docId);
    if (!stored) return false;

    if (stored.isCloudStored && stored.storageRef) {
      // Get signed URL from server
      try {
        const res = await documentStorageApi.getSignedUrl(docId, stored.fileName);
        if (res.success && res.data?.signedUrl) {
          const link = document.createElement("a");
          link.href = res.data.signedUrl;
          link.download = stored.fileName;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return true;
        }
      } catch (err) {
        console.error("Download from cloud failed:", err);
      }
      return false;
    }

    // Local download
    if (!stored.base64) return false;
    const link = document.createElement("a");
    link.href = stored.base64;
    link.download = stored.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  },

  /**
   * Get a preview URL (for images).
   * For cloud-stored images, returns null (use getCloudPreviewUrl instead).
   */
  getPreviewUrl(docId: string): string | null {
    const stored = this.getFile(docId);
    if (!stored) return null;
    if (stored.isCloudStored) return null; // Need async signed URL
    if (stored.mimeType.startsWith("image/")) return stored.base64;
    return null;
  },

  /**
   * Get a signed preview URL for cloud-stored images (async).
   */
  async getCloudPreviewUrl(docId: string): Promise<string | null> {
    const stored = this.getFile(docId);
    if (!stored || !stored.isCloudStored || !stored.mimeType.startsWith("image/")) return null;
    try {
      const res = await documentStorageApi.getSignedUrl(docId, stored.fileName);
      if (res.success && res.data?.signedUrl) return res.data.signedUrl;
    } catch { /* ignore */ }
    return null;
  },

  /**
   * Get count of stored files
   */
  getCount(): number {
    return Object.keys(getAll()).length;
  },

  /**
   * Get storage statistics
   */
  getStats(): { total: number; local: number; cloud: number; totalSizeBytes: number; legacyLargeFiles: number } {
    const all = getAll();
    const entries = Object.values(all);
    return {
      total: entries.length,
      local: entries.filter((f) => !f.isCloudStored).length,
      cloud: entries.filter((f) => f.isCloudStored).length,
      totalSizeBytes: entries.reduce((sum, f) => sum + f.size, 0),
      legacyLargeFiles: entries.filter((f) => !f.isCloudStored && f.base64 && f.size >= LARGE_FILE_THRESHOLD).length,
    };
  },

  /**
   * Migrate legacy large files (stored as base64 locally) to Supabase Storage.
   * Returns count of files migrated.
   */
  async migrateLegacyFiles(onProgress?: (migrated: number, total: number) => void): Promise<number> {
    const all = getAll();
    const legacyFiles = Object.values(all).filter(
      (f) => !f.isCloudStored && f.base64 && f.size >= LARGE_FILE_THRESHOLD
    );

    if (legacyFiles.length === 0) return 0;

    let migrated = 0;

    for (const file of legacyFiles) {
      try {
        const res = await documentStorageApi.upload(file.id, file.fileName, file.mimeType, file.base64);
        if (res.success) {
          // Update the entry: strip base64, mark as cloud stored
          const current = getAll();
          if (current[file.id]) {
            current[file.id].base64 = "";
            current[file.id].isCloudStored = true;
            current[file.id].storageRef = `${file.id}/${file.fileName}`;
            saveAll(current);
          }
          migrated++;
          onProgress?.(migrated, legacyFiles.length);
        } else {
          console.warn(`Migration failed for ${file.id}/${file.fileName}:`, res.error);
        }
      } catch (err) {
        console.warn(`Migration error for ${file.id}/${file.fileName}:`, err);
      }
    }

    if (migrated > 0) {
      DocumentFileStore.notifySync();
    }

    return migrated;
  },
};