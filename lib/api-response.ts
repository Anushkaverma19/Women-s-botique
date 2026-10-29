import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, ForbiddenError } from "@/lib/supabase/auth";
import crypto from "crypto";

/**
 * Central error -> HTTP response mapping used by every Route Handler.
 * Ensures we never leak stack traces, SQL constraints, or internal details to the client.
 */
export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid input parameters." },
      { status: 400 }
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  const errorId = crypto.randomUUID().slice(0, 8);
  console.error(`[API Error Ref: ${errorId}]`, error);

  // Production masking: never reveal internal Postgres/schema messages
  const isDev = process.env.NODE_ENV === "development";
  const userMessage =
    isDev && error instanceof Error
      ? error.message
      : "An unexpected error occurred. Please try again or contact support.";

  return NextResponse.json(
    { error: userMessage, errorRef: errorId },
    { status: 500 }
  );
}
