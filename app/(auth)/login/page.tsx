"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/schemas";

function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const urlError = searchParams.get("error");
  const [formError, setFormError] = useState(
    urlError === "auth_callback_failed"
      ? "Verification link expired or invalid. Please sign in or request a new link."
      : ""
  );
  const [loading, setLoading] = useState(false);

  const fillCustomerDemo = () => {
    setEmail("customer@mehrae.com");
    setPassword("Customer@123");
    setFormError("");
  };

  const fillAdminDemo = () => {
    setEmail("admin@mehrae.com");
    setPassword("Admin@123");
    setFormError("");
  };

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const parsed = loginSchema.safeParse({
      email,
      password,
    });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ||
          "Please enter a valid email and password."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        console.error("Supabase login error:", error.message);
        setFormError(error.message);
        return;
      }

      if (!data.user || !data.session) {
        setFormError("Login was not completed. Please try again.");
        return;
      }

      const redirectTo = searchParams.get("redirectTo");
      const safeRedirect =
        redirectTo &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//")
          ? redirectTo
          : "/account";

      window.location.replace(safeRedirect);
    } catch (error) {
      console.error("Login error:", error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md space-y-5 rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Welcome Back
        </h1>

        <p className="text-sm text-gray-500">
          Sign in to your MEHRAÉ account.
        </p>

        {formError && (
          <p
            role="alert"
            className="rounded-md bg-red-50 p-3 text-sm text-red-700"
          >
            {formError}
          </p>
        )}

        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        {/* Demo Credentials Helper Box */}
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-gray-800 uppercase tracking-wider text-[11px]">
              Demo Credentials
            </span>
            <span className="text-gray-400 text-[10px]">Instant fill</span>
          </div>
          <p className="text-gray-500 mb-3 text-xs leading-relaxed">
            Select a demo profile to test buyer checkout or admin management:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={fillCustomerDemo}
              className="flex items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 hover:border-gray-300 active:scale-[0.98]"
            >
              <span>🛍️</span> Customer Demo
            </button>
            <button
              type="button"
              onClick={fillAdminDemo}
              className="flex items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 hover:border-gray-300 active:scale-[0.98]"
            >
              <span>⚡</span> Admin Demo
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          New to MEHRAÉ?{" "}
          <Link href="/signup" className="text-black underline underline-offset-4 font-medium">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          Loading...
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
