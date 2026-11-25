"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { Btn } from "@/components/native/ui";
import { apiFetch } from "@/lib/apiClient";
import { setMobileToken } from "@/lib/mobile-auth";
import { isNativeBundle } from "@/lib/native-mode";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Login failed");
      } else if (data.message === "tenant_selection_required") {
        // Store tenant list for the selection page
        sessionStorage.setItem("pending_tenants", JSON.stringify(data.tenants));
        if (data.token) {
          await setMobileToken(data.token);
        }
        router.push("/select-tenant");
      } else {
        // On mobile the session cookie never reaches the WebView origin, so the
        // token from the response body is what keeps the session alive. No-op
        // on web, where the cookie already did the work.
        if (data.token) {
          await setMobileToken(data.token);
        }
        router.push(data.redirect ?? "/app");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (isNativeBundle()) {
    return (
      <div className="ios-surface safe-t safe-b flex min-h-dvh flex-col">
        <header className="flex h-11 shrink-0 items-center justify-center">
          <h1 className="t-headline">Sign in</h1>
        </header>

        <main className="flex flex-1 flex-col px-4 pb-6 pt-6">
          <div
            aria-hidden
            className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[color:var(--ios-accent)] text-[#111] shadow-sm"
          >
            <Box className="h-[30px] w-[30px]" strokeWidth={1.7} />
          </div>
          <p className="t-title2 mt-3.5">sitely</p>
          <p className="t-subhead t-secondary mt-1 max-w-[26ch]">
            Daily site records — signed, synced, on file.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="ios-hairline mt-6 overflow-hidden rounded-[10px] bg-[color:var(--ios-card)]">
              <div className="px-4 py-2">
                <label
                  htmlFor="email"
                  className="t-footnote block font-medium text-[color:var(--ios-ink2)]"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="t-body block h-11 w-full border-0 bg-transparent p-0 text-[color:var(--ios-ink)] outline-none focus-visible:outline-none"
                  style={{ fontSize: 17 }}
                />
              </div>
              <div className="relative px-4 py-2">
                <span
                  aria-hidden
                  className="absolute inset-x-4 top-0 h-[0.5px] bg-[color:var(--ios-sep)]"
                />
                <label
                  htmlFor="password"
                  className="t-footnote block font-medium text-[color:var(--ios-ink2)]"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Required"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="t-body block h-11 w-full border-0 bg-transparent p-0 text-[color:var(--ios-ink)] outline-none placeholder:text-[color:var(--ios-ink2)] focus-visible:outline-none"
                  style={{ fontSize: 17 }}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="t-footnote mt-2 px-1 font-medium text-destructive">
                {error}
              </p>
            )}

            <div className="mt-5">
              <Btn type="submit" block disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Btn>
            </div>
          </form>

          <p className="t-subhead t-secondary mt-1 px-1">
            No account?{" "}
            <Link href="/signup" className="ios-tap inline-flex items-center font-semibold text-[color:var(--ios-ink)]">
              Create one
            </Link>
          </p>

          <p className="t-footnote t-secondary mt-auto flex items-start gap-2 pt-6">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden />
            <span>
              Logs are signed on the device and synced to the office. Entries written offline
              upload when signal returns.
            </span>
          </p>
        </main>
      </div>
    );
  }

  return (
    <AuthShell title="Sign in">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
