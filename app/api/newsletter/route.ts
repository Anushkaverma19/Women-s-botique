import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-response";

const schema = z.object({ email: z.string().trim().email() });

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const supabase = await createClient();
    const { error } = await supabase.from("newsletter_subscribers").insert({ email });
    // Ignore unique-violation (already subscribed) - treat as success so we
    // never reveal whether an email is already on the list.
    if (error && error.code !== "23505") {
      throw new Error("Could not subscribe right now.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
