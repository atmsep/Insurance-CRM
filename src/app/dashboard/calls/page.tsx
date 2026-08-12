import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ListPageHeader } from "@/components/list-page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/date";
import { updateCallNotes } from "./actions";

const PAGE_SIZE = 30;

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(pageParam) || 1);

  const from = (page - 1) * PAGE_SIZE;
  const { data: calls, count } = await supabase
    .from("incoming_calls")
    .select("id, phone_number, client_id, client_name, notes, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader title="Κλήσεις" />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ημ/νία</TableHead>
              <TableHead>Τηλέφωνο</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Σημείωση (τι ειπώθηκε)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls?.length ? (
              calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(call.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{call.phone_number}</TableCell>
                  <TableCell>
                    {call.client_id && call.client_name ? (
                      <Link href={`/dashboard/clients/${call.client_id}`} className="hover:underline">
                        {call.client_name}
                      </Link>
                    ) : (
                      <Badge variant="outline">Άγνωστη κλήση</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <form action={updateCallNotes.bind(null, call.id)} className="flex items-center gap-2">
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
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Δεν υπάρχουν καταγεγραμμένες κλήσεις.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/dashboard/calls" searchParams={{}} />
    </div>
  );
}
