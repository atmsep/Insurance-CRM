import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/date";

export type ActivityEntry = {
  id: string;
  description: string;
  created_at: string;
  agency_users: { full_name: string } | null;
};

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Δραστηριότητα</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entries.length ? (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
            >
              <div>
                <p>{entry.description}</p>
                <p className="text-xs text-muted-foreground">{entry.agency_users?.full_name ?? "—"}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {formatDateTime(entry.created_at)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Καμία καταγεγραμμένη δραστηριότητα.</p>
        )}
      </CardContent>
    </Card>
  );
}
