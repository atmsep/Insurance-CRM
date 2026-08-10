import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InteractionTypeSelect } from "../../interaction-type-select";
import { INTERACTION_TYPE_LABELS } from "../../interaction-labels";
import { formatDateTime } from "@/lib/date";

type Interaction = {
  id: string;
  interaction_type: string;
  subject: string | null;
  notes: string | null;
  interaction_date: string;
  follow_up_needed: boolean;
};

export function InteractionsTab({
  interactions,
  addInteractionAction,
}: {
  interactions: Interaction[];
  addInteractionAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Επικοινωνία</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ημ/νία</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Θέμα</TableHead>
              <TableHead>Σημειώσεις</TableHead>
              <TableHead>Follow-up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {interactions.length ? (
              interactions.map((interaction) => (
                <TableRow key={interaction.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(interaction.interaction_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {INTERACTION_TYPE_LABELS[interaction.interaction_type] ?? interaction.interaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{interaction.subject ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{interaction.notes ?? "—"}</TableCell>
                  <TableCell>{interaction.follow_up_needed ? "Ναι" : "—"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Δεν υπάρχει ιστορικό επικοινωνίας.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <form action={addInteractionAction} className="flex flex-wrap items-end gap-3">
          <InteractionTypeSelect />
          <div className="flex flex-col gap-2">
            <Label htmlFor="subject">Θέμα</Label>
            <Input id="subject" name="subject" className="w-56" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes-interaction">Σημειώσεις</Label>
            <Input id="notes-interaction" name="notes" className="w-72" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="follow_up_needed" className="size-4" />
            Χρειάζεται follow-up
          </label>
          <Button type="submit" variant="secondary">
            Καταχώρηση
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
