import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (public values only). */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { flowType: "pkce" } }) : null;

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type AuthState = {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  signInWithGoogle: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, client = supabase }: { children: ReactNode; client?: SupabaseClient | null }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!client);

  useEffect(() => {
    if (!client) return;
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Never show one user's cached data to the next.
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") queryClient.removeQueries({ queryKey: ["me"] });
    });
    return () => data.subscription.unsubscribe();
  }, [client, queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      configured: !!client,
      ready,
      session,
      async signInWithGoogle(next = "/app/cards") {
        if (!client) return;
        await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}${next}` },
        });
      },
      async signOut() {
        await client?.auth.signOut();
      },
    }),
    [client, ready, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
