import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveClientName } from "@/lib/client-name";
import { addDays, formatDate, todayISO } from "./date-utils";

// The auto-status recompute (policy_status_automation, migration 0046)
// already flips a policy to 'expired' once its end_date passes without a
// renewal — a renewal either updates this same row's end_date into the
// future (permanent-policy model) or, for a legacy chain, supersedes it
// with a new row and flips this one's is_current_term to false. Filtering
// directly on is_current_term + end_date (like ExpiringPoliciesCard does
// for the forward-looking case) rather than trusting status alone also
// catches a status_auto_managed=false row an admin pinned to 'active'
// despite its end_date having already passed.
export async function RecentlyExpiredPoliciesCard() {
  const supabase = await createClient();
  const since30Days = addDays(-30);
  const today = todayISO();
  const { data: recentlyExpired } = await supabase
    .from("policies")
    .select("id, policy_number, end_date, clients(client_individuals(first_name,last_name), client_legal_entities(company_name))")
    .not("status", "in", "(cancelled,lapsed,draft)")
    .eq("is_current_term", true)
    .gte("end_date", since30Days)
    .lt("end_date", today)
    .order("end_date", { ascending: true })
    .limit(8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ληγμένα χωρίς ανανέωση</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {recentlyExpired?.length ? (
          recentlyExpired.map((policy) => {
            const client = policy.clients as unknown as {
              client_individuals: { first_name: string; last_name: string } | null;
              client_legal_entities: { company_name: string } | null;
            } | null;
            const name = resolveClientName(client);
            return (
              <Link
                key={policy.id}
                href={`/dashboard/policies/${policy.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span>
                  {policy.policy_number} · {name}
                </span>
                <Badge variant="destructive">{formatDate(policy.end_date)}</Badge>
              </Link>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">Κανένα ληγμένο συμβόλαιο χωρίς ανανέωση τις τελευταίες 30 ημέρες.</p>
        )}
      </CardContent>
    </Card>
  );
}
