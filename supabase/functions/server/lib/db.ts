/**
 * PostgreSQL Database Interface for CRM System
 * Replaces KV store with proper relational tables
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Database client singleton
let _dbClient: SupabaseClient | null = null;

export function getDbClient(): SupabaseClient {
  if (!_dbClient) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    _dbClient = createClient(url, key);
  }
  return _dbClient;
}

// Reset client (useful for testing)
export function resetDbClient(): void {
  _dbClient = null;
}

// Raw SQL query helper with parameterized queries
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const client = getDbClient();
  const { data, error } = await client.rpc('exec_sql', { sql, params });
  if (error) throw error;
  return data || [];
}

// ============ USERS ============
export const users = {
  async create(userData: {
    email: string;
    password_hash: string;
    full_name: string;
    role: string;
    status?: string;
    phone?: string;
    avatar_url?: string;
    department?: string;
    employee_id?: string;
    tenant_id?: string;
    metadata?: Record<string, any>;
  }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('users')
      .insert({ ...userData, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async findById(id: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findByEmail(email: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .ilike('email', email)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findAll(options?: { 
    role?: string; 
    status?: string; 
    tenant_id?: string;
    limit?: number;
    offset?: number;
  }) {
    const client = getDbClient();
    let query = client.from('users').select('*');
    
    if (options?.role) query = query.eq('role', options.role);
    if (options?.status) query = query.eq('status', options.status);
    if (options?.tenant_id) query = query.eq('tenant_id', options.tenant_id);
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async update(id: string, updates: Record<string, any>) {
    const client = getDbClient();
    const { data, error } = await client
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLastLogin(id: string) {
    return this.update(id, { last_login: new Date().toISOString() });
  },

  async delete(id: string) {
    const client = getDbClient();
    const { error } = await client.from('users').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async count(options?: { role?: string; status?: string; tenant_id?: string }) {
    const client = getDbClient();
    let query = client.from('users').select('*', { count: 'exact', head: true });
    
    if (options?.role) query = query.eq('role', options.role);
    if (options?.status) query = query.eq('status', options.status);
    if (options?.tenant_id) query = query.eq('tenant_id', options.tenant_id);
    
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }
};

// ============ CASES ============
export const cases = {
  async create(caseData: Record<string, any>) {
    const client = getDbClient();
    const { data, error } = await client
      .from('cases')
      .insert({ 
        ...caseData, 
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getAll(options?: {
    tenant_id?: string;
    agent_id?: string;
    status?: string;
    country?: string;
    flagged?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: string;
    order?: 'asc' | 'desc';
  }) {
    const client = getDbClient();
    let query = client.from('cases').select('*');
    
    if (options?.tenant_id) query = query.eq('tenant_id', options.tenant_id);
    if (options?.agent_id) query = query.eq('agent_id', options.agent_id);
    if (options?.status) query = query.eq('status', options.status);
    if (options?.country) query = query.eq('country', options.country);
    if (options?.flagged !== undefined) query = query.eq('flagged', options.flagged);
    
    const orderColumn = options?.orderBy || 'created_at';
    const orderDirection = options?.order || 'desc';
    query = query.order(orderColumn, { ascending: orderDirection === 'asc' });
    
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset !== undefined) {
      const limit = options.limit || 50;
      query = query.range(options.offset, options.offset + limit - 1);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async update(id: string, updates: Record<string, any>) {
    const client = getDbClient();
    const { data, error } = await client
      .from('cases')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const client = getDbClient();
    const { error } = await client.from('cases').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async upsert(cases: Record<string, any>[], onConflict: string = 'id') {
    const client = getDbClient();
    const { data, error } = await client
      .from('cases')
      .upsert(cases, { onConflict })
      .select();
    if (error) throw error;
    return data || [];
  },

  async search(query: string, options?: { tenant_id?: string; limit?: number }) {
    const client = getDbClient();
    let dbQuery = client
      .from('cases')
      .select('*')
      .or(`customer_name.ilike.%${query}%,passport_number.ilike.%${query}%,case_number.ilike.%${query}%,email.ilike.%${query}%`);
    
    if (options?.tenant_id) dbQuery = dbQuery.eq('tenant_id', options.tenant_id);
    if (options?.limit) dbQuery = dbQuery.limit(options.limit);
    
    const { data, error } = await dbQuery;
    if (error) throw error;
    return data || [];
  },

  async count(options?: { tenant_id?: string; status?: string; agent_id?: string }) {
    const client = getDbClient();
    let query = client.from('cases').select('*', { count: 'exact', head: true });
    
    if (options?.tenant_id) query = query.eq('tenant_id', options.tenant_id);
    if (options?.status) query = query.eq('status', options.status);
    if (options?.agent_id) query = query.eq('agent_id', options.agent_id);
    
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  async getOverdue(tenant_id?: string) {
    const client = getDbClient();
    let query = client
      .from('cases')
      .select('*')
      .eq('is_overdue', true)
      .not('status', 'in', '(completed,cancelled)');
    
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};

// ============ SESSIONS ============
export const sessions = {
  async create(sessionData: {
    token: string;
    user_id: string;
    full_name: string;
    email: string;
    role: string;
    expires_at: string;
    ip_address?: string;
    user_agent?: string;
  }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('sessions')
      .insert({
        ...sessionData,
        created_at: new Date().toISOString(),
        is_valid: true
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async findByToken(token: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('sessions')
      .select('*')
      .eq('token', token)
      .eq('is_valid', true)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findValidByToken(token: string) {
    const session = await this.findByToken(token);
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) return null;
    return session;
  },

  async invalidate(token: string) {
    const client = getDbClient();
    const { error } = await client
      .from('sessions')
      .update({ is_valid: false })
      .eq('token', token);
    if (error) throw error;
    return true;
  },

  async delete(token: string) {
    const client = getDbClient();
    const { error } = await client.from('sessions').delete().eq('token', token);
    if (error) throw error;
    return true;
  },

  async deleteByUser(userId: string) {
    const client = getDbClient();
    const { error } = await client.from('sessions').delete().eq('user_id', userId);
    if (error) throw error;
    return true;
  },

  async deleteExpired() {
    const client = getDbClient();
    const { error } = await client
      .from('sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());
    if (error) throw error;
    return true;
  },

  async getActiveSessions(userId: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString());
    if (error) throw error;
    return data || [];
  }
};

// ============ AGENT CODES ============
export const agentCodes = {
  async create(codeData: {
    code: string;
    agent_id?: string;
    agent_name?: string;
    description?: string;
    max_uses?: number;
    expires_at?: string;
    created_by?: string;
    tenant_id?: string;
  }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('agent_codes')
      .insert({ ...codeData, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async findByCode(code: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('agent_codes')
      .select('*')
      .eq('code', code)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findByAgent(agentId: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('agent_codes')
      .select('*')
      .eq('agent_id', agentId);
    if (error) throw error;
    return data || [];
  },

  async incrementUsage(code: string) {
    const client = getDbClient();
    const { data, error } = await client.rpc('increment_agent_code_usage', { p_code: code });
    if (error) {
      // Fallback if RPC doesn't exist
      const { data: codeData } = await client.from('agent_codes').select('used_count').eq('code', code).single();
      if (codeData) {
        await client.from('agent_codes').update({ used_count: (codeData.used_count || 0) + 1 }).eq('code', code);
      }
    }
    return data;
  },

  async delete(id: string) {
    const client = getDbClient();
    const { error } = await client.from('agent_codes').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async getAll(options?: { tenant_id?: string; is_active?: boolean }) {
    const client = getDbClient();
    let query = client.from('agent_codes').select('*');
    if (options?.tenant_id) query = query.eq('tenant_id', options.tenant_id);
    if (options?.is_active !== undefined) query = query.eq('is_active', options.is_active);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};

// ============ AUDIT LOG ============
export const auditLog = {
  async create(entry: {
    user_id?: string;
    user_email?: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    details?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    tenant_id?: string;
  }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('audit_log')
      .insert({ ...entry, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAll(options?: {
    user_id?: string;
    entity_type?: string;
    entity_id?: string;
    action?: string;
    tenant_id?: string;
    limit?: number;
    offset?: number;
  }) {
    const client = getDbClient();
    let query = client.from('audit_log').select('*');
    
    if (options?.user_id) query = query.eq('user_id', options.user_id);
    if (options?.entity_type) query = query.eq('entity_type', options.entity_type);
    if (options?.entity_id) query = query.eq('entity_id', options.entity_id);
    if (options?.action) query = query.eq('action', options.action);
    if (options?.tenant_id) query = query.eq('tenant_id', options.tenant_id);
    
    query = query.order('created_at', { ascending: false });
    
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset !== undefined) {
      const limit = options.limit || 50;
      query = query.range(options.offset, options.offset + limit - 1);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getRecent(limit: number = 50, tenant_id?: string) {
    return this.getAll({ limit, tenant_id });
  }
};

// ============ SETTINGS ============
export const settings = {
  async get(key: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('settings')
      .select('*')
      .eq('key', key)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.value;
  },

  async set(key: string, value: any, options?: { description?: string; updated_by?: string; tenant_id?: string }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('settings')
      .upsert({
        key,
        value,
        description: options?.description,
        updated_at: new Date().toISOString(),
        updated_by: options?.updated_by,
        tenant_id: options?.tenant_id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(key: string) {
    const client = getDbClient();
    const { error } = await client.from('settings').delete().eq('key', key);
    if (error) throw error;
    return true;
  },

  async getAll(tenant_id?: string) {
    const client = getDbClient();
    let query = client.from('settings').select('*');
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data, error } = await query;
    if (error) throw error;
    const result: Record<string, any> = {};
    for (const row of (data || [])) {
      result[row.key] = row.value;
    }
    return result;
  }
};

// ============ DOCUMENTS ============
export const documents = {
  async create(docData: {
    case_id: string;
    file_name: string;
    file_url: string;
    file_type?: string;
    file_size?: number;
    uploaded_by?: string;
    uploader_name?: string;
    description?: string;
    tenant_id?: string;
    metadata?: Record<string, any>;
  }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('documents')
      .insert({ ...docData, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getByCase(caseId: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('documents')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async delete(id: string) {
    const client = getDbClient();
    const { error } = await client.from('documents').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async verify(id: string, verifiedBy: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('documents')
      .update({ is_verified: true, verified_by: verifiedBy, verified_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============ ATTENDANCE ============
export const attendance = {
  async create(record: {
    user_id: string;
    date: string;
    check_in?: string;
    check_out?: string;
    status?: string;
    work_hours?: number;
    notes?: string;
    location_in?: Record<string, any>;
    location_out?: Record<string, any>;
    device_info?: string;
    tenant_id?: string;
  }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('attendance')
      .insert({ ...record, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getByUser(userId: string, options?: { startDate?: string; endDate?: string }) {
    const client = getDbClient();
    let query = client
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (options?.startDate) query = query.gte('date', options.startDate);
    if (options?.endDate) query = query.lte('date', options.endDate);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getByDate(date: string, tenant_id?: string) {
    const client = getDbClient();
    let query = client.from('attendance').select('*').eq('date', date);
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async update(id: string, updates: Record<string, any>) {
    const client = getDbClient();
    const { data, error } = await client
      .from('attendance')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAll(options?: { tenant_id?: string; date?: string; limit?: number; offset?: number }) {
    const client = getDbClient();
    let query = client.from('attendance').select('*');
    if (options?.tenant_id) query = query.eq('tenant_id', options.tenant_id);
    if (options?.date) query = query.eq('date', options.date);
    query = query.order('date', { ascending: false });
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};

// ============ NOTIFICATIONS ============
export const notifications = {
  async create(notification: {
    user_id: string;
    title: string;
    message: string;
    type?: string;
    action_url?: string;
    action_type?: string;
    metadata?: Record<string, any>;
    expires_at?: string;
    tenant_id?: string;
  }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('notifications')
      .insert({ ...notification, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getByUser(userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
    const client = getDbClient();
    let query = client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (options?.unreadOnly) query = query.eq('is_read', false);
    if (options?.limit) query = query.limit(options.limit);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async markAsRead(id: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markAllAsRead(userId: string) {
    const client = getDbClient();
    const { error } = await client
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return true;
  },

  async delete(id: string) {
    const client = getDbClient();
    const { error } = await client.from('notifications').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async deleteExpired() {
    const client = getDbClient();
    const { error } = await client
      .from('notifications')
      .delete()
      .lt('expires_at', new Date().toISOString());
    if (error) throw error;
    return true;
  }
};

// ============ LEAVE REQUESTS ============
export const leaveRequests = {
  async create(request: {
    user_id: string;
    start_date: string;
    end_date: string;
    leave_type: string;
    reason?: string;
    tenant_id?: string;
  }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('leave_requests')
      .insert({ ...request, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getByUser(userId: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getPending(tenant_id?: string) {
    const client = getDbClient();
    let query = client
      .from('leave_requests')
      .select('*, users!inner(full_name, email)')
      .eq('status', 'pending');
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async approve(id: string, approvedBy: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('leave_requests')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async reject(id: string, rejectionReason: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('leave_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAll(options?: { status?: string; tenant_id?: string; limit?: number }) {
    const client = getDbClient();
    let query = client.from('leave_requests').select('*');
    if (options?.status) query = query.eq('status', options.status);
    if (options?.tenant_id) query = query.eq('tenant_id', options.tenant_id);
    query = query.order('created_at', { ascending: false });
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};

// ============ PASSPORT TRACKING ============
export const passportTracking = {
  async create(record: {
    case_id: string;
    passport_number?: string;
    status: string;
    location?: string;
    current_holder?: string;
    estimated_return_date?: string;
    tenant_id?: string;
  }) {
    const client = getDbClient();
    const { data, error } = await client
      .from('passport_tracking')
      .insert({
        ...record,
        notes: [],
        tracking_events: [],
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getByCase(caseId: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('passport_tracking')
      .select('*')
      .eq('case_id', caseId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getByPassportNumber(passportNumber: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('passport_tracking')
      .select('*')
      .eq('passport_number', passportNumber)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateStatus(id: string, status: string, updates?: Record<string, any>) {
    const client = getDbClient();
    const { data, error } = await client
      .from('passport_tracking')
      .update({
        status,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addEvent(id: string, event: { title: string; description?: string; user?: string }) {
    const client = getDbClient();
    const record = await this.getById(id);
    if (!record) throw new Error('Passport tracking record not found');
    
    const events = record.tracking_events || [];
    events.push({
      id: `evt-${Date.now()}`,
      ...event,
      timestamp: new Date().toISOString()
    });
    
    return this.updateStatus(id, record.status, { tracking_events: events });
  },

  async getById(id: string) {
    const client = getDbClient();
    const { data, error } = await client
      .from('passport_tracking')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getAll(options?: { status?: string; tenant_id?: string; limit?: number }) {
    const client = getDbClient();
    let query = client.from('passport_tracking').select('*');
    if (options?.status) query = query.eq('status', options.status);
    if (options?.tenant_id) query = query.eq('tenant_id', options.tenant_id);
    query = query.order('updated_at', { ascending: false });
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};

// Export all database modules
export const db = {
  query,
  users,
  cases,
  sessions,
  agentCodes,
  auditLog,
  settings,
  documents,
  attendance,
  notifications,
  leaveRequests,
  passportTracking,
  getClient: getDbClient
};

export default db;
