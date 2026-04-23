/**
 * Tenant Context - Utilities for managing tenant isolation across the CRM
 * This module ensures all data is scoped to the current tenant
 */

import { supabase } from './supabase';

const CURRENT_TENANT_KEY = 'crm_current_tenant_id';
const TENANT_CACHE_KEY = 'crm_tenant_cache';

export interface TenantInfo {
  id: string;
  name: string;
  role: string;
  maxUsers: number;
}

/**
 * Get the current tenant ID from the user's session
 * This is the primary method for tenant isolation
 */
export async function getCurrentTenantId(): Promise<string | null> {
  try {
    // First check if we have a cached tenant ID
    const cached = localStorage.getItem(CURRENT_TENANT_KEY);
    if (cached) {
      // Verify it's still valid by checking session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return cached;
    }

    // Fetch from user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profile?.tenant_id) {
      localStorage.setItem(CURRENT_TENANT_KEY, profile.tenant_id);
      return profile.tenant_id;
    }

    return null;
  } catch {
    return localStorage.getItem(CURRENT_TENANT_KEY);
  }
}

/**
 * Get tenant ID synchronously from cache
 * Use this when you can't await (e.g., in syncService)
 */
export function getCachedTenantId(): string | null {
  return localStorage.getItem(CURRENT_TENANT_KEY);
}

/**
 * Set the current tenant ID (used during login)
 */
export function setCurrentTenantId(tenantId: string): void {
  localStorage.setItem(CURRENT_TENANT_KEY, tenantId);
}

/**
 * Clear the current tenant ID (used during logout)
 */
export function clearCurrentTenantId(): void {
  localStorage.removeItem(CURRENT_TENANT_KEY);
  localStorage.removeItem(TENANT_CACHE_KEY);
}

/**
 * Get a tenant-scoped localStorage key
 * This ensures offline data is isolated per tenant
 */
export function getTenantScopedKey(baseKey: string, tenantId?: string): string {
  const tid = tenantId || getCachedTenantId() || 'default';
  return `${baseKey}_${tid}`;
}

/**
 * Get all tenant-scoped keys for a given base key pattern
 * Useful for cleanup operations
 */
export function getAllTenantScopedKeys(basePattern: string): string[] {
  const keys: string[] = [];
  const tid = getCachedTenantId();
  if (tid) {
    keys.push(`${basePattern}_${tid}`);
  }
  return keys;
}

/**
 * Clear all tenant-scoped data for the current tenant
 */
export function clearTenantData(tenantId?: string): void {
  const tid = tenantId || getCachedTenantId();
  if (!tid) return;

  const keysToClear = [
    'crm_cases',
    'crm_notifications',
    'crm_alerts',
    'crm_attendance',
    'crm_leave_requests',
    'crm_audit_log',
    'crm_passport_tracking',
    'crm_document_files',
    'emerald-agent-codes',
    'emerald-code-history',
    'crm_sync_conflict_log',
    'crm_sync_conflict_history',
    'crm_pending_conflicts',
    'crm_local_entity_timestamps',
    'crm_sync_queue',
    'crm_admin_profile',
    'crm_agent_profile',
    'crm_settings',
    'crm_users_db',
  ];

  keysToClear.forEach(key => {
    localStorage.removeItem(`${key}_${tid}`);
  });
}

/**
 * Fetch full tenant info with caching
 */
export async function getTenantInfo(): Promise<TenantInfo | null> {
  try {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) return null;

    // Check cache first
    const cached = localStorage.getItem(TENANT_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.id === tenantId) return parsed;
    }

    // Fetch from database
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenant) {
      const info: TenantInfo = {
        id: tenant.id,
        name: tenant.name,
        role: tenant.status,
        maxUsers: tenant.max_users,
      };
      localStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(info));
      return info;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Add tenant_id to any object before saving
 */
export function withTenantId<T extends Record<string, any>>(
  data: T,
  tenantId?: string
): T & { tenant_id: string } {
  const tid = tenantId || getCachedTenantId() || 'default';
  return { ...data, tenant_id: tid };
}

/**
 * Create a Supabase query builder with tenant filter
 * Usage: withTenantFilter(supabase.from('cases'), 'tenant_id')
 */
export function withTenantFilter<T>(
  query: any,
  tenantId?: string
): T {
  const tid = tenantId || getCachedTenantId();
  if (tid) {
    return query.eq('tenant_id', tid);
  }
  return query;
}
