"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuthShell } from "@/components/auth-shell";
import { apiFetch } from "@/lib/apiClient";
import { setMobileToken } from "@/lib/mobile-auth";

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthShell title="Create account"><p>Loading invitation...</p></AuthShell>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRequestError(null);
    setRequestLoading(true);

    try {
      const res = await apiFetch("/api/signup-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          organizationName,
          message: requestMessage,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setRequestError(data.error || "Could not submit your request. Please try again.");
        return;
      }

      setRequestSubmitted(true);
    } catch (err) {
      console.error(err);
      setRequestError("A network error occurred. Please try again.");
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!inviteToken) {
      setError("You need an invitation from your organisation administrator to create an account.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteToken }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Sign up failed");
      } else {
        // Signup logs the user in; on mobile the token is the session. No-op on web.
        if (data.token) {
          await setMobileToken(data.token);
        }
        router.push("/app");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={inviteToken ? "Accept invitation" : "Request an invitation"}>
      {!inviteToken ? (
        requestSubmitted ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground" role="status">
              Your request has been sent for review. If approved, you will receive an invitation by email.
              You can create an account after accepting that invitation.
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="underline">Sign in</Link>
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleRequestSubmit}>
            <p className="text-sm text-muted-foreground">
              Tell us who you are and which organisation you work with. A platform administrator will review
              your request; no account or organisation access is created until an invitation is accepted.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="request-first-name">First name</Label>
                <Input
                  id="request-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  maxLength={80}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-last-name">Last name</Label>
                <Input
                  id="request-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  maxLength={80}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-email">Email</Label>
              <Input
                id="request-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-organization">Organisation / company</Label>
              <Input
                id="request-organization"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                maxLength={160}
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-message">Anything else we should know? (optional)</Label>
              <Textarea
                id="request-message"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
              <Label htmlFor="request-website">Leave this field empty</Label>
              <Input
                id="request-website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            {requestError && (
              <p className="text-sm text-destructive" role="alert">{requestError}</p>
            )}
            <Button type="submit" className="w-full" disabled={requestLoading}>
              {requestLoading ? "Sending request..." : "Send invitation request"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="underline">Sign in</Link>
            </p>
          </form>
        )
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-muted-foreground">
            Create an account with the email address that received this invitation.
          </p>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
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
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
              {error.includes("already exists") && (
                <>{" "}<Link href={`/login?invite=${encodeURIComponent(inviteToken)}`} className="underline">Sign in to accept it.</Link></>
              )}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={`/login?invite=${encodeURIComponent(inviteToken)}`} className="underline">
              Sign in to accept the invitation
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
