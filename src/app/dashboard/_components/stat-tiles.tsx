import { createClient } from "@/lib/supabase/server";
import { StatTile } from "./stat-tile";
import { addDays, todayISO } from "./date-utils";
import { athensDayStartUtc } from "@/lib/date";

export async function ActivePoliciesTile() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("policies")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("is_current_term", true);
  return <StatTile label="Ενεργά συμβόλαια" value={count ?? 0} href="/dashboard/policies?status=active" />;
}

export async function PendingTasksTile() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return <StatTile label="Εκκρεμείς υπενθυμίσεις" value={count ?? 0} href="/dashboard/tasks" />;
}

export async function ExpiringTile() {
  const supabase = await createClient();
  const in30Days = addDays(30);
  // Real total for the stat tile — the preview list caps at 8 rows, so its
  // .length can't be reused as the count.
  const { count } = await supabase
    .from("policies")
    .select("id", { count: "exact", head: true })
    .in("status", ["active", "pending_renewal"])
    .eq("is_current_term", true)
    .lte("end_date", in30Days);
  const expiringCount = count ?? 0;
  return (
    <StatTile
      label="Λήγουν σε 30 ημέρες"
      value={expiringCount}
      tone={expiringCount > 0 ? "warning" : "neutral"}
      href="/dashboard/policies?expiring=30"
    />
  );
}

export async function RecentlyExpiredTile() {
  const supabase = await createClient();
  const since30Days = addDays(-30);
  const today = todayISO();
  // Same filter as RecentlyExpiredPoliciesCard/the "recently_expired" list
  // filter — is_current_term + a raw end_date window rather than trusting
  // the daily auto-status recompute alone.
  const { count } = await supabase
    .from("policies")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(cancelled,lapsed,draft)")
    .eq("is_current_term", true)
    .gte("end_date", since30Days)
    .lt("end_date", today);
  const recentlyExpiredCount = count ?? 0;
  return (
    <StatTile
      label="Ληγμένα χωρίς ανανέωση"
      value={recentlyExpiredCount}
      tone={recentlyExpiredCount > 0 ? "warning" : "neutral"}
      href="/dashboard/policies?recently_expired=30"
    />
  );
}

export async function OpenClaimsTile() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(paid,closed)");
  const openClaimsCount = count ?? 0;
  return (
    <StatTile
      label="Ανοιχτές ζημιές"
      value={openClaimsCount}
      tone={openClaimsCount > 0 ? "warning" : "neutral"}
      href="/dashboard/claims?open=1"
    />
  );
}

export async function OpenTicketsTile() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("client_tickets")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(resolved,closed)");
  const openTicketsCount = count ?? 0;
  return (
    <StatTile
      label="Ανοιχτά αιτήματα"
      value={openTicketsCount}
      tone={openTicketsCount > 0 ? "warning" : "neutral"}
      href="/dashboard/tickets?open=1"
    />
  );
}

export async function TodayCallsTile() {
  const supabase = await createClient();
  // Athens calendar day, not the server's UTC one — otherwise the tile
  // resets at 02:00/03:00 τοπική and early-morning calls land on "χθες".
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
  const { count } = await supabase
    .from("incoming_calls")
    .select("id", { count: "exact", head: true })
    .gte("created_at", athensDayStartUtc(today));
  return <StatTile label="Κλήσεις σήμερα" value={count ?? 0} href="/dashboard/calls" />;
}
