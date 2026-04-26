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

        // 2. No synthetic sessions - agents must use real Supabase Auth
        // If no session, user is not authenticated
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

    // Agents must use real Supabase Auth - no synthetic sessions
    const agentEmail = result.profile?.email;
    if (agentEmail && result.agentId) {
      const agentPassword = getAgentPassword(result.agentId);
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: agentEmail,
        password: agentPassword,
      });
      if (!signInError && signInData.session) {
        return { error: null };
      }
      return { error: signInError?.message || "Agent login failed" };
    }

    return { error: "Agent account not properly configured" };
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
