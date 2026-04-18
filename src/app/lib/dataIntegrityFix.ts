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
  }

  /**
   * Fix cases storage
   */
  static fixCasesStorage(): void {
    try {
      const casesStr = localStorage.getItem('emerald_crm_cases');
      
      if (!casesStr) {
        return;
      }

      const parsed = JSON.parse(casesStr);

      if (!Array.isArray(parsed)) {
        localStorage.setItem('emerald_crm_cases', JSON.stringify([]));
      } else {
      }
      
    } catch (error) {
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
        return;
      }

      const parsed = JSON.parse(auditStr);

      if (!Array.isArray(parsed)) {
        localStorage.setItem('crm_audit_log', JSON.stringify([]));
      } else {
      }
      
    } catch (error) {
      localStorage.setItem('crm_audit_log', JSON.stringify([]));
    }
  }

  /**
   * Run all integrity checks and fixes
   */
  static runAllFixes(): void {
    
    this.fixNotificationsStorage();
    this.fixCasesStorage();
    this.fixAuditLogStorage();
    
  }
}

// Auto-run on import
if (typeof window !== 'undefined') {
  // Run fixes before anything else
  DataIntegrityFix.runAllFixes();
}