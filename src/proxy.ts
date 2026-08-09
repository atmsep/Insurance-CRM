import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // /api/cron/* is excluded: it's called by Vercel Cron (no user session,
  // never a browser) and authenticates itself via CRON_SECRET instead.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
