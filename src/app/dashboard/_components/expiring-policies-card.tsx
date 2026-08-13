import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveClientName } from "@/lib/client-name";
import { addDays, formatDate } from "./date-utils";

export async function ExpiringPoliciesCard() {
  const supabase = await createClient();
  const in30Days = addDays(30);
  const { data: expiringPolicies } = await supabase
    .from("policies")
    .select("id, policy_number, end_date, clients(client_individuals(first_name,last_name), client_legal_entities(company_name))")
    .in("status", ["active", "pending_renewal"])
    .eq("is_current_term", true)
    .lte("end_date", in30Days)
    .order("end_date", { ascending: true })
    .limit(8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Συμβόλαια που λήγουν σύντομα</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {expiringPolicies?.length ? (
          expiringPolicies.map((policy) => {
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
                <Badge variant="outline">{formatDate(policy.end_date)}</Badge>
              </Link>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">Καμία λήξη τις επόμενες 30 ημέρες.</p>
        )}
      </CardContent>
    </Card>
  );
}
