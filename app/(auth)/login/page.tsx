"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/schemas";

// Client-safe environment variable access with fallback constants
const DEMO_ADMIN_EMAIL =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL?.trim()) ||
  "demo@mehrae.com";

const DEMO_ADMIN_PASSWORD =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD?.trim()) ||
  "MehraeDemo@2026";

function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const urlError = searchParams.get("error");
  const [formError, setFormError] = useState(
    urlError === "auth_callback_failed"
      ? "Verification link expired or invalid. Please sign in or request a new link."
      : ""
  );
  const [loading, setLoading] = useState(false);

  // Auto-fill handler for demo credentials
  const handleFillDemoCredentials = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setEmail(DEMO_ADMIN_EMAIL);
    setPassword(DEMO_ADMIN_PASSWORD);
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
        className="w-full max-w-md space-y-5 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Welcome Back
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in to your MEHRAÉ account.
          </p>
        </div>

        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100"
          >
            {formError}
          </p>
        )}

        <div className="space-y-1.5">
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
            placeholder="name@example.com"
            required
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="text-xs text-gray-500 hover:text-gray-800 transition"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-black/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer shadow-xs"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        {/* Dummy Credentials Box */}
        <div className="mt-6 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 p-4 sm:p-5 text-xs shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-amber-200/60">
            <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[11px] text-amber-950">
              <span aria-hidden="true">🔑</span> Dummy Test Credentials
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              Auto-Fill
            </span>
          </div>

          <p className="text-gray-600 mb-3 text-xs leading-relaxed">
            Use these pre-configured test credentials to sign in and test the shop or admin console:
          </p>

          <div className="space-y-2 rounded-lg bg-white p-3 border border-amber-200/60 font-mono text-xs mb-3.5 select-all">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-gray-500 font-sans text-xs">Email:</span>
              <span className="font-semibold text-gray-900 break-all">{DEMO_ADMIN_EMAIL}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-gray-500 font-sans text-xs">Password:</span>
              <span className="font-semibold text-gray-900">{DEMO_ADMIN_PASSWORD}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFillDemoCredentials}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-medium py-2.5 px-4 text-xs shadow-xs transition duration-150 cursor-pointer active:scale-[0.99]"
          >
            <span>⚡</span>
            <span>Fill Demo Credentials</span>
          </button>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          New to MEHRAÉ?{" "}
          <Link href="/signup" className="text-black underline underline-offset-4 font-medium hover:text-gray-800">
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
