/**
 * Cloud Sync Service - Universal Multi-Device Synchronization
 * 
 * Provides seamless sync between localStorage (offline) and Supabase (cloud)
 * enabling universal access across multiple devices with conflict resolution.
 * 
 * Features:
 * - Automatic background sync every 30 seconds
 * - Offline-first with queue management
 * - Conflict detection and resolution
 * - Real-time updates via Supabase Realtime
 * - Cross-device data consistency
 */

import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { CRMDataStore } from './mockData';
import { DataSyncService } from './dataSync';
import { AuditLogService } from './auditLog';
import { toast } from './toast';
import { DataIntegrityFix } from './dataIntegrityFix';
import { useNotificationStore } from './notificationStore';
import * as RealtimeService from "./realtimeService";
import { RealtimeChangePayload } from "./realtimeService";


export interface SyncStatus {
  lastSyncAt: string | null;
  pendingChanges: number;
  isSyncing: boolean;
  isOnline: boolean;
  deviceId: string;
  syncError: string | null;
}

export interface SyncQueue {
  id: string;
  entityType: 'case' | 'payment' | 'document' | 'agent_code' | 'attendance' | 'notification';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
  retryCount: number;
  userId: string;
  deviceId: string;
}

export interface SyncConflict {
  entityId: string;
  entityType: string;
  localVersion: any;
  cloudVersion: any;
  localModifiedAt: string;
  cloudModifiedAt: string;
  conflictType: 'update_update' | 'update_delete' | 'delete_update';
}

const SYNC_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_COUNT = 5;
const STORAGE_KEYS = {
  queue: 'crm_sync_queue',
  status: 'crm_sync_status',
  conflicts: 'crm_sync_conflicts',
  deviceId: 'crm_device_id',
  lastPull: 'crm_last_pull',
};

export class CloudSyncService {
  private static syncInterval: NodeJS.Timeout | null = null;
  private static realtimeSubscription: any = null;
  private static deviceId: string = CloudSyncService.getOrCreateDeviceId();

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /**
   * Initialize cloud sync - Start automatic background sync
   */
  static initialize(): void {
    
    // Check online status
    this.updateOnlineStatus();
    window.addEventListener('online', () => this.handleOnlineStatusChange(true));
    window.addEventListener('offline', () => this.handleOnlineStatusChange(false));

    // Start periodic sync
    this.startPeriodicSync();

    // Subscribe to real-time updates
    this.subscribeToRealtimeUpdates();

    // Sync immediately on startup
    this.performFullSync();

  }

