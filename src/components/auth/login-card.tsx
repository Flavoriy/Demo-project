"use client";

import { useState } from "react";
import { ArrowRight, CheckCheck, LogIn, Mail, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/browser";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginCard({
  errorMessage,
  supabaseConfigured,
  appOrigin,
}: {
  errorMessage: string | null;
  supabaseConfigured: boolean;
  appOrigin: string | null;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Email & Password Auth State
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleGoogleLogin() {
    if (!supabaseConfigured) {
      setLocalError("Supabase is missing. Add NEXT_PUBLIC_SUPABASE_URL and a Supabase public key, then redeploy.");
      return;
    }

    setIsLoading(true);
    setLocalError(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();
      const redirectOrigin = appOrigin ?? window.location.origin;
      const redirectTo = `${redirectOrigin}/auth/callback?next=/dashboard`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setLocalError(error.message);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not start Google sign-in.");
      setIsLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      setLocalError("Supabase is not configured.");
      return;
    }

    if (!email || !password) {
      setLocalError("Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    setLocalError(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // Attempt automatic sign up if sign in fails (e.g. account doesn't exist)
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });

          if (signUpError) {
            setLocalError(error.message);
            setIsLoading(false);
            return;
          }

          if (signUpData.session) {
            router.push("/dashboard");
            router.refresh();
          } else {
            setSuccessMessage(
              "Account created! Please check your email to verify your account or sign in if you already verified it."
            );
            setIsLoading(false);
          }
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setLocalError(error.message);
          setIsLoading(false);
          return;
        }

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setSuccessMessage(
            "Account created! Please check your email to verify your account or sign in if you already verified it."
          );
          setIsLoading(false);
        }
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Authentication failed.");
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-5 md:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-panel rounded-[28px] p-7 md:p-10">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-14 items-center justify-center rounded-[16px] bg-accent text-white shadow-[0_10px_20px_rgba(22,163,74,0.16)]">
              <CheckCheck className="size-7" />
            </span>
            <div>
              <p className="text-3xl font-semibold tracking-[-0.04em]">TikTo</p>
              <p className="mt-1 text-sm text-muted">Classic daily planning with optional sync.</p>
            </div>
          </div>
          <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-5xl">
            Stay on top of tasks without turning your day into dashboard noise.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted md:text-lg">
            Plan in a simple list-first workspace, then connect Google Calendar, Google Tasks, or Telegram only where they add value.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Daily focus", "Keep today visible with a clean task list and a short agenda."],
              ["Google sync", "Use one Google account for sign-in, calendar, and tasks when ready."],
              ["Telegram setup", "Store reminder settings inside the app instead of scattered configs."],
            ].map(([title, copy]) => (
              <div key={title} className="panel-muted rounded-[18px] p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel flex flex-col justify-between rounded-[28px] p-6 md:p-7 bg-white">
          <div>
            <p className="section-label">Access Account</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Welcome to TikTo</h2>
            
            <div className="mt-5 flex rounded-[10px] bg-[var(--panel-muted)] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 rounded-[8px] py-1.5 text-center text-sm font-medium transition ${
                  mode === "signin"
                    ? "bg-white text-foreground shadow-xs font-semibold"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 rounded-[8px] py-1.5 text-center text-sm font-medium transition ${
                  mode === "signup"
                    ? "bg-white text-foreground shadow-xs font-semibold"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
            {!supabaseConfigured ? (
              <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Supabase is not configured on this deployment. Add `NEXT_PUBLIC_SUPABASE_URL` and
                `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel, then redeploy.
              </div>
            ) : null}
            {localError ? (
              <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {localError}
              </div>
            ) : null}
            {successMessage ? (
              <div className="mt-4 rounded-[14px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            ) : null}

            <form onSubmit={handleEmailAuth} className="mt-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 size-4 text-muted" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 size-4 text-muted" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-6 w-full"
                variant="primary"
                disabled={isLoading || !supabaseConfigured}
              >
                {isLoading ? (
                  <span>Processing...</span>
                ) : (
                  <span className="flex w-full items-center justify-between font-semibold">
                    <span>{mode === "signin" ? "Sign In" : "Sign Up"}</span>
                    <ArrowRight className="size-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="relative my-6 flex items-center justify-center">
              <span className="absolute inset-x-0 h-px bg-border" />
              <span className="relative bg-white px-3 text-xs text-muted">or continue with</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading || !supabaseConfigured}
              className="inline-flex w-full items-center justify-between rounded-[10px] border border-border bg-white px-4 py-2.5 text-left text-foreground transition hover:bg-[var(--panel-muted)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="inline-flex items-center gap-3 font-semibold text-sm">
                <LogIn className="size-4 text-muted" />
                Continue with Google
              </span>
              <ArrowRight className="size-4 text-muted" />
            </button>
          </div>

          <div className="mt-8">
            <p className="text-xs leading-5 text-muted">
              You can start with a simple email account, and configure other integrations later in your settings.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
