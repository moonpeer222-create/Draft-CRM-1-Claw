import { describe, it, expect } from 'vitest';
import { mapSupabaseCaseToLocal } from '../caseMappers';

describe('caseMappers', () => {
  describe('mapSupabaseCaseToLocal', () => {
    it('maps a minimal Supabase case correctly', () => {
      const raw = {
        case_number: 'CASE-001',
        status: 'new_case',
        destination_country: 'UAE',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        metadata: {},
      };
      const result = mapSupabaseCaseToLocal(raw);
      expect(result.id).toBe('CASE-001');
      expect(result.status).toBe('new_case');
      expect(result.country).toBe('UAE');
    });

    it('merges metadata fields correctly', () => {
      const raw = {
        id: 'CASE-002',
        status: 'in_progress',
        metadata: {
          customerName: 'John Doe',
          phone: '+92-300-1234567',
          fatherName: 'Mr. Doe',
          totalFee: 5000,
          paidAmount: 2500,
        },
      };
      const result = mapSupabaseCaseToLocal(raw);
      expect(result.customerName).toBe('John Doe');
      expect(result.phone).toBe('+92-300-1234567');
      expect(result.fatherName).toBe('Mr. Doe');
      expect(result.totalFee).toBe(5000);
      expect(result.paidAmount).toBe(2500);
    });

    it('uses profile as fallback for customer info', () => {
      const raw = {
        id: 'CASE-003',
        metadata: {},
      };
      const profile = {
        id: 'USER-1',
        full_name: 'Jane Smith',
        email: 'jane@example.com',
      };
      const result = mapSupabaseCaseToLocal(raw, profile);
      expect(result.customerId).toBe('USER-1');
      expect(result.customerName).toBe('Jane Smith');
      expect(result.email).toBe('jane@example.com');
    });

    it('defaults missing values correctly', () => {
      const raw = {
        id: 'CASE-004',
      };
      const result = mapSupabaseCaseToLocal(raw);
      expect(result.customerName).toBe('Customer');
      expect(result.priority).toBe('medium');
      expect(result.pipelineType).toBe('visa');
      expect(result.currentStage).toBe(1);
      expect(result.isOverdue).toBe(false);
      expect(result.documents).toEqual([]);
      expect(result.payments).toEqual([]);
      expect(result.notes).toEqual([]);
    });

    it('maps nested emergency contact correctly', () => {
      const raw = {
        id: 'CASE-005',
        metadata: {
          emergencyContact: {
            name: 'Emergency Contact',
            phone: '0300-9999999',
            relationship: 'Brother',
          },
        },
      };
      const result = mapSupabaseCaseToLocal(raw);
      expect(result.emergencyContact).toEqual({
        name: 'Emergency Contact',
        phone: '0300-9999999',
        relationship: 'Brother',
      });
    });

    it('handles document checklist mapping', () => {
      const raw = {
        id: 'CASE-006',
        metadata: {
          documentChecklist: { passport: true, photo: false },
        },
      };
      const result = mapSupabaseCaseToLocal(raw);
      expect(result.documentChecklist).toEqual({ passport: true, photo: false });
    });
  });
});
