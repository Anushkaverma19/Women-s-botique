"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/schemas";
import { Container } from "@/components/ui/primitives";
import { Input, Label, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);

    if (error) {
      setFormError("Incorrect email or password.");
      return;
    }

    const redirectTo = searchParams.get("redirectTo") || "/account";
    router.push(redirectTo);
    router.refresh();
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
