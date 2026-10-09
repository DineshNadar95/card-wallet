import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") queryClient.removeQueries({ queryKey: ["me"] });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      configured: !!supabase,
      ready,
      session,
      async signInWithGoogle() {
        if (!supabase) return;
        // cardwallet://auth/callback in builds, exp://…/--/auth/callback in Expo Go.
        // Add both to Supabase → Auth → URL Configuration → Redirect URLs.
        const redirectTo = Linking.createURL("auth/callback");
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error || !data.url) throw error ?? new Error("Could not start sign-in");

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== "success") return; // user cancelled
        const code = Linking.parse(result.url).queryParams?.code;
        if (typeof code !== "string") throw new Error("Sign-in did not return a code");
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      },
      async signOut() {
        await supabase?.auth.signOut();
      },
    }),
    [ready, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
