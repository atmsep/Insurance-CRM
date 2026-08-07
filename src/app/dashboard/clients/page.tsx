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
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select(
      "id, client_type, afm, phone_mobile, address_city, is_active, client_individuals(first_name,last_name), client_legal_entities(company_name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (q) {
    query = query.or(`afm.ilike.%${q}%`);
  }

  const { data: clients } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Πελάτες</h1>
        <Button nativeButton={false} render={<Link href="/dashboard/clients/new">Νέος πελάτης</Link>} />
      </div>

      <form className="max-w-sm">
        <Input name="q" placeholder="Αναζήτηση με ΑΦΜ..." defaultValue={q ?? ""} />
      </form>

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
                    <Badge variant={client.is_active ? "default" : "outline"}>
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
    </div>
  );
}
