import { create } from 'zustand';
import type { Case } from './mockData';
import { supabase } from './supabase';
import { mapSupabaseCaseToLocal } from './caseMappers';

interface CaseState {
  cases: Case[];
  isLoading: boolean;
  error: string | null;
  fetchCases: () => Promise<void>;
  addCase: (newCase: Case) => void;
  updateCase: (id: string, updates: Partial<Case>) => void;
  deleteCase: (id: string) => void;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  cases: [],
  isLoading: false,
  error: null,

  fetchCases: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mapped = data ? data.map(c => mapSupabaseCaseToLocal(c)) : [];
      set({ cases: mapped, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  addCase: (newCase) => set((state) => ({ cases: [newCase, ...state.cases] })),
  
  updateCase: (id, updates) => set((state) => ({
    cases: state.cases.map(c => c.id === id ? { ...c, ...updates } : c)
  })),
  
  deleteCase: (id) => set((state) => ({
    cases: state.cases.filter(c => c.id !== id)
  }))
}));
