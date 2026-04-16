/**
 * Passport Stock Tracker
 * 
 * Tracks passport locations and sends alerts for 48-hour return deadline
 */

export type PassportLocation = 
  | 'office'
  | 'imran_house'
  | 'medical'
  | 'vendor'
  | 'embassy'
  | 'customer';

export interface PassportTracking {
  id: string;
  caseId: string;
  customerName: string;
  passportNumber: string;
  currentLocation: PassportLocation;
  checkedOutAt: string;
  checkedOutBy: string;
  expectedReturnAt: string;
  actualReturnAt?: string;
  notes?: string;
  history: PassportMovement[];
}

export interface PassportMovement {
  id: string;
  from: PassportLocation;
  to: PassportLocation;
  movedAt: string;
  movedBy: string;
  notes?: string;
}

const STORAGE_KEY = 'crm_passport_tracking';
const ALERT_HOURS = 48; // Alert if passport not returned in 48 hours

export const LOCATIONS: { value: PassportLocation; label: string; labelUrdu: string; icon: string }[] = [
  { value: 'office', label: 'Office', labelUrdu: 'دفتر', icon: '🏢' },
  { value: 'imran_house', label: "Imran's House", labelUrdu: 'عمران کا گھر', icon: '🏠' },
  { value: 'medical', label: 'Medical Center', labelUrdu: 'میڈیکل سینٹر', icon: '🏥' },
  { value: 'vendor', label: 'Vendor', labelUrdu: 'وینڈر', icon: '👔' },
  { value: 'embassy', label: 'Embassy', labelUrdu: 'سفارت خانہ', icon: '🏛️' },
  { value: 'customer', label: 'With Customer', labelUrdu: 'کسٹمر کے پاس', icon: '👤' },
];

export function getLocationLabel(location: PassportLocation, urdu = false): string {
  const loc = LOCATIONS.find(l => l.value === location);
  return loc ? (urdu ? loc.labelUrdu : loc.label) : location;
}

export function getLocationIcon(location: PassportLocation): string {
  const loc = LOCATIONS.find(l => l.value === location);
  return loc ? loc.icon : '📍';
}

export class PassportTracker {
  private static _pushSync: (() => void) | null = null;

  static registerSyncPush(pushFn: () => void) {
    this._pushSync = pushFn;
  }

  private static notifySync() {
    if (this._pushSync) this._pushSync();
  }

