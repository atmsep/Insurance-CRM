import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // /api/cron/* and /api/incoming-call are excluded: both are called by
  // non-browser, non-session clients (Vercel Cron; the local Caller ID
  // agent) and authenticate themselves via a shared-secret bearer token
  // instead.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/incoming-call|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
