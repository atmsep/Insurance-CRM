import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/date";

type Call = {
  id: string;
  phone_number: string;
  notes: string | null;
  created_at: string;
};

export function CallsTab({
  calls,
  updateNotesAction,
}: {
  calls: Call[];
  updateNotesAction: (callId: string, formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Κλήσεις</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ημ/νία</TableHead>
              <TableHead>Τηλέφωνο</TableHead>
              <TableHead>Σημείωση (τι ειπώθηκε)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.length ? (
              calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(call.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{call.phone_number}</TableCell>
                  <TableCell>
                    <form action={updateNotesAction.bind(null, call.id)} className="flex items-center gap-2">
                      <Input
                        name="notes"
                        defaultValue={call.notes ?? ""}
                        placeholder="Προαιρετικό — τι ειπώθηκε στην κλήση"
                        className="w-full min-w-64"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Αποθ.
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Δεν υπάρχουν καταγεγραμμένες κλήσεις.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
