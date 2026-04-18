/**
 * TenantService — Supabase queries for SaaS multi-tenant management.
 * Used by the Super Admin (you, the platform owner) and the signup flow.
 */
import { supabase } from './supabase';

export interface Tenant {
  id: string;
  name: string;
  domain: string | null;
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  max_users: number;
  created_at: string;
  updated_at: string;
  // Joined fields (not in DB, computed on fetch)
  user_count?: number;
  case_count?: number;
  owner_email?: string;
  owner_name?: string;
}

export interface CreateTenantPayload {
  agencyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone: string;
}

export const TenantService = {
  /**
   * Create a new tenant + its first master_admin user.
   * Called from the public Agency Signup page.
   */
  async createTenant(payload: CreateTenantPayload): Promise<{ success: boolean; error?: string }> {
    // 1. Create Supabase Auth user first
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: payload.ownerEmail,
      password: payload.ownerPassword,
      options: {
        data: { full_name: payload.ownerName },
      },
    });

    if (authError || !authData.user) {
      return { success: false, error: authError?.message || 'Failed to create account' };
    }

    const userId = authData.user.id;

    // 2. Create the tenant record
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: payload.agencyName,
        status: 'trial',
        max_users: 10,
      })
      .select()
      .single();

    if (tenantError || !tenantData) {
      return { success: false, error: tenantError?.message || 'Failed to create agency' };
    }

    // 3. Create the user profile (master_admin of the new tenant)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: payload.ownerEmail,
        full_name: payload.ownerName,
        phone: payload.ownerPhone,
        role: 'master_admin',
        tenant_id: tenantData.id,
        status: 'active',
      });

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    return { success: true };
  },

  /**
   * Fetch all tenants with aggregated stats.
   * Only accessible to super_admin (enforced by RLS).
   */
  async getAllTenants(): Promise<{ tenants: Tenant[]; error?: string }> {
    const { data, error } = await supabase
      .from('tenants')
      .select(`
        *,
        profiles(id, full_name, email, role)
      `)
      .order('created_at', { ascending: false });

    if (error) return { tenants: [], error: error.message };

    const tenants: Tenant[] = (data || []).map((t: any) => {
      const owner = (t.profiles || []).find((p: any) => p.role === 'master_admin');
      return {
        ...t,
        user_count: t.profiles?.length ?? 0,
        owner_email: owner?.email ?? '—',
        owner_name: owner?.full_name ?? '—',
        profiles: undefined, // strip nested
      };
    });

    return { tenants };
  },

  /**
   * Update a tenant's status (e.g., suspend non-paying agencies).
   */
  async updateTenantStatus(
    tenantId: string,
    status: Tenant['status']
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('tenants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /**
   * Update a tenant's user limit.
   */
  async updateTenantLimits(
    tenantId: string,
    maxUsers: number
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('tenants')
      .update({ max_users: maxUsers, updated_at: new Date().toISOString() })
      .eq('id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};
