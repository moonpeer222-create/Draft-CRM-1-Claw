/**
 * DocumentFileStore — PRODUCTION MODE: All files go to Supabase Storage.
 * TENANT ISOLATION: All localStorage keys are scoped by tenant_id.
 * 
 * Every file uploaded is sent to Supabase Storage via server endpoints.
 * Metadata is stored in localStorage for offline access.
 * Signed URLs are used for preview and download — no mock/placeholder URLs.
 * Only PNG, JPG, and PDF files are accepted.
 */

import { documentStorageApi, documentUploadApi } from "./api";
import { getCachedTenantId, getTenantScopedKey } from "./tenantContext";

const STORAGE_KEY_BASE = "crm_document_files";
const LARGE_FILE_THRESHOLD = 500 * 1024; // 500KB

// Helper to get tenant-scoped storage key
function getStorageKey(): string {
  return getTenantScopedKey(STORAGE_KEY_BASE);
}

interface StoredFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  base64: string;         // Full base64 for small files, empty for large files
  uploadedBy: string;
  uploadedAt: string;
  tenantId?: string;      // Tenant ID for isolation
  storageRef?: string;    // If set, the file is in Supabase Storage (path)
  isCloudStored?: boolean; // True if the binary lives in Supabase Storage
}

function getAll(): Record<string, StoredFile> {
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, StoredFile>) {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
  } catch (e) {
    // If storage is full, remove oldest entries
    const entries = Object.entries(data).sort(
      ([, a], [, b]) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    );
    // Remove oldest 20%
    const removeCount = Math.max(1, Math.floor(entries.length * 0.2));
    entries.slice(0, removeCount).forEach(([key]) => delete data[key]);
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(data));
    } catch {
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
    tenantId?: string;
  }): Promise<boolean> {
    // Validate file type — only PNG, JPG, PDF
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return false;
    }

    // Get tenant ID from opts or cache
    const tenantId = opts?.tenantId || getCachedTenantId() || "default";

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const all = getAll();

        // Store metadata locally with tenant_id for isolation
        all[docId] = {
          id: docId,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          base64: "", // Production: never store base64 locally
          uploadedBy,
          uploadedAt: new Date().toISOString(),
          tenantId, // Store tenant ID for isolation
          isCloudStored: true,
          storageRef: `${tenantId}/${opts?.caseId || docId}/${docId}/${file.name}`,
        };
        saveAll(all);
        DocumentFileStore.notifySync();

        // Upload to cloud with tenant_id in metadata
        documentUploadApi.upload(docId, base64, uploadedBy, {
          caseId: opts?.caseId,
          checklistKey: opts?.checklistKey,
          uploadedByRole: opts?.uploadedByRole,
          tenantId, // Include tenant context
        }).then((res) => {
          if (res.success) {
            // Update with cloud reference
            const updated = getAll();
            if (updated[docId]) {
              updated[docId].storageRef = res.storagePath || updated[docId].storageRef;
              saveAll(updated);
            }
            resolve(true);
          } else {
            resolve(false);
          }
        });
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * PRODUCTION: FormData upload to cloud + local metadata.
   */
  async storeFileForm(docId: string, file: File, caseId: string, opts?: {
    checklistKey?: string;
    uploadedBy?: string;
    uploadedByRole?: string;
    tenantId?: string;
  }): Promise<boolean> {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return false;
    }

    // Get tenant ID from opts or cache
    const tenantId = opts?.tenantId || getCachedTenantId() || "default";

    const res = await documentUploadApi.uploadForm(file, caseId, docId, {
      ...opts,
      tenantId, // Include tenant context
    });

    if (!res.success) {
      return false;
    }

    const all = getAll();
    all[docId] = {
      id: docId,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      base64: "",
      uploadedBy: opts?.uploadedBy || "User",
      uploadedAt: new Date().toISOString(),
      tenantId, // Store tenant ID for isolation
      isCloudStored: true,
      storageRef: res.storagePath || `${tenantId}/${caseId}/${docId}/${file.name}`,
    };
    saveAll(all);
    DocumentFileStore.notifySync();
    return true;
  },

  /** Get file metadata (tenant-scoped). */
  getFile(docId: string): StoredFile | null {
    const all = getAll();
    const file = all[docId] || null;
    
    // Verify tenant ownership
    if (file && file.tenantId) {
      const currentTenant = getCachedTenantId();
      if (currentTenant && file.tenantId !== currentTenant) {
        return null; // File belongs to different tenant
      }
    }
    
    return file;
  },

  /** Get preview URL (signed cloud URL for production). */
  async getPreviewUrl(docId: string): Promise<string | null> {
    const file = this.getFile(docId);
    if (!file) return null;

    // Production: always get signed URL from cloud
    if (file.storageRef) {
      try {
        const res = await documentStorageApi.getSignedUrl(file.storageRef);
        if (res.success && res.data?.signedUrl) {
          return res.data.signedUrl;
        }
      } catch {
      }
    }

    // Fallback: base64 (should rarely happen in production)
    return file.base64 || null;
  },

  /** Get local preview URL (base64 or blob URL). */
  getPreviewUrlSync(docId: string): string | null {
    const file = this.getFile(docId);
    if (!file) return null;
    if (file.base64) return file.base64;
    return null;
  },

  /** Get cloud preview URL (signed URL from Supabase Storage). */
  async getCloudPreviewUrl(docId: string): Promise<string | null> {
    const file = this.getFile(docId);
    if (!file || !file.storageRef) return null;

    const parts = file.storageRef.split("/");
    if (parts.length < 2) return null;

    const fileName = parts[parts.length - 1];
    const docIdPath = parts.slice(0, -1).join("/");

    const res = await documentStorageApi.getSignedUrl(docIdPath, fileName);
    if (res.success && res.data?.signedUrl) {
      return res.data.signedUrl;
    }
    return null;
  },

  /** Get all files for a case (tenant-scoped). */
  getFilesForCase(caseId: string): StoredFile[] {
    const all = getAll();
    const currentTenant = getCachedTenantId();
    
    return Object.values(all).filter(f => {
      // Filter by caseId in storage path
      const matchesCase = f.storageRef?.includes(`/${caseId}/`);
      // Filter by tenant ownership
      const matchesTenant = !currentTenant || !f.tenantId || f.tenantId === currentTenant;
      return matchesCase && matchesTenant;
    });
  },

  /** Get all files (tenant-scoped). */
  getAllFiles(): StoredFile[] {
    const all = getAll();
    const currentTenant = getCachedTenantId();
    
    return Object.values(all).filter(f => {
      // Filter by tenant ownership
      return !currentTenant || !f.tenantId || f.tenantId === currentTenant;
    });
  },

  /** Delete a file. */
  async deleteFile(docId: string): Promise<boolean> {
    const file = this.getFile(docId);
    if (!file) return false;

    // Delete from cloud if cloud-stored
    if (file.isCloudStored && file.storageRef) {
      try {
        const parts = file.storageRef.split("/");
        const fileName = parts[parts.length - 1];
        const docIdPath = parts.slice(0, -1).join("/");
        await documentStorageApi.deleteFile(docIdPath, fileName);
      } catch {
      }
    }

    // Delete local metadata
    const all = getAll();
    delete all[docId];
    saveAll(all);
    DocumentFileStore.notifySync();
    return true;
  },

  /** Update file metadata. */
  updateMetadata(docId: string, updates: Partial<StoredFile>): boolean {
    const all = getAll();
    if (!all[docId]) return false;
    all[docId] = { ...all[docId], ...updates };
    saveAll(all);
    DocumentFileStore.notifySync();
    return true;
  },

  /** Clear all files (tenant-scoped). */
  clear(): void {
    localStorage.removeItem(getStorageKey());
  },

  /** Get storage stats (tenant-scoped). */
  getStats(): { count: number; totalSize: number; cloudCount: number } {
    const files = this.getAllFiles();
    return {
      count: files.length,
      totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
      cloudCount: files.filter(f => f.isCloudStored).length,
    };
  },

  /** Export files for backup (tenant-scoped). */
  export(): StoredFile[] {
    return this.getAllFiles();
  },

  /** Import files from backup (with tenant ID validation). */
  import(files: StoredFile[]): void {
    const all = getAll();
    const currentTenant = getCachedTenantId();
    
    for (const f of files) {
      // Only import files that match current tenant or have no tenant
      if (!currentTenant || !f.tenantId || f.tenantId === currentTenant) {
        // Update tenantId to current tenant if missing
        if (!f.tenantId && currentTenant) {
          f.tenantId = currentTenant;
        }
        all[f.id] = f;
      }
    }
    saveAll(all);
  },
};

// Backward compatibility aliases
export const saveDocumentFile = (docId: string, base64: string, mimeType: string) => {
  const all = getAll();
  const currentTenant = getCachedTenantId();
  
  all[docId] = {
    id: docId,
    fileName: docId,
    mimeType,
    size: base64.length,
    base64,
    uploadedBy: "system",
    uploadedAt: new Date().toISOString(),
    tenantId: currentTenant || undefined,
  };
  saveAll(all);
};

export const getDocumentFile = (docId: string): StoredFile | null => {
  return DocumentFileStore.getFile(docId);
};
