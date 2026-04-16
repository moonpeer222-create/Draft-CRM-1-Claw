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
    console.log('🚨 [EMERGENCY FIX] Starting emergency notification repair...');
    
    const key = 'crm_notifications';
    const raw = localStorage.getItem(key);
    
    if (!raw) {
      console.log('✅ [EMERGENCY FIX] No notifications data - creating empty array');
      localStorage.setItem(key, JSON.stringify([]));
      return;
    }

    console.log('📋 [EMERGENCY FIX] Raw data length:', raw.length);
    console.log('📋 [EMERGENCY FIX] First 200 chars:', raw.substring(0, 200));

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error('❌ [EMERGENCY FIX] Failed to parse - creating empty array');
      localStorage.setItem(key, JSON.stringify([]));
      return;
    }

    // Check if already an array
    if (Array.isArray(parsed)) {
      console.log('✅ [EMERGENCY FIX] Already an array with', parsed.length, 'items - no fix needed');
      return;
    }

    // It's an object - convert to array
    console.log('🔧 [EMERGENCY FIX] Found object format - converting to array...');
    console.log('🔧 [EMERGENCY FIX] Object keys:', Object.keys(parsed));

    const notifications: any[] = [];
    let totalExtracted = 0;

    // Extract all notifications from object
    for (const key of Object.keys(parsed)) {
      const value = parsed[key];
      
      console.log(`🔍 [EMERGENCY FIX] Processing key "${key}":`, typeof value);
      
      if (Array.isArray(value)) {
        console.log(`  ✅ Found array with ${value.length} items`);
        notifications.push(...value);
        totalExtracted += value.length;
      } else if (typeof value === 'object' && value !== null) {
        if (value.id) {
          console.log(`  ✅ Found single notification object`);
          notifications.push(value);
          totalExtracted++;
        } else {
          console.log(`  ⚠️ Found object without id - skipping`);
        }
      } else {
        console.log(`  ⚠️ Unexpected type - skipping`);
      }
    }

    console.log('✅ [EMERGENCY FIX] Extracted', totalExtracted, 'total notifications');

    // Save as array
    localStorage.setItem('crm_notifications', JSON.stringify(notifications));
    console.log('💾 [EMERGENCY FIX] Saved as array');

    // Verify
    const verify = JSON.parse(localStorage.getItem('crm_notifications') || '[]');
    if (Array.isArray(verify)) {
      console.log('✅ [EMERGENCY FIX] VERIFICATION PASSED - Now an array with', verify.length, 'items');
    } else {
      console.error('❌ [EMERGENCY FIX] VERIFICATION FAILED - Still not an array!');
    }

    console.log('🎉 [EMERGENCY FIX] Emergency repair complete!');
  }

  /**
   * Run all emergency fixes
   */
  static runAll(): void {
    console.log('🚨 ========================================');
    console.log('🚨 EMERGENCY DATA REPAIR - STARTING');
    console.log('🚨 ========================================');
    
    this.fixNotificationsNow();
    
    console.log('🚨 ========================================');
    console.log('🚨 EMERGENCY DATA REPAIR - COMPLETE');
    console.log('🚨 ========================================');
  }
}

// Auto-run ONCE on import (only if corrupted)
if (typeof window !== 'undefined') {
  const notifStr = localStorage.getItem('crm_notifications');
  if (notifStr) {
    try {
      const parsed = JSON.parse(notifStr);
      if (!Array.isArray(parsed)) {
        console.warn('⚠️ CORRUPTED NOTIFICATIONS DETECTED - Running emergency fix...');
        EmergencyDataFix.runAll();
      }
    } catch {
      console.warn('⚠️ INVALID JSON - Running emergency fix...');
      EmergencyDataFix.runAll();
    }
  }
}
