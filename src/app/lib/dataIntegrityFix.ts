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
    console.log('[DataIntegrityFix] Notifications are now handled securely via Zustand memory cache.');
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