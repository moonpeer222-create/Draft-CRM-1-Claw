/**
 * EMERGENCY DATA FIX
 * 
 * This file performs a one-time emergency fix to convert notifications
 * from object format to array format. Run this ONCE to fix corrupted data.
 */

export class EmergencyDataFix {
  
  /**
   * Emergency fix for notifications - Force conversion to array
   */
  static fixNotificationsNow(): void {
    
    const key = 'crm_notifications';
    const raw = localStorage.getItem(key);
    
    if (!raw) {
      localStorage.setItem(key, JSON.stringify([]));
      return;
    }


    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      localStorage.setItem(key, JSON.stringify([]));
      return;
    }

    // Check if already an array
    if (Array.isArray(parsed)) {
      return;
    }

    // It's an object - convert to array

    const notifications: any[] = [];
    let totalExtracted = 0;

    // Extract all notifications from object
    for (const key of Object.keys(parsed)) {
      const value = parsed[key];
      
      
      if (Array.isArray(value)) {
        notifications.push(...value);
        totalExtracted += value.length;
      } else if (typeof value === 'object' && value !== null) {
        if (value.id) {
          notifications.push(value);
          totalExtracted++;
        } else {
        }
      } else {
      }
    }


    // Save as array
    localStorage.setItem('crm_notifications', JSON.stringify(notifications));

    // Verify
    const verify = JSON.parse(localStorage.getItem('crm_notifications') || '[]');
    if (Array.isArray(verify)) {
    } else {
    }

  }

  /**
   * Run all emergency fixes
   */
  static runAll(): void {
    
    this.fixNotificationsNow();
    
  }
}

// Auto-run ONCE on import (only if corrupted)
if (typeof window !== 'undefined') {
  const notifStr = localStorage.getItem('crm_notifications');
  if (notifStr) {
    try {
      const parsed = JSON.parse(notifStr);
      if (!Array.isArray(parsed)) {
        EmergencyDataFix.runAll();
      }
    } catch {
      EmergencyDataFix.runAll();
    }
  }
}
