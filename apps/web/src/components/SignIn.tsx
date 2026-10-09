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

/** Renders children when signed in or in the demo; otherwise a sign-in prompt. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, session, demo } = useAuth();
  if (!ready) return null;
  if (!session && !demo)
    return (
      <SignInPrompt
        title="Sign in to see your cards"
        body="Your wallet is private to your Google account. We only store the cards you add and their last 4 digits."
      />
    );
  return <>{children}</>;
}

/** Shown in place of write actions while browsing the demo. */
export function DemoReadOnly({ what }: { what: string }) {
  return (
    <SignInPrompt
      title="This is the demo"
      body={`Demo data is read-only. Sign in with Google to ${what} with your own cards.`}
    />
  );
}

/** Write screens (add/edit) show a read-only notice instead of their form in the demo. */
export function DemoGate({ what, children }: { what: string; children: ReactNode }) {
  const { demo } = useAuth();
  return demo ? <DemoReadOnly what={what} /> : <>{children}</>;
}
