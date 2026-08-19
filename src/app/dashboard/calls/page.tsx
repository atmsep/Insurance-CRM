import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ListPageHeader } from "@/components/list-page-header";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/date";
import { updateCallNotes, resolveIncomingCallForm } from "./actions";
import { SortableHeader } from "@/components/sortable-header";

const PAGE_SIZE = 30;
const FILTERS_FORM_ID = "calls-filters";

const SORTABLE_COLUMNS: Record<string, { column: string }> = {
  created_at: { column: "created_at" },
  q: { column: "phone_number" },
  client: { column: "client_name" },
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    client?: string;
    matched?: string;
    date_from?: string;
    date_to?: string;
    notes?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const {
    page: pageParam,
    q,
    client,
    matched,
    date_from: dateFrom,
    date_to: dateTo,
    notes,
    sort,
    dir,
  } = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(pageParam) || 1);

  let query = supabase
    .from("incoming_calls")
    .select(
      "id, phone_number, client_id, client_name, notes, needs_disambiguation, candidate_clients, created_at",
      { count: "exact" },
    );

  const sortable = sort ? SORTABLE_COLUMNS[sort] : undefined;
  query = sortable
    ? query.order(sortable.column, { ascending: dir !== "desc" })
    : query.order("created_at", { ascending: false });

  if (q) query = query.ilike("phone_number", `%${q}%`);
  if (client) query = query.ilike("client_name", `%${client}%`);
  if (matched === "yes") query = query.not("client_id", "is", null);
  else if (matched === "no") query = query.is("client_id", null);
  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
  if (notes) query = query.ilike("notes", `%${notes}%`);

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data: calls, count } = await query;

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader title="Κλήσεις" />

      <form
        id={FILTERS_FORM_ID}
        className="flex flex-wrap items-end gap-3 rounded-md border p-3"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="q">Τηλέφωνο</Label>
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Αναζήτηση αριθμού..." className="w-40" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="client">Πελάτης</Label>
          <Input id="client" name="client" defaultValue={client ?? ""} placeholder="Όνομα πελάτη..." className="w-56" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Κατάσταση</Label>
          <FilterSelect
            form={FILTERS_FORM_ID}
            name="matched"
            defaultValue={matched ?? ""}
            allLabel="Όλες"
            options={[
              { id: "yes", label: "Με πελάτη" },
              { id: "no", label: "Άγνωστες" },
            ]}
            className="h-8 w-40 text-sm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="date_from">Από</Label>
          <Input id="date_from" name="date_from" type="date" defaultValue={dateFrom ?? ""} className="w-40" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="date_to">Έως</Label>
          <Input id="date_to" name="date_to" type="date" defaultValue={dateTo ?? ""} className="w-40" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Σημείωση</Label>
          <Input id="notes" name="notes" defaultValue={notes ?? ""} placeholder="Αναζήτηση σημείωσης..." className="w-56" />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Εφαρμογή φίλτρων
        </Button>
        {(q || client || matched || dateFrom || dateTo || notes) && (
          <Button type="button" variant="ghost" size="sm" nativeButton={false} render={<Link href="/dashboard/calls">Καθαρισμός</Link>} />
        )}
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortableHeader sortKey="created_at" label="Ημ/νία" />
              </TableHead>
              <TableHead>
                <SortableHeader sortKey="q" label="Τηλέφωνο" />
              </TableHead>
              <TableHead>
                <SortableHeader sortKey="client" label="Πελάτης" />
              </TableHead>
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
                    {call.needs_disambiguation && call.candidate_clients?.length ? (
                      <div className="flex flex-col gap-1.5">
                        <Badge variant="outline">Ασαφής αντιστοίχιση — ποιος ήταν;</Badge>
                        <div className="flex flex-wrap gap-1">
                          {call.candidate_clients.map((c: { id: string; display_name: string }) => (
                            <form key={c.id} action={resolveIncomingCallForm.bind(null, call.id, c.id)}>
                              <Button type="submit" size="sm" variant="outline">
                                {c.display_name}
                              </Button>
                            </form>
                          ))}
                        </div>
                      </div>
                    ) : call.client_id && call.client_name ? (
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

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/dashboard/calls"
        searchParams={{ q, client, matched, date_from: dateFrom, date_to: dateTo, notes, sort, dir }}
      />
    </div>
  );
}