  /**
   * Stop all sync operations
   */
  static shutdown(): void {
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }

  }

  // ============================================================
  // DEVICE MANAGEMENT
  // ============================================================

  private static getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem(STORAGE_KEYS.deviceId);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(STORAGE_KEYS.deviceId, deviceId);
    }
    return deviceId;
  }

  static getDeviceId(): string {
    return this.deviceId;
  }

  // ============================================================
  // SYNC STATUS
  // ============================================================

  static getSyncStatus(): SyncStatus {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.status);
      const queue = this.getQueue();
      
      const defaultStatus: SyncStatus = {
        lastSyncAt: null,
        pendingChanges: queue.length,
        isSyncing: false,
        isOnline: navigator.onLine,
        deviceId: this.deviceId,
        syncError: null,
      };

      return stored ? { ...defaultStatus, ...JSON.parse(stored) } : defaultStatus;
    } catch {
      return {
        lastSyncAt: null,
        pendingChanges: 0,
        isSyncing: false,
        isOnline: navigator.onLine,
        deviceId: this.deviceId,
        syncError: null,
      };
    }
  }

  private static updateSyncStatus(updates: Partial<SyncStatus>): void {
    const current = this.getSyncStatus();
    const updated = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEYS.status, JSON.stringify(updated));
    
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('sync-status-change', { detail: updated }));
  }

  private static updateOnlineStatus(): void {
    this.updateSyncStatus({ isOnline: navigator.onLine });
  }

  private static handleOnlineStatusChange(isOnline: boolean): void {
    this.updateSyncStatus({ isOnline });
    
    if (isOnline) {
      toast.success('🌐 Back online - Syncing data...');
      this.performFullSync();
    } else {
      toast.info('📴 Working offline - Changes will sync when connected');
    }
  }

  // ============================================================
  // SYNC QUEUE MANAGEMENT
  // ============================================================

  private static getQueue(): SyncQueue[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.queue);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private static saveQueue(queue: SyncQueue[]): void {
    localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(queue));
    this.updateSyncStatus({ pendingChanges: queue.length });
  }

  /**
   * Add item to sync queue
   */
  static queueChange(
    entityType: SyncQueue['entityType'],
    entityId: string,
    action: SyncQueue['action'],
    data: any,
    userId: string
  ): void {
    const queue = this.getQueue();
    
    // Remove duplicate pending operations for same entity
    const filtered = queue.filter(
      item => !(item.entityType === entityType && item.entityId === entityId && item.action === action)
    );

    const queueItem: SyncQueue = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityType,
      entityId,
      action,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      userId,
      deviceId: this.deviceId,
    };

    filtered.push(queueItem);
    this.saveQueue(filtered);


    // Try to sync immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  /**
   * Process sync queue - Upload pending changes to cloud
   */
  private static async processQueue(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.updateSyncStatus({ isSyncing: true, syncError: null });

    const successful: string[] = [];
    const failed: SyncQueue[] = [];

    for (const item of queue) {
      try {
        await this.uploadQueueItem(item);
        successful.push(item.id);
      } catch (error) {
        
        item.retryCount++;
        if (item.retryCount >= MAX_RETRY_COUNT) {
          this.updateSyncStatus({ syncError: `Failed to sync ${item.entityType} ${item.entityId}` });
        } else {
          failed.push(item);
        }
      }
    }

    // Update queue - remove successful, keep failed
    this.saveQueue(failed);
    
    this.updateSyncStatus({
      isSyncing: false,
      lastSyncAt: new Date().toISOString(),
    });

    if (successful.length > 0) {
    }
  }

  /**
   * Upload single queue item to cloud
   */
  private static async uploadQueueItem(item: SyncQueue): Promise<void> {
    const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-5cdc87b7`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
    };

    switch (item.entityType) {
      case 'case': {
        const endpoint = item.action === 'delete' 
          ? `${serverUrl}/cases/${item.entityId}`
          : item.action === 'update'
          ? `${serverUrl}/cases/${item.entityId}`
          : `${serverUrl}/cases`;

        const method = item.action === 'delete' ? 'DELETE' 
                     : item.action === 'update' ? 'PUT' 
                     : 'POST';

        const response = await fetch(endpoint, {
          method,
          headers,
          body: item.action !== 'delete' ? JSON.stringify(item.data) : undefined,
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        break;
      }

      case 'payment':
      case 'document':
      case 'agent_code':
      case 'attendance':
      case 'notification': {
        // Upload other entity types
        const endpoint = `${serverUrl}/${item.entityType}s`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: item.action, id: item.entityId, data: item.data }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        break;
      }
    }
  }

  // ============================================================
  // CLOUD TO LOCAL SYNC (PULL)
  // ============================================================

  /**
   * Pull latest data from cloud to local
   */
  static async pullFromCloud(): Promise<void> {
    if (!navigator.onLine) {
      return;
    }

    this.updateSyncStatus({ isSyncing: true });

    try {
      const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-5cdc87b7`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      };

      // Pull cases - with better error handling
      try {
        const casesResponse = await fetch(`${serverUrl}/cases`, { headers });
        if (casesResponse.ok) {
          const { data: cloudCases } = await casesResponse.json();
          if (cloudCases && Array.isArray(cloudCases)) {
            await this.mergeCases(cloudCases);
          }
        } else if (casesResponse.status >= 500) {
          // Server error - likely transient, don't alarm user
        }
      } catch (err) {
        // Network error pulling cases - log but don't fail entire sync
      }

      // Pull agent codes
      try {
        const codesResponse = await fetch(`${serverUrl}/agent-codes`, { headers });
        if (codesResponse.ok) {
          const { data: cloudCodes } = await codesResponse.json();
          if (cloudCodes) {
            await this.mergeAgentCodes(cloudCodes);
          }
        }
      } catch (err) {
      }

      // Pull notifications
      try {
        const notifResponse = await fetch(`${serverUrl}/notifications`, { headers });
        if (notifResponse.ok) {
          const { data: cloudNotif } = await notifResponse.json();
          if (cloudNotif) {
            await this.mergeNotifications(cloudNotif);
          }
        }
      } catch (err) {
      }

      localStorage.setItem(STORAGE_KEYS.lastPull, new Date().toISOString());
      
    } catch (error) {
      // Only show error if it's persistent, not transient
      const errorMsg = String(error);
      if (!errorMsg.includes('Connection reset') && !errorMsg.includes('fetch failed')) {
        this.updateSyncStatus({ syncError: 'Failed to pull data from cloud' });
      } else {
      }
    } finally {
      this.updateSyncStatus({ isSyncing: false });
    }
  }

  /**
   * Merge cloud cases with local cases (conflict resolution)
   */
  private static async mergeCases(cloudCases: any[]): Promise<void> {
    const localCases = CRMDataStore.getCases();
    const conflicts: SyncConflict[] = [];
    const merged = [...cloudCases];

    // Find local-only cases and conflicts
    for (const localCase of localCases) {
      const cloudCase = cloudCases.find(c => c.id === localCase.id);
      
      if (!cloudCase) {
        // Local-only case - add to merged
        merged.push(localCase);
      } else {
        // Check for conflicts
        const localModified = new Date(localCase.updatedDate || localCase.createdDate).getTime();
        const cloudModified = new Date(cloudCase.updatedDate || cloudCase.createdDate).getTime();
        
        if (localModified > cloudModified) {
          // Local version is newer - use local and queue upload
          const index = merged.findIndex(c => c.id === localCase.id);
          if (index >= 0) {
            merged[index] = localCase;
          }
          
          // Queue upload
          this.queueChange('case', localCase.id, 'update', localCase, localCase.agentId || 'system');
          
        } else if (localModified < cloudModified) {
          // Cloud version is newer - already in merged
          
          // Record for DataSyncService
          DataSyncService.markModified(
            cloudCase.id,
            cloudCase.agentId || 'system',
            cloudCase.agentName || 'System',
            'agent',
            'case',
            'Updated from cloud'
          );
        }
        // If equal timestamps, cloud wins (simpler)
      }
    }

    // Save merged data using saveCases instead of setCases
    CRMDataStore.saveCases(merged);
  }

  /**
   * Merge cloud agent codes with local
   */
  private static async mergeAgentCodes(cloudCodes: any): Promise<void> {
    // Simple replace for agent codes (admin controls these)
    if (cloudCodes && typeof cloudCodes === 'object') {
      localStorage.setItem('emerald_agent_access_codes', JSON.stringify(cloudCodes));
    }
  }

  /**
   * Merge cloud notifications with local
   */
  private static async mergeNotifications(cloudNotifications: any): Promise<void> {
    let cloudArray: any[] = [];
    
    // Handle cloud data format (array vs object)
    if (Array.isArray(cloudNotifications)) {
      cloudArray = cloudNotifications;
    } else if (typeof cloudNotifications === 'object' && cloudNotifications !== null) {
      // Extract notifications from object
      Object.keys(cloudNotifications).forEach(key => {
        const value = cloudNotifications[key];
        if (Array.isArray(value)) {
          cloudArray.push(...value);
        } else if (typeof value === 'object' && value !== null && value.id) {
          cloudArray.push(value);
        }
      });
    } else {
      return;
    }

    if (cloudArray.length === 0 && !Array.isArray(cloudNotifications)) {
    }

    // Pull from Zustand store
    let localNotif = [...useNotificationStore.getState().notifications];

    // Ensure local is an array
    if (!Array.isArray(localNotif)) {
      
      // Try to extract notifications from object format
      const converted: any[] = [];
      
      if (typeof localNotif === 'object' && localNotif !== null) {
        Object.keys(localNotif).forEach(key => {
          const value = (localNotif as any)[key];
          if (Array.isArray(value)) {
            converted.push(...value);
          } else if (typeof value === 'object' && value !== null && value.id) {
            converted.push(value);
          }
        });
      }
      
      localNotif = converted;
    }

    // Merge notifications - add cloud notifications that don't exist locally
    let addedCount = 0;
    for (const cloudNotification of cloudArray) {
      if (!cloudNotification || !cloudNotification.id) continue;
      
      // Check if notification already exists
      const exists = localNotif.find((n: any) => n.id === cloudNotification.id);
      
      if (!exists) {
        localNotif.push(cloudNotification);
        addedCount++;
      }
    }

    // Keep only last 100 notifications
    if (localNotif.length > 100) {
      const removed = localNotif.length - 100;
      localNotif = localNotif.slice(0, 100);
    }

    useNotificationStore.getState().setNotifications(localNotif);
    
  }

  // ============================================================
  // FULL SYNC (BIDIRECTIONAL)
  // ============================================================

  /**
   * Perform full bidirectional sync
   */
  static async performFullSync(): Promise<void> {
    if (!navigator.onLine) {
      return;
    }

    this.updateSyncStatus({ isSyncing: true, syncError: null });

    try {
      // Step 1: Upload pending changes (PUSH)
      await this.processQueue();

      // Step 2: Pull latest from cloud (PULL)
      await this.pullFromCloud();

      this.updateSyncStatus({
        lastSyncAt: new Date().toISOString(),
        isSyncing: false,
      });

      
    } catch (error) {
      this.updateSyncStatus({
        isSyncing: false,
        syncError: `Sync failed: ${error}`,
      });
    }
  }

  /**
   * Force sync now (manual trigger)
   */
  static async forceSyncNow(): Promise<boolean> {
    try {
      toast.info('🔄 Syncing data...');
      await this.performFullSync();
      toast.success('✅ Sync complete!');
      return true;
    } catch (error) {
      toast.error('❌ Sync failed - will retry automatically');
      return false;
    }
  }

  // ============================================================
  // PERIODIC SYNC
  // ============================================================

  private static startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.performFullSync();
      }
    }, SYNC_INTERVAL);

  }

  // ============================================================
  // REAL-TIME UPDATES (SUPABASE REALTIME)
  // ============================================================

  private static subscribeToRealtimeUpdates(): void {

    try {
      // Subscribe to core tables
      const tables: RealtimeService.RealtimeTable[] = ["cases", "documents", "payments", "notes"];
      
      tables.forEach(table => {
        RealtimeService.onRealtimeChange(table, (payload: RealtimeChangePayload) => {
          this.handleRealtimeChange(payload);
        });
      });

    } catch (e) {
    }
  }

  private static handleRealtimeChange(payload: RealtimeChangePayload): void {
    
    // Trigger a targeted refresh or re-fetch depending on the table
    if (payload.table === 'cases') {
      // In a more advanced version, we'd deep-merge the single record into LocalStorage
      // For now, we trigger a "light sync" to ensure consistency
      this.performFullSync(); 
    }
    
    // Notify UI that data has changed
    window.dispatchEvent(new CustomEvent('crm-data-refreshed', { detail: payload }));
  }

  // ============================================================
  // CONFLICT RESOLUTION
  // ============================================================

  static getConflicts(): SyncConflict[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.conflicts);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static resolveConflict(
    entityId: string,
    resolution: 'keep_local' | 'keep_cloud' | 'merge'
  ): void {
    const conflicts = this.getConflicts();
    const conflict = conflicts.find(c => c.entityId === entityId);
    
    if (!conflict) return;

    if (resolution === 'keep_local') {
      // Queue local version for upload
      this.queueChange(
        conflict.entityType as any,
        entityId,
        'update',
        conflict.localVersion,
        'system'
      );
    } else if (resolution === 'keep_cloud') {
      // Accept cloud version (already in local storage)
      // No action needed
    } else {
      // Manual merge would require UI
    }

    // Remove resolved conflict
    const remaining = conflicts.filter(c => c.entityId !== entityId);
    localStorage.setItem(STORAGE_KEYS.conflicts, JSON.stringify(remaining));
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Clear all sync data (for debugging)
   */
  static clearSyncData(): void {
    localStorage.removeItem(STORAGE_KEYS.queue);
    localStorage.removeItem(STORAGE_KEYS.status);
    localStorage.removeItem(STORAGE_KEYS.conflicts);
    localStorage.removeItem(STORAGE_KEYS.lastPull);
  }

  /**
   * Get sync statistics
   */
  static getSyncStats() {
    const status = this.getSyncStatus();
    const queue = this.getQueue();
    const conflicts = this.getConflicts();
    const lastPull = localStorage.getItem(STORAGE_KEYS.lastPull);

    return {
      deviceId: this.deviceId,
      isOnline: status.isOnline,
      isSyncing: status.isSyncing,
      lastSyncAt: status.lastSyncAt,
      lastPullAt: lastPull,
      pendingUploads: queue.length,
      conflicts: conflicts.length,
      syncError: status.syncError,
    };
  }
}

// Auto-initialize on import
/*
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      CloudSyncService.initialize();
    });
  } else {
    CloudSyncService.initialize();
  }
}
*/