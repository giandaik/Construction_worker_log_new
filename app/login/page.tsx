"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { apiFetch } from "@/lib/apiClient";
import { setMobileToken } from "@/lib/mobile-auth";

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
