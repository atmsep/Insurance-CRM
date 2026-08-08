import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 20;

function clientName(client: {
  client_type: string;
  client_individuals: { first_name: string; last_name: string } | null;
  client_legal_entities: { company_name: string } | null;
}) {
  if (client.client_type === "individual" && client.client_individuals) {
    return `${client.client_individuals.first_name} ${client.client_individuals.last_name}`;
  }
  return client.client_legal_entities?.company_name ?? "—";
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    name?: string;
    afm?: string;
    phone?: string;
    city?: string;
    show_inactive?: string;
    page?: string;
  }>;
}) {
  const { name, afm, phone, city, show_inactive, page: pageParam } = await searchParams;
  const showInactive = show_inactive === "1";
  const supabase = await createClient();
  const page = Math.max(1, Number(pageParam) || 1);

  let query = supabase
    .from("clients")
    .select(
      "id, client_type, afm, phone_mobile, address_city, is_active, client_individuals(first_name,last_name), client_legal_entities(company_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (!showInactive) query = query.eq("is_active", true);
  if (name) query = query.ilike("display_name", `%${name}%`);
  if (afm) query = query.ilike("afm", `%${afm}%`);
  if (phone) query = query.ilike("phone_mobile", `%${phone}%`);
  if (city) query = query.ilike("address_city", `%${city}%`);

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data: clients, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const exportParams = new URLSearchParams();
  if (name) exportParams.set("name", name);
  if (afm) exportParams.set("afm", afm);
  if (phone) exportParams.set("phone", phone);
  if (city) exportParams.set("city", city);
  if (showInactive) exportParams.set("show_inactive", "1");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Πελάτες</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/dashboard/clients/export?${exportParams.toString()}`}>Εξαγωγή</a>}
          />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/clients/import">Εισαγωγή από CSV</Link>}
          />
          <Button nativeButton={false} render={<Link href="/dashboard/clients/new">Νέος πελάτης</Link>} />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ονομα / Επωνυμία</TableHead>
              <TableHead>ΑΦΜ</TableHead>
              <TableHead>Τηλέφωνο</TableHead>
              <TableHead>Πόλη</TableHead>
              <TableHead>Κατάσταση</TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="pb-2">
                <Input
                  form="client-filters"
                  name="name"
                  placeholder="Όνομα..."
                  defaultValue={name ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <Input
                  form="client-filters"
                  name="afm"
                  placeholder="ΑΦΜ..."
                  defaultValue={afm ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <Input
                  form="client-filters"
                  name="phone"
                  placeholder="Τηλέφωνο..."
                  defaultValue={phone ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <Input
                  form="client-filters"
                  name="city"
                  placeholder="Πόλη..."
                  defaultValue={city ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    form="client-filters"
                    type="checkbox"
                    name="show_inactive"
                    value="1"
                    defaultChecked={showInactive}
                    className="size-3.5"
                  />
                  Ανενεργοί
                </label>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients?.length ? (
              clients.map((client) => (
                <TableRow key={client.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">
                      {clientName(client as never)}
                    </Link>
                  </TableCell>
                  <TableCell>{client.afm ?? "—"}</TableCell>
                  <TableCell>{client.phone_mobile ?? "—"}</TableCell>
                  <TableCell>{client.address_city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={client.is_active ? "success" : "outline"}>
                      {client.is_active ? "Ενεργός" : "Ανενεργός"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Δεν βρέθηκαν πελάτες.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form id="client-filters" className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" variant="secondary" size="sm">
          Εφαρμογή φίλτρων
        </Button>
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/dashboard/clients"
          searchParams={{ name, afm, phone, city, show_inactive }}
        />
      </form>
    </div>
  );
}
