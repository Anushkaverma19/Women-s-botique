"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signUpSchema } from "@/lib/validations/schemas";
import { Container } from "@/components/ui/primitives";
import { Input, Label, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    const parsed = signUpSchema.safeParse({ fullName, email, password });
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
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.fullName } },
    });
    setLoading(false);

    if (error) {
      setFormError(
        error.message.includes("already registered")
          ? "An account with this email already exists."
          : "Could not create your account. Please try again."
      );
      return;
    }

    if (!data.session) {
      // Email confirmation is required by this Supabase project - there is
      // no active session yet, so redirecting to /account would just bounce
      // straight back to /login. Show a clear next step instead.
      setCheckEmail(true);
      return;
    }

    // Hard navigation, not router.push + router.refresh: Navbar and
    // /account are Server Components that read the session from cookies on
    // the server, and a client-router transition can race with the cookie
    // write or serve an already-cached payload for the destination route -
    // both showed up as a stale/logged-out navbar, especially on mobile.
    // A full navigation always re-requests the page with the fresh cookie.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation, see comment above
    window.location.href = "/account";
  }

  if (checkEmail) {
    return (
      <Container className="py-16 max-w-md text-center">
        <h1 className="font-display text-4xl mb-4">Check your email</h1>
        <p className="text-charcoal/60 text-sm leading-relaxed">
          We&apos;ve sent a confirmation link to <span className="text-charcoal">{email}</span>. Open it to
          activate your account, then{" "}
          <Link href="/login" className="text-charcoal underline underline-offset-4">
            sign in
          </Link>
          .
        </p>
      </Container>
    );
  }

  return (
    <Container className="py-16 max-w-md">
      <h1 className="font-display text-4xl mb-2">Create Your Account</h1>
      <p className="text-charcoal/60 mb-10 text-sm">Join MEHRAÉ for a personalised shopping experience.</p>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <FieldError>{errors.fullName}</FieldError>
        </div>
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
          {loading ? "Creating Account..." : "Create Account"}
        </Button>
      </form>
      <p className="text-sm text-charcoal/60 mt-8">
        Already have an account?{" "}
        <Link href="/login" className="text-charcoal underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </Container>
  );
}
