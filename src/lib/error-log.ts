import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Writes with the admin client (bypasses RLS) so logging itself can never
// fail because of the acting user's own permissions — the whole point is
// to capture failures reliably, including ones RLS would otherwise hide.
export async function logError(
  context: string,
  error: unknown,
  extra?: { actorId?: string; url?: string },
) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? null) : null;

  try {
    const supabase = createAdminClient();
    await supabase.from("error_log").insert({
      context,
      message,
      stack,
      actor_id: extra?.actorId ?? null,
      url: extra?.url ?? null,
    });
  } catch (loggingError) {
    // Logging must never be the thing that crashes a request — fall back
    // to stdout, which Vercel still captures.
    console.error("Failed to write to error_log:", loggingError);
  }

  console.error(`[${context}]`, error);
}
