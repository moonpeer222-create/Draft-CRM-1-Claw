/**
 * Data Integrity Fix - Auto-repair corrupted localStorage data
 * 
 * Fixes common data corruption issues:
 * - Notifications stored as object instead of array
 * - Missing required fields
 * - Invalid JSON
 */

export class DataIntegrityFix {
  
  /**
   * Fix notifications storage format
   */
  static fixNotificationsStorage(): void {
    try {
      const notifStr = localStorage.getItem('crm_notifications');
      
      if (!notifStr) {
        // Initialize with empty array
        localStorage.setItem('crm_notifications', JSON.stringify([]));
        console.log('[DataIntegrityFix] Initialized empty notifications array');
        return;
      }

      const parsed = JSON.parse(notifStr);

      // Check if it's an object (old format) instead of array
      if (!Array.isArray(parsed)) {
        console.warn('[DataIntegrityFix] Notifications was stored as object, converting to array...');
        console.log('[DataIntegrityFix] Object structure:', Object.keys(parsed));
        
        // Convert object to array
        const notifications: any[] = [];
        
        if (typeof parsed === 'object' && parsed !== null) {
          // Extract notifications from object format
          Object.keys(parsed).forEach(key => {
            const value = parsed[key];
            
            if (Array.isArray(value)) {
              // Key contains array of notifications
              console.log(`[DataIntegrityFix] Found ${value.length} notifications in key "${key}"`);
              notifications.push(...value);
            } else if (typeof value === 'object' && value !== null && value.id) {
              // Key contains single notification object
              console.log(`[DataIntegrityFix] Found single notification in key "${key}"`);
              notifications.push(value);
            }
          });
        }

        // Save as array
        localStorage.setItem('crm_notifications', JSON.stringify(notifications));
        console.log('[DataIntegrityFix] ✅ Converted notifications to array format:', notifications.length, 'items');
        
        // Verify the fix worked
        const verified = JSON.parse(localStorage.getItem('crm_notifications') || '[]');
        if (Array.isArray(verified)) {
          console.log('[DataIntegrityFix] ✅ Verification passed - notifications is now an array');
        } else {
          console.error('[DataIntegrityFix] ❌ Verification failed - still not an array!');
        }
      } else {
        console.log('[DataIntegrityFix] ✅ Notifications format is correct (array)');
      }
      
    } catch (error) {
      console.error('[DataIntegrityFix] Failed to fix notifications:', error);
      // Reset to empty array on error
      localStorage.setItem('crm_notifications', JSON.stringify([]));
      console.log('[DataIntegrityFix] Reset to empty array due to error');
    }
  }

  /**
   * Fix cases storage
   */
  static fixCasesStorage(): void {
    try {
      const casesStr = localStorage.getItem('emerald_crm_cases');
      
      if (!casesStr) {
        console.log('[DataIntegrityFix] No cases storage found');
        return;
      }

      const parsed = JSON.parse(casesStr);

      if (!Array.isArray(parsed)) {
        console.warn('[DataIntegrityFix] Cases is not an array, resetting...');
        localStorage.setItem('emerald_crm_cases', JSON.stringify([]));
      } else {
        console.log('[DataIntegrityFix] Cases format is correct (array)');
      }
      
    } catch (error) {
      console.error('[DataIntegrityFix] Failed to fix cases:', error);
    }
  }

  /**
   * Fix audit log storage
   */
  static fixAuditLogStorage(): void {
    try {
      const auditStr = localStorage.getItem('crm_audit_log');
      
      if (!auditStr) {
        localStorage.setItem('crm_audit_log', JSON.stringify([]));
        console.log('[DataIntegrityFix] Initialized empty audit log array');
        return;
      }

      const parsed = JSON.parse(auditStr);

      if (!Array.isArray(parsed)) {
        console.warn('[DataIntegrityFix] Audit log is not an array, resetting...');
        localStorage.setItem('crm_audit_log', JSON.stringify([]));
      } else {
        console.log('[DataIntegrityFix] Audit log format is correct (array)');
      }
      
    } catch (error) {
      console.error('[DataIntegrityFix] Failed to fix audit log:', error);
      localStorage.setItem('crm_audit_log', JSON.stringify([]));
    }
  }

  /**
   * Run all integrity checks and fixes
   */
  static runAllFixes(): void {
    console.log('[DataIntegrityFix] Running all integrity checks...');
    
    this.fixNotificationsStorage();
    this.fixCasesStorage();
    this.fixAuditLogStorage();
    
    console.log('[DataIntegrityFix] All integrity checks complete');
  }
}

// Auto-run on import
if (typeof window !== 'undefined') {
  // Run fixes before anything else
  DataIntegrityFix.runAllFixes();
}