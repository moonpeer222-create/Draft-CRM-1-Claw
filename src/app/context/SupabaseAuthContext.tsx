import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, DbUser } from '../lib/supabase';
import { validateAgentCodeAsync, getAgentPassword } from '../lib/agentAuth';
import { AccessCodeService } from '../lib/accessCode';

interface AuthContextType {
  user: User | null;
  profile: DbUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInAgentWithCode: (code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Try normal Supabase session first
        // Safety: getSession() can deadlock if onAuthStateChange callbacks are
        // async and hold the gotrue-js lock. Use a 5s timeout as fallback.
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 5000)
        );
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        if (session?.user) {
          if (!mounted) return;
          setSession(session);
          setUser(session.user);
          await loadProfile(session.user.id);
          return;
        }

        // 2. Try restore agent code session from localStorage
        const agentSession = AccessCodeService.getAgentSession();
        if (agentSession) {
          // Fetch profile from Supabase using agent_id
          const { data: agents } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'agent')
            .eq('agent_id', agentSession.agentId)
            .limit(1);
          const agentProfile = agents?.[0];
          const syntheticProfile: DbUser = {
            id: agentProfile?.id || agentSession.agentId,
            email: agentProfile?.email || `${agentSession.agentId}@agent.local`,
            full_name: agentSession.agentName,
            role: 'agent',
            organization_id: agentProfile?.organization_id || null,
            avatar_url: agentProfile?.avatar_url || null,
            last_seen: new Date().toISOString(),
            created_at: agentProfile?.created_at || new Date().toISOString(),
            agent_id: agentSession.agentId,
            agent_name: agentSession.agentName,
            ...(agentProfile || {}),
          };
          const syntheticUser = { id: syntheticProfile.id } as User;
          const syntheticSession = {
            access_token: 'agent-code-session',
            refresh_token: 'agent-code-session',
            expires_in: Math.max(0, Math.floor((agentSession.expiresAt - Date.now()) / 1000)),
            expires_at: Math.floor(agentSession.expiresAt / 1000),
            token_type: 'bearer',
            user: syntheticUser,
          } as Session;
          if (!mounted) return;
          setUser(syntheticUser);
          setProfile(syntheticProfile);
          setSession(syntheticSession);
          setLoading(false);
          return;
        }
      } catch {
        /* ignore */
      }
      // Delay setting loading=false so onAuthStateChange can fire first
      // and set loading=true when a session exists. This prevents auth
      // guards from redirecting to login during the hydration gap.
      setTimeout(() => {
        if (mounted) setLoading(false);
      }, 400);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true);
          // CRITICAL: Do NOT await loadProfile() here. The gotrue-js lock is held
          // while this callback runs, and loadProfile() may internally need the
          // same lock (via getSession). Awaiting here causes a deadlock on page
          // refresh when _initialize() holds the lock and waits for callbacks.
          loadProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setLoading(false);
        }
        // For INITIAL_SESSION with null session, do nothing —
        // init() already handles agent-session restoration and will
        // set loading false after its timeout.
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data as DbUser);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) await loadProfile(user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInAgentWithCode = async (code: string) => {
    const result = await validateAgentCodeAsync(code);
    if (!result.valid) {
      return { error: result.error || "Invalid access code" };
    }

    // Create legacy session for timer/UI compatibility
    AccessCodeService.createAgentSession(code, result.agentId!, result.agentName!);

    // Attempt real Supabase auth login using deterministic password
    const agentEmail = result.profile?.email;
    if (agentEmail && result.agentId) {
      const agentPassword = getAgentPassword(result.agentId);
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: agentEmail,
        password: agentPassword,
      });
      if (!signInError && signInData.session) {
        // Real session obtained — onAuthStateChange will update React state
        return { error: null };
      }
    }

    // Fallback: synthetic session (cases may fail RLS if DB requires authenticated)
    const syntheticProfile: DbUser = {
      id: result.profile?.id || result.agentId!,
      email: result.profile?.email || `${result.agentId}@agent.local`,
      full_name: result.agentName!,
      role: 'agent',
      organization_id: result.profile?.organization_id || null,
      avatar_url: result.profile?.avatar_url || null,
      last_seen: new Date().toISOString(),
      created_at: result.profile?.created_at || new Date().toISOString(),
      agent_id: result.agentId || null,
      agent_name: result.agentName || null,
      ...(result.profile || {}),
    };

    const syntheticUser = { id: syntheticProfile.id } as User;
    const syntheticSession = {
      access_token: 'agent-code-session',
      refresh_token: 'agent-code-session',
      expires_in: 6 * 60 * 60,
      expires_at: Math.floor(Date.now() / 1000) + 6 * 60 * 60,
      token_type: 'bearer',
      user: syntheticUser,
    } as Session;

    setUser(syntheticUser);
    setProfile(syntheticProfile);
    setSession(syntheticSession);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    AccessCodeService.agentLogout();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signInAgentWithCode, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useSupabaseAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
};
