import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RelatedMemberForm, RELATIONSHIP_LABELS } from "./related-member-form";

// referred_by_client_id/Συστάσεις in this codebase already established the
// pattern this mirrors: one directional link, reverse side surfaced via a
// query with an inverted label instead of a second stored row that could
// drift out of sync with the original.
const INVERSE_RELATIONSHIP: Record<string, string> = {
  spouse: "spouse",
  child: "parent",
  parent: "child",
  sibling: "sibling",
  other: "other",
};

type OwnedMember = {
  id: string;
  relationship_type: string;
  related_client: { id: string; display_name: string | null } | null;
};

type ReverseMember = {
  id: string;
  relationship_type: string;
  owner: { id: string; display_name: string | null } | null;
};

export function RelatedMembersTab({
  clientId,
  ownedMembers,
  reverseMembers,
  addAction,
  removeAction,
}: {
  clientId: string;
  ownedMembers: OwnedMember[];
  reverseMembers: ReverseMember[];
  addAction: (formData: FormData) => Promise<{ error: string } | undefined>;
  removeAction: (memberId: string) => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Συσχετιζόμενα μέλη</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Μέλη που πρόσθεσες</h3>
          {ownedMembers.length ? (
            <ul className="flex flex-col gap-2">
              {ownedMembers.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>
                    {m.related_client ? (
                      <Link href={`/dashboard/clients/${m.related_client.id}`} className="hover:underline">
                        {m.related_client.display_name ?? "—"}
                      </Link>
                    ) : (
                      "—"
                    )}{" "}
                    <Badge variant="outline">{RELATIONSHIP_LABELS[m.relationship_type] ?? m.relationship_type}</Badge>
                  </span>
                  <form action={() => removeAction(m.id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      Αφαίρεση
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Δεν έχεις προσθέσει συσχετιζόμενα μέλη.</p>
          )}
        </div>

        {reverseMembers.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Συνδέεται ως</h3>
            <ul className="flex flex-col gap-2">
              {reverseMembers.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  {m.owner ? (
                    <Link href={`/dashboard/clients/${m.owner.id}`} className="hover:underline">
                      {m.owner.display_name ?? "—"}
                    </Link>
                  ) : (
                    "—"
                  )}
                  <Badge variant="outline">
                    {RELATIONSHIP_LABELS[INVERSE_RELATIONSHIP[m.relationship_type] ?? m.relationship_type] ??
                      m.relationship_type}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Προσθήκη νέου μέλους</h3>
          <RelatedMemberForm clientId={clientId} addAction={addAction} />
        </div>
      </CardContent>
    </Card>
  );
}
