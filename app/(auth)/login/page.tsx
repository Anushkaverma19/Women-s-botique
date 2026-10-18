"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/schemas";
import { Container } from "@/components/ui/primitives";
import { Input, Label, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const urlError = searchParams.get("error");
  const initialError =
    urlError === "auth_callback_failed"
      ? "Verification link expired or invalid. Please sign in directly or request a new link."
      : null;
  const [formError, setFormError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

      if (error) {
        setLoading(false);
        const msg = error.message ? error.message.toLowerCase() : "";
        if (
          error.code === "email_not_confirmed" ||
          msg.includes("email not confirmed")
        ) {
          setFormError(
            "Please verify your email address before signing in. Check your inbox for the confirmation link."
          );
        } else if (
          error.status === 429 ||
          msg.includes("too many requests") ||
          msg.includes("rate limit")
        ) {
          setFormError(
            "Too many sign-in attempts. Please wait a minute and try again."
          );
        } else if (
          error.code === "invalid_credentials" ||
          msg.includes("invalid login credentials")
        ) {
          setFormError("Incorrect email or password. Please try again.");
        } else {
          setFormError(error.message || "Failed to sign in. Please try again.");
        }
        return;
      }

      if (data?.session) {
        // Ensure session state is active before triggering page navigation
        await supabase.auth.getSession();
      }

      setLoading(false);

      const redirectTo = searchParams.get("redirectTo") || "/account";
      window.location.assign(redirectTo);
    } catch (err: unknown) {
      setLoading(false);
      setFormError(
        err instanceof Error ? err.message : "An unexpected error occurred during sign in."
      );
    }
  }

  return (
    <Container className="py-16 max-w-md">
      <h1 className="font-display text-4xl mb-2">Welcome Back</h1>
      <p className="text-charcoal/60 mb-10 text-sm">Sign in to your MEHRAÉ account.</p>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <FieldError>{errors.email}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <FieldError>{errors.password}</FieldError>
        </div>
        {formError ? (
          <p role="alert" className="text-xs text-burgundy">
            {formError}
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing In..." : "Sign In"}
        </Button>
      </form>
      <p className="text-sm text-charcoal/60 mt-8">
        New to MEHRAÉ?{" "}
        <Link href="/signup" className="text-charcoal underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </Container>
  );
}