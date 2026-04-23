import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCase, updateCase, deleteCase } from '../caseApi';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  }
}));

describe('caseApi integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a case successfully', async () => {
    // Mock successful resolve
    const mockDbRow = { data: [], error: null };
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      }),
      insert: vi.fn().mockResolvedValue({ error: null })
    });

    const newCase = await createCase({ customerName: "Test Customer" });
    expect(newCase).not.toBeNull();
    expect(newCase?.customerName).toBe("Test Customer");
  });

  it('handles database errors during creation cleanly', async () => {
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      }),
      insert: vi.fn().mockResolvedValue({ error: { message: "Database err" } })
    });

    const newCase = await createCase({ customerName: "Failing Customer" });
    expect(newCase).toBeNull();
  });
});
