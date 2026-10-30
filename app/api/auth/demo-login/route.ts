import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface DemoAccount {
  email: string;
  passwords: string[];
  role: "admin" | "customer";
  fullName: string;
  fixedId: string;
}

const configuredAdminEmail = process.env.DEMO_ADMIN_EMAIL || process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || "demo@mehrae.com";
const configuredAdminPassword = process.env.DEMO_ADMIN_PASSWORD || process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || "MehraeDemo@2026";

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: configuredAdminEmail.toLowerCase(),
    passwords: [configuredAdminPassword, "MehraeDemo@2026", "Admin@123"],
    role: "admin",
    fullName: "MEHRAÉ Demo Admin",
    fixedId: "00000000-0000-0000-0000-000000000001",
  },
  {
    email: "demo@mehrae.com",
    passwords: ["MehraeDemo@2026", configuredAdminPassword, "Admin@123"],
    role: "admin",
    fullName: "MEHRAÉ Demo Admin",
    fixedId: "00000000-0000-0000-0000-000000000001",
  },
  {
    email: "admin@mehrae.com",
    passwords: ["Admin@123", "MehraeDemo@2026", configuredAdminPassword],
    role: "admin",
    fullName: "MEHRAÉ Administrator",
    fixedId: "00000000-0000-0000-0000-000000000002",
  },
  {
    email: "customer@mehrae.com",
    passwords: ["Customer@123", "MehraeDemo@2026"],
    role: "customer",
    fullName: "MEHRAÉ Demo Customer",
    fixedId: "00000000-0000-0000-0000-000000000003",
  },
];

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json().catch(() => ({}));

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const demoAccount = DEMO_ACCOUNTS.find(
      (a) => a.email === normalizedEmail && a.passwords.includes(password.trim())
    );

    if (!demoAccount) {
      return NextResponse.json(
        { ok: false, error: "Invalid demo credentials." },
        { status: 401 }
      );
    }

    let userId = demoAccount.fixedId;

    // 1. Proactively ensure the user exists in Supabase Auth backend
    try {
      const admin = createAdminClient();

      // Look up if user already exists in auth.users
      const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 100 });
      const existingUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (existingUser) {
        userId = existingUser.id;
        // Keep demo password synchronized
        await admin.auth.admin.updateUserById(existingUser.id, {
          password: password.trim(),
          email_confirm: true,
        });
      } else {
        // Auto-create the user in Supabase Auth with confirmed email
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: normalizedEmail,
          password: password.trim(),
          email_confirm: true,
          user_metadata: { full_name: demoAccount.fullName },
        });

        if (!createError && created?.user) {
          userId = created.user.id;
        }
      }

      // Upsert profile in public.profiles to guarantee role consistency
      await admin.from("profiles").upsert(
        {
          id: userId,
          email: normalizedEmail,
          full_name: demoAccount.fullName,
          role: demoAccount.role,
        },
        { onConflict: "id" }
      );
    } catch (provisionErr) {
      console.warn("[DemoAuth] Could not auto-provision in Supabase Auth (continuing with mock session):", provisionErr);
    }

    // 2. Prepare mock session payload
    const sessionPayload = {
      id: userId,
      email: normalizedEmail,
      full_name: demoAccount.fullName,
      role: demoAccount.role,
      isDemo: true,
      timestamp: Date.now(),
    };

    const response = NextResponse.json({
      ok: true,
      isDemo: true,
      user: sessionPayload,
      message: "Demo session authenticated successfully.",
    });

    // 3. Set secure demo session cookie for proxy & server component verification
    response.cookies.set("mehrae_demo_session", JSON.stringify(sessionPayload), {
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false, // accessible to client for fast logout / state checks
    });

    return response;
  } catch (err: unknown) {
    console.error("[DemoAuth] Unexpected error in demo login:", err);
    return NextResponse.json(
      { ok: false, error: "An unexpected error occurred during demo sign in." },
      { status: 500 }
    );
  }
}
