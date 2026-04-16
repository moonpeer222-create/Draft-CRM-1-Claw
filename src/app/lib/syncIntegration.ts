/**
 * Sync Integration Layer
 * 
 * Connects CRMDataStore with CloudSyncService to automatically
 * queue changes for cloud sync when data is modified locally.
 */

import { CRMDataStore, Case, Payment } from './mockData';
import { CloudSyncService } from './cloudSync';
import { AccessCodeService } from './accessCode';

/**
 * Wrapper class that adds automatic cloud sync to CRMDataStore operations
 */
export class SyncedCRMDataStore {
  
  // ============================================================
  // CASES
  // ============================================================

  static addCase(caseData: Partial<Case>, userId: string): Case {
    const newCase = CRMDataStore.addCase(caseData);
    
    // Queue for cloud sync
    CloudSyncService.queueChange(
      'case',
      newCase.id,
      'create',
      newCase,
      userId
    );
    
    return newCase;
  }

  static updateCase(caseId: string, updates: Partial<Case>, userId: string): Case | null {
    const updatedCase = CRMDataStore.updateCase(caseId, updates);
    
    if (updatedCase) {
      // Queue for cloud sync
      CloudSyncService.queueChange(
        'case',
        caseId,
        'update',
        updatedCase,
        userId
      );
    }
    
    return updatedCase;
  }

  static deleteCase(caseId: string, userId: string): boolean {
    const success = CRMDataStore.deleteCase(caseId);
    
    if (success) {
      // Queue for cloud sync
      CloudSyncService.queueChange(
        'case',
        caseId,
        'delete',
        { id: caseId },
        userId
      );
    }
    
    return success;
  }

  static updateCaseStatus(caseId: string, status: Case['status'], userId: string): Case | null {
    const updatedCase = CRMDataStore.updateCaseStatus(caseId, status);
    
    if (updatedCase) {
      CloudSyncService.queueChange(
        'case',
        caseId,
        'update',
        updatedCase,
        userId
      );
    }
    
    return updatedCase;
  }

  // ============================================================
  // PAYMENTS
  // ============================================================

  static addPayment(caseId: string, payment: Omit<Payment, 'id'>, userId: string): Case | null {
    const updatedCase = CRMDataStore.addPayment(caseId, payment);
    
    if (updatedCase) {
      CloudSyncService.queueChange(
        'payment',
        `${caseId}_payment_${Date.now()}`,
        'create',
        payment,
        userId
      );
    }
    
    return updatedCase;
  }

  static approvePayment(caseId: string, paymentId: string, userId: string): Case | null {
    const updatedCase = CRMDataStore.approvePayment(caseId, paymentId);
    
    if (updatedCase) {
      CloudSyncService.queueChange(
        'case',
        caseId,
        'update',
        updatedCase,
        userId
      );
    }
    
    return updatedCase;
  }

  static rejectPayment(caseId: string, paymentId: string, userId: string): Case | null {
    const updatedCase = CRMDataStore.rejectPayment(caseId, paymentId);
    
    if (updatedCase) {
      CloudSyncService.queueChange(
        'case',
        caseId,
        'update',
        updatedCase,
        userId
      );
    }
    
    return updatedCase;
  }

  // ============================================================
  // DOCUMENTS
  // ============================================================

  static addDocument(caseId: string, document: any, userId: string): Case | null {
    const updatedCase = CRMDataStore.addDocument(caseId, document);
    
    if (updatedCase) {
      CloudSyncService.queueChange(
        'document',
        `${caseId}_doc_${Date.now()}`,
        'create',
        document,
        userId
      );
    }
    
    return updatedCase;
  }

  static verifyDocument(caseId: string, documentId: string, verified: boolean, userId: string): Case | null {
    const updatedCase = CRMDataStore.verifyDocument(caseId, documentId, verified);
    
    if (updatedCase) {
      CloudSyncService.queueChange(
        'case',
        caseId,
        'update',
        updatedCase,
        userId
      );
    }
    
    return updatedCase;
  }

  // ============================================================
  // NOTES
  // ============================================================

  static addNote(caseId: string, note: any, userId: string): Case | null {
    const updatedCase = CRMDataStore.addNote(caseId, note);
    
    if (updatedCase) {
      CloudSyncService.queueChange(
        'case',
        caseId,
        'update',
        updatedCase,
        userId
      );
    }
    
    return updatedCase;
  }

  // ============================================================
  // AGENT ACCESS CODES
  // ============================================================

  static generateAgentCode(agentId: string): any {
    const updated = AccessCodeService.generateAgentCode(agentId);
    
    if (updated) {
      CloudSyncService.queueChange(
        'agent_code',
        agentId,
        'update',
        updated,
        'admin'
      );
    }
    
    return updated;
  }

  static generateAllAgentCodes(): any[] {
    const updated = AccessCodeService.generateAllAgentCodes();
    
    CloudSyncService.queueChange(
      'agent_code',
      'all',
      'update',
      updated,
      'admin'
    );
    
    return updated;
  }

  // ============================================================
  // READ OPERATIONS (No sync needed)
  // ============================================================

  static getCases = CRMDataStore.getCases;
  static getCase = CRMDataStore.getCase;
  static getCasesByAgent = CRMDataStore.getCasesByAgent;
  static getCasesByCustomer = CRMDataStore.getCasesByCustomer;
  static searchCases = CRMDataStore.searchCases;
  
  static getAgents = CRMDataStore.getAgents;
  static getCustomers = CRMDataStore.getCustomers;
  
  // Data management methods
  static saveCases = CRMDataStore.saveCases;
  static exportData = CRMDataStore.exportData;
  static importData = CRMDataStore.importData;
}

/**
 * Hook to use synced CRM data with automatic refresh
 */
export function useSyncedCRMData() {
  // Listen for sync updates and trigger re-renders
  // This would be used in React components
  
  return {
    // Provide access to synced data store
    store: SyncedCRMDataStore,
    
    // Sync utilities
    forceSyncNow: CloudSyncService.forceSyncNow,
    getSyncStatus: CloudSyncService.getSyncStatus,
    getSyncStats: CloudSyncService.getSyncStats,
  };
}