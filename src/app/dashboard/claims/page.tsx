import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { claimStatusVariant } from "@/lib/status-badge";
import { resolveClientName } from "@/lib/client-name";
import { formatDate } from "@/lib/date";
import { CLAIM_STATUS_LABELS as STATUS_LABELS } from "./claim-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ListPageHeader } from "@/components/list-page-header";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  BulkSelectionProvider,
  BulkSelectCheckbox,
  BulkSelectAllCheckbox,
} from "@/components/bulk-selection";
import { BulkStatusBar } from "@/components/bulk-status-bar";
import { bulkUpdateClaimStatus } from "./actions";
import { ClickableRow } from "@/components/clickable-row";
import { SortableHeader } from "@/components/sortable-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 20;

// Two-hop joins (claims -> policies -> clients) can't be ordered by via a
// single .order({ referencedTable }) call, so Συμβόλαιο/Πελάτης stay
// unsortable — everything else on the claims table itself is fair game.
const SORTABLE_COLUMNS: Record<string, { column: string }> = {
  q: { column: "claim_number" },
  date_of_loss: { column: "date_of_loss" },
  claim_amount_estimated: { column: "claim_amount_estimated" },
  status: { column: "status" },
};

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    open?: string;
    policy?: string;
    date_from?: string;
    date_to?: string;
    amount_from?: string;
    amount_to?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const {
    q,
    status,
    open,
    policy,
    date_from: dateFrom,
    date_to: dateTo,
    amount_from: amountFrom,
    amount_to: amountTo,
    sort,
    dir,
    page: pageParam,
  } = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(pageParam) || 1);

  let query = supabase
    .from("claims")
    .select(
      "id, claim_number, file_number, injured_party_name, status, date_of_loss, claim_amount_estimated, policies!inner(policy_number, clients(client_individuals(first_name,last_name), client_legal_entities(company_name)))",
      { count: "exact" },
    );

  const sortable = sort ? SORTABLE_COLUMNS[sort] : undefined;
  query = sortable
    ? query.order(sortable.column, { ascending: dir !== "desc" })
    : query.order("date_of_loss", { ascending: false });

  if (q) query = query.ilike("claim_number", `%${q}%`);
  if (status) query = query.eq("status", status);
  else if (open) query = query.not("status", "in", "(paid,closed)");
  if (policy) query = query.ilike("policies.policy_number", `%${policy}%`);
  if (dateFrom) query = query.gte("date_of_loss", dateFrom);
  if (dateTo) query = query.lte("date_of_loss", dateTo);
  if (amountFrom) query = query.gte("claim_amount_estimated", Number(amountFrom));
  if (amountTo) query = query.lte("claim_amount_estimated", Number(amountTo));

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data: claims, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (status) exportParams.set("status", status);
  if (open) exportParams.set("open", open);
  if (policy) exportParams.set("policy", policy);
  if (dateFrom) exportParams.set("date_from", dateFrom);
  if (dateTo) exportParams.set("date_to", dateTo);
  if (amountFrom) exportParams.set("amount_from", amountFrom);
  if (amountTo) exportParams.set("amount_to", amountTo);

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader
        title="Ζημιές"
        filterBanner={
          open && !status ? { label: "Μόνο ανοιχτές ζημιές", clearHref: "/dashboard/claims" } : undefined
        }
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/dashboard/claims/export?${exportParams.toString()}`}>Εξαγωγή</a>}
          />
        }
      />

      <BulkSelectionProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <BulkSelectAllCheckbox ids={(claims ?? []).map((c) => c.id)} />
              </TableHead>
              <TableHead>
                <SortableHeader sortKey="q" label="Αριθμός ζημιάς" />
              </TableHead>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>
                <SortableHeader sortKey="date_of_loss" label="Ημ. ζημιάς" />
              </TableHead>
              <TableHead>
                <SortableHeader sortKey="claim_amount_estimated" label="Εκτιμώμενο ποσό" />
              </TableHead>
              <TableHead>
                <SortableHeader sortKey="status" label="Κατάσταση" />
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <Input
                  form="claim-filters"
                  name="q"
                  placeholder="Αριθμός ζημιάς..."
                  defaultValue={q ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <Input
                  form="claim-filters"
                  name="policy"
                  placeholder="Συμβόλαιο..."
                  defaultValue={policy ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <div className="flex items-center gap-1">
                  <Input
                    aria-label="Από"
                    form="claim-filters"
                    name="date_from"
                    type="date"
                    defaultValue={dateFrom ?? ""}
                    className="h-7 text-xs"
                  />
                  <Input
                    aria-label="Έως"
                    form="claim-filters"
                    name="date_to"
                    type="date"
                    defaultValue={dateTo ?? ""}
                    className="h-7 text-xs"
                  />
                </div>
              </TableHead>
              <TableHead className="pb-2">
                <div className="flex items-center gap-1">
                  <Input
                    aria-label="Από"
                    form="claim-filters"
                    name="amount_from"
                    type="number"
                    step="0.01"
                    placeholder="Από"
                    defaultValue={amountFrom ?? ""}
                    className="h-7 text-xs"
                  />
                  <Input
                    aria-label="Έως"
                    form="claim-filters"
                    name="amount_to"
                    type="number"
                    step="0.01"
                    placeholder="Έως"
                    defaultValue={amountTo ?? ""}
                    className="h-7 text-xs"
                  />
                </div>
              </TableHead>
              <TableHead className="pb-2">
                <FilterSelect
                  form="claim-filters"
                  name="status"
                  defaultValue={status ?? ""}
                  allLabel="Όλες οι καταστάσεις"
                  options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ id: value, label }))}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims?.length ? (
              claims.map((claim) => {
                const policy = claim.policies as unknown as {
                  policy_number: string;
                  clients: {
                    client_individuals: { first_name: string; last_name: string } | null;
                    client_legal_entities: { company_name: string } | null;
                  } | null;
                } | null;
                const name = resolveClientName(policy?.clients);

                return (
                  <ClickableRow key={claim.id} href={`/dashboard/claims/${claim.id}`}>
                    <TableCell>
                      <BulkSelectCheckbox id={claim.id} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/claims/${claim.id}`} className="hover:underline">
                        {claim.claim_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{policy?.policy_number ?? "—"}</TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>{formatDate(claim.date_of_loss)}</TableCell>
                    <TableCell>
                      {claim.claim_amount_estimated != null
                        ? `${claim.claim_amount_estimated.toFixed(2)} €`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={claimStatusVariant(claim.status)}>
                        {STATUS_LABELS[claim.status] ?? claim.status}
                      </Badge>
                    </TableCell>
                  </ClickableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Δεν βρέθηκαν ζημιές.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <BulkStatusBar
        statusOptions={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        applyAction={bulkUpdateClaimStatus}
        exportBasePath="/dashboard/claims/export"
      />
      </BulkSelectionProvider>

      <form id="claim-filters" className="flex flex-wrap items-center justify-between gap-3">
        {open && <input type="hidden" name="open" value={open} />}
        <Button type="submit" variant="secondary" size="sm">
          Εφαρμογή φίλτρων
        </Button>
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/dashboard/claims"
          searchParams={{
            q,
            status,
            open,
            policy,
            date_from: dateFrom,
            date_to: dateTo,
            amount_from: amountFrom,
            amount_to: amountTo,
            sort,
            dir,
          }}
        />
      </form>
    </div>
  );
}
