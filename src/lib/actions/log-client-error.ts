"use server";

import { logError } from "@/lib/error-log";
import { getCurrentAgencyUser } from "@/lib/dal";

// Called from the dashboard's error.tsx boundary — a render/client error
// has no server-side try/catch to log from, so the boundary reports it
// here instead.
export async function logClientError(message: string, digest: string | undefined, url: string) {
  const agencyUser = await getCurrentAgencyUser().catch(() => null);
  await logError("client-render", new Error(message + (digest ? ` (digest: ${digest})` : "")), {
    actorId: agencyUser?.id,
    url,
  });
}
