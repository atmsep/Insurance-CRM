import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Centralizes the "who is logged in" check. Cached per request so multiple
// pages/components calling this don't re-issue the same queries.
export const getCurrentAgencyUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: agencyUser } = await supabase
    .from("agency_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  return agencyUser;
});

// Use in Server Components / Server Actions that require an authenticated
// agency user. Redirects to /login otherwise.
export async function requireAgencyUser() {
  const agencyUser = await getCurrentAgencyUser();
  if (!agencyUser) {
    redirect("/login");
  }
  return agencyUser;
}
