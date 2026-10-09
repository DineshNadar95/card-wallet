import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { useAuth } from "../auth";

export function GoogleButton({ next, className = "btn btn-outline", children = "Continue with Google" }: {
  next?: string;
  className?: string;
  children?: ReactNode;
}) {
  const { configured, signInWithGoogle } = useAuth();
  return (
    <button
      type="button"
      className={className}
      disabled={!configured}
      title={configured ? undefined : "Sign-in isn't configured yet (see README)"}
      onClick={() => signInWithGoogle(next)}
    >
      {children}
    </button>
  );
}

export function SignInPrompt({ title, body }: { title: string; body: string }) {
  const { configured } = useAuth();
  const { pathname } = useLocation();
  return (
    <div className="panel prompt">
      <div className="prompt-title">{title}</div>
      <p className="muted">{body}</p>
      <GoogleButton next={pathname} className="btn btn-primary" />
      {!configured && (
        <p className="fine">
          Sign-in isn't configured on this deployment yet. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      )}
    </div>
  );
}

/** Renders children only when signed in; otherwise a sign-in prompt. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, session } = useAuth();
  if (!ready) return null;
  if (!session)
    return (
      <SignInPrompt
        title="Sign in to see your cards"
        body="Your wallet is private to your Google account. We only store the cards you add and their last 4 digits."
      />
    );
  return <>{children}</>;
}
