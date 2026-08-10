import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { policyStatusVariant } from "@/lib/status-badge";

const POLICY_STATUS_LABELS: Record<string, string> = {
  draft: "Πρόχειρο",
  active: "Ενεργό",
  pending_renewal: "Προς ανανέωση",
  expired: "Ληγμένο",
  cancelled: "Ακυρωμένο",
  lapsed: "Διακοπή",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

type Term = {
  id: string;
  renewal_number: number;
  start_date: string;
  end_date: string;
  status: string;
};

// Only rendered when a chain has more than one term — a policy that was
// never renewed has nothing here to show.
export function RenewalHistory({ currentPolicyId, terms }: { currentPolicyId: string; terms: Term[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ιστορικό ανανεώσεων</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {terms.map((term) => (
          <div
            key={term.id}
            className={`flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm ${
              term.id === currentPolicyId ? "bg-muted" : ""
            }`}
          >
            <span className="text-muted-foreground">
              #{term.renewal_number} · {formatDate(term.start_date)} – {formatDate(term.end_date)}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={policyStatusVariant(term.status)}>
                {POLICY_STATUS_LABELS[term.status] ?? term.status}
              </Badge>
              {term.id === currentPolicyId ? (
                <span className="text-xs text-muted-foreground">(τρέχουσα προβολή)</span>
              ) : (
                <Link href={`/dashboard/policies/${term.id}`} className="text-xs hover:underline">
                  Προβολή
                </Link>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
