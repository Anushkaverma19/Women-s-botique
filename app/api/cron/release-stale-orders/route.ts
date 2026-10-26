import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * VULN-04 Remediation: Automated cleanup of stale, unconfirmed Razorpay orders.
 * Releases reserved stock back into inventory so bot abandons or dropped checkouts
 * cannot permanently lock boutique stock (Inventory Hoarding / Denial of Inventory).
 *
 * Can be triggered via Vercel Cron, external monitoring, or pg_cron.
 * Protected by CRON_SECRET Bearer token authentication.
 */
export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured on server.");
    return NextResponse.json(
      { ok: false, error: "Cron execution is disabled (CRON_SECRET missing)." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const expectedHeader = `Bearer ${cronSecret}`;

  if (!constantTimeCompare(authHeader, expectedHeader)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized. Invalid or missing CRON_SECRET." },
      { status: 401 }
    );
  }

  try {
    const admin = createAdminClient();
    // Release inventory for pending orders older than 15 minutes
    const { data, error } = await admin.rpc("release_stale_razorpay_orders", {
      p_older_than_minutes: 15,
    });

    if (error) {
      console.error("Failed to release stale orders:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const count = Array.isArray(data) ? data.length : 0;
    console.log(`Cron: Released ${count} stale unconfirmed Razorpay order(s).`);

    return NextResponse.json({
      ok: true,
      releasedCount: count,
      message: `Successfully released ${count} stale order reservation(s).`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("Unexpected error in release-stale-orders cron:", err);
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
