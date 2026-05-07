import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    console.warn('[auth] failed to fetch profile', error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

async function ensureProfile(user: User): Promise<Profile | null> {
  const existing = await fetchProfile(user.id);
  if (existing) return existing;
  const fallbackName =
    (user.user_metadata?.name as string | undefined) ?? user.email?.split('@')[0] ?? null;
  const { data, error } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, name: fallbackName })
    .select('*')
    .maybeSingle();
  if (error) {
    console.warn('[auth] failed to create profile', error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const u = session?.user;
    if (!u) {
      setProfile(null);
      return;
    }
    const p = await ensureProfile(u);
    setProfile(p);
  }, [session]);

  useEffect(() => {
    let active = true;
    // Failsafe: never hang the UI in 'loading' for more than 2s
    const failsafe = window.setTimeout(() => {
      if (active) {
        console.warn('[auth] timeout 2s — liberando UI');
        setLoading(false);
      }
    }, 2000);

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn('[auth] getSession error', error.message);
        if (!active) return;
        setSession(data?.session ?? null);
        if (data?.session?.user) {
          const p = await ensureProfile(data.session.user);
          if (active) setProfile(p);
        }
      } catch (e: any) {
        console.warn('[auth] getSession threw', e?.message ?? e);
      } finally {
        if (active) {
          window.clearTimeout(failsafe);
          setLoading(false);
        }
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        try {
          const p = await ensureProfile(newSession.user);
          setProfile(p);
        } catch (e: any) {
          console.warn('[auth] ensureProfile failed', e?.message ?? e);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(failsafe);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: (error as Error) ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: name ? { name } : undefined },
    });
    return { error: (error as Error) ?? null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      console.warn('[auth] signOut error', e?.message ?? e);
    }
    // Force-clear local state regardless of remote outcome
    setSession(null);
    setProfile(null);
    // Clean any leftover Supabase session keys in localStorage just in case
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
