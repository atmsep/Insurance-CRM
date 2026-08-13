import { createClient } from "@/lib/supabase/server";
import { StatTile } from "./stat-tile";
import { addDays, todayISO } from "./date-utils";

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

export async function OutstandingTile() {
  const supabase = await createClient();
  // The plain joined count (policy_installments -> policies!inner) hit a
  // real statement timeout under an authenticated session once
  // policy_installments grew to ~39,700 rows, and supabase-js silently
  // returns count: null on error — which this tile then rendered as "0",
  // hiding a genuine timeout as "nothing outstanding". installments_worklist_count
  // (migration 0065) already does this exact count as a security-definer
  // RPC with the equivalent agent/admin scoping and is used by the
  // Ανείσπρακτα page itself — reused here instead of the raw query.
  const { data: count } = (await supabase.rpc("installments_worklist_count")) as unknown as {
    data: number | null;
  };
  const outstanding = count ?? 0;
  return (
    <StatTile
      label="Ανείσπρακτα"
      value={outstanding}
      tone={outstanding > 0 ? "critical" : "neutral"}
      href="/dashboard/installments"
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
  const today = todayISO();
  const { count } = await supabase
    .from("incoming_calls")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${today}T00:00:00.000Z`);
  return <StatTile label="Κλήσεις σήμερα" value={count ?? 0} href="/dashboard/calls" />;
}
