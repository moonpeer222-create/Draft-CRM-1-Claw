import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nsglpnxboaxkrgtmlsps.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ2xwbnhib2F4a3JndG1sc3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NDg0NTAsImV4cCI6MjA5MTUyNDQ1MH0.E8dQi419Wty0cxnADc5cl_8Xo_3O_hIyS1Zhsa5W5vg';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'x-application-name': 'emerald-crm-saas' },
  },
});

export type DbUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'master_admin' | 'admin' | 'agent' | 'customer' | 'operator';
  organization_id: string | null;
  avatar_url: string | null;
  last_seen: string;
  created_at: string;
};

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function getCurrentUserProfile(): Promise<DbUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  return data as DbUser;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}
