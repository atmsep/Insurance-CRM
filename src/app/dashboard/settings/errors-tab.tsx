import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/date";

type ErrorEntry = {
  id: string;
  context: string;
  message: string;
  url: string | null;
  created_at: string;
};

export function ErrorsTab({ errors }: { errors: ErrorEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Πρόσφατα σφάλματα</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ημ/νία</TableHead>
              <TableHead>Πλαίσιο</TableHead>
              <TableHead>Μήνυμα</TableHead>
              <TableHead>Σελίδα</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.length ? (
              errors.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.context}</TableCell>
                  <TableCell className="max-w-md truncate" title={e.message}>
                    {e.message}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground" title={e.url ?? ""}>
                    {e.url ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Δεν έχουν καταγραφεί σφάλματα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