  private static getAll(): PassportTracking[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: PassportTracking[] = stored ? JSON.parse(stored) : [];
      // Deduplicate by passportNumber (keep latest) and ensure unique IDs
      const seen = new Map<string, PassportTracking>();
      for (const t of parsed) {
        seen.set(t.passportNumber, t);
      }
      const deduped = Array.from(seen.values());
      // Fix any duplicate IDs from legacy data
      const idSet = new Set<string>();
      for (const t of deduped) {
        if (idSet.has(t.id)) {
          t.id = `PT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        }
        idSet.add(t.id);
      }
      return deduped;
    } catch {
      return [];
    }
  }

  private static save(trackings: PassportTracking[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trackings));
    this.notifySync();
  }

  /**
   * Check out passport to a location
   */
  static checkOut(data: {
    caseId: string;
    customerName: string;
    passportNumber: string;
    toLocation: PassportLocation;
    checkedOutBy: string;
    notes?: string;
  }): PassportTracking {
    const trackings = this.getAll();
    
    // Check if passport already exists
    const existingIndex = trackings.findIndex(t => t.passportNumber === data.passportNumber);
    
    const now = new Date().toISOString();
    const expectedReturn = new Date(Date.now() + ALERT_HOURS * 60 * 60 * 1000).toISOString();
    
    if (existingIndex >= 0) {
      // Update existing tracking
      const existing = trackings[existingIndex];
      const movement: PassportMovement = {
        id: `MOV-${Date.now()}`,
        from: existing.currentLocation,
        to: data.toLocation,
        movedAt: now,
        movedBy: data.checkedOutBy,
        notes: data.notes,
      };
      
      existing.currentLocation = data.toLocation;
      existing.checkedOutAt = now;
      existing.checkedOutBy = data.checkedOutBy;
      existing.expectedReturnAt = expectedReturn;
      existing.actualReturnAt = undefined;
      existing.notes = data.notes;
      existing.history.push(movement);
      
      this.save(trackings);
      return existing;
    } else {
      // Create new tracking
      const tracking: PassportTracking = {
        id: `PT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        caseId: data.caseId,
        customerName: data.customerName,
        passportNumber: data.passportNumber,
        currentLocation: data.toLocation,
        checkedOutAt: now,
        checkedOutBy: data.checkedOutBy,
        expectedReturnAt: expectedReturn,
        notes: data.notes,
        history: [{
          id: `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          from: 'office',
          to: data.toLocation,
          movedAt: now,
          movedBy: data.checkedOutBy,
          notes: 'Initial checkout',
        }],
      };
      
      trackings.push(tracking);
      this.save(trackings);
      return tracking;
    }
  }

  /**
   * Return passport to office
   */
  static returnToOffice(passportNumber: string, returnedBy: string): PassportTracking | null {
    const trackings = this.getAll();
    const index = trackings.findIndex(t => t.passportNumber === passportNumber);
    
    if (index === -1) return null;
    
    const now = new Date().toISOString();
    const tracking = trackings[index];
    
    const movement: PassportMovement = {
      id: `MOV-${Date.now()}`,
      from: tracking.currentLocation,
      to: 'office',
      movedAt: now,
      movedBy: returnedBy,
      notes: 'Returned to office',
    };
    
    tracking.currentLocation = 'office';
    tracking.actualReturnAt = now;
    tracking.history.push(movement);
    
    this.save(trackings);
    return tracking;
  }

  /**
   * Get all passports currently checked out (not at office)
   */
  static getCheckedOut(): PassportTracking[] {
    return this.getAll().filter(t => t.currentLocation !== 'office' && !t.actualReturnAt);
  }

  /**
   * Get overdue passports (checked out > 48 hours)
   */
  static getOverdue(): PassportTracking[] {
    const now = Date.now();
    return this.getCheckedOut().filter(t => {
      const expectedReturn = new Date(t.expectedReturnAt).getTime();
      return now > expectedReturn;
    });
  }

  /**
   * Get passports by location
   */
  static getByLocation(location: PassportLocation): PassportTracking[] {
    return this.getAll().filter(t => t.currentLocation === location && !t.actualReturnAt);
  }

  /**
   * Get passport by case ID
   */
  static getByCaseId(caseId: string): PassportTracking | null {
    const trackings = this.getAll();
    return trackings.find(t => t.caseId === caseId) || null;
  }

  /**
   * Get passport by passport number
   */
  static getByPassportNumber(passportNumber: string): PassportTracking | null {
    const trackings = this.getAll();
    return trackings.find(t => t.passportNumber === passportNumber) || null;
  }

  /**
   * Get hours until/since expected return
   */
  static getReturnStatus(tracking: PassportTracking): {
    isOverdue: boolean;
    hours: number;
    label: string;
  } {
    const now = Date.now();
    const expected = new Date(tracking.expectedReturnAt).getTime();
    const diffMs = expected - now;
    const hours = Math.abs(diffMs / (1000 * 60 * 60));
    
    if (diffMs <= 0) {
      return {
        isOverdue: true,
        hours,
        label: `${Math.floor(hours)}h overdue`,
      };
    } else {
      return {
        isOverdue: false,
        hours,
        label: `${Math.floor(hours)}h remaining`,
      };
    }
  }

  /**
   * Get statistics
   */
  static getStats(): {
    total: number;
    checkedOut: number;
    overdue: number;
    byLocation: Record<PassportLocation, number>;
  } {
    const all = this.getAll();
    const checkedOut = this.getCheckedOut();
    const overdue = this.getOverdue();
    
    const byLocation: Record<PassportLocation, number> = {
      office: 0,
      imran_house: 0,
      medical: 0,
      vendor: 0,
      embassy: 0,
      customer: 0,
    };
    
    checkedOut.forEach(t => {
      byLocation[t.currentLocation]++;
    });
    
    return {
      total: all.length,
      checkedOut: checkedOut.length,
      overdue: overdue.length,
      byLocation,
    };
  }

  /**
   * Delete tracking record
   */
  static delete(passportNumber: string): boolean {
    const trackings = this.getAll();
    const filtered = trackings.filter(t => t.passportNumber !== passportNumber);
    
    if (filtered.length === trackings.length) return false;
    
    this.save(filtered);
    return true;
  }

  /**
   * Update tracking notes
   */
  static updateNotes(passportNumber: string, notes: string): PassportTracking | null {
    const trackings = this.getAll();
    const index = trackings.findIndex(t => t.passportNumber === passportNumber);
    
    if (index === -1) return null;
    
    trackings[index].notes = notes;
    this.save(trackings);
    return trackings[index];
  }
}