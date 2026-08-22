import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPageHeader } from "@/components/list-page-header";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatDateTime } from "@/lib/date";
import { POLICY_MOVEMENT_KIND_LABELS } from "../../policies/movement-labels";
import {
  togglePremiumRemittance,
  toggleOutgoingCommissionRemittance,
  bulkRemitPremiums,
  bulkRemitOutgoingCommissions,
} from "../../policies/movements-actions";
import { getOutgoingCommissionsByMovement } from "../../reports/production/commissions";
import { ProductionFiltersPanel } from "../../reports/production/_components/production-filters-panel";
import { parsePerPage } from "../../policies/filters";
import { parseRemittanceFilters, applyRemittanceFilters } from "../filters";
import { BulkSelectionProvider, BulkSelectCheckbox, BulkSelectAllCheckbox } from "@/components/bulk-selection";
import { RemittanceBulkBar } from "./remittance-bulk-bar";
import { RemitRowButton } from "./remit-row-button";
import { ReceiptPrintLink } from "./receipt-print-link";

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type RemittanceMovementRow = {
  id: string;
  kind: string;
  document_number: string | null;
  issue_date: string;
  start_date: string;
  premium_net: number | null;
  premium_gross: number;
  policy_id: string;
  policies: SingleOrMany<{
    policy_number: string;
    risk_label: string | null;
    clients: SingleOrMany<{ display_name: string | null }>;
    agency_users: SingleOrMany<{ full_name: string }>;
    carriers: SingleOrMany<{ name: string }>;
    insurance_lines: SingleOrMany<{ name_el: string }>;
  }>;
};

// assigned_agent_id/carrier_id/insurance_line_id/status aren't displayed
// anywhere on this page — they're here purely so applyRemittanceFilters'
// dot-path filters have something to join against.
const MOVEMENT_SELECT =
  "id, kind, document_number, issue_date, start_date, premium_net, premium_gross, policy_id, " +
  "policies!inner(policy_number, risk_label, assigned_agent_id, carrier_id, insurance_line_id, status, " +
  "clients!inner(display_name), agency_users!policies_assigned_agent_id_fkey(full_name), carriers(name), insurance_lines(name_el))";

// Separate module-scope constants (not concatenated inline at the query
// call site) for the "Αποδοθέντα" view's two extra columns — inlining a
// template literal into .select() there blew up the PostgREST client's
// type inference (TS2589, excessively deep instantiation) on this
// already-embed-heavy select string.
const MOVEMENT_SELECT_PREMIUM_DONE = MOVEMENT_SELECT + ", premium_remitted_at";
const MOVEMENT_SELECT_COMMISSION_DONE = MOVEMENT_SELECT + ", outgoing_commission_remitted_at";

// Rows on this page are always the currently-unremitted ones (that's the
// whole point of a worklist), so the toggle here only ever goes one
// direction — these wrappers just fix currentlyRemitted=false and discard
// the {error} return, since a plain <form action> needs a void-returning
// server action.
async function remitPremium(movementId: string) {
  "use server";
  await togglePremiumRemittance(movementId, false);
}

async function remitCommission(movementId: string) {
  "use server";
  await toggleOutgoingCommissionRemittance(movementId, false);
}

// Mirror pair for the "Αποδοθέντα" (already-remitted) view below — every
// row there is already remitted, so these always undo (clear the
// timestamp back to null) rather than set it.
async function undoPremiumRemit(movementId: string) {
  "use server";
  await togglePremiumRemittance(movementId, true);
}

async function undoCommissionRemit(movementId: string) {
  "use server";
  await toggleOutgoingCommissionRemittance(movementId, true);
}

// Worklist for the two per-movement remittance toggles that already exist
// in the Απόδειξη dialog (togglePremiumRemittance/
// toggleOutgoingCommissionRemittance) — this page just aggregates every
// movement still missing one of them, instead of requiring an admin to
// open each policy's Κινήσεις tab one at a time to notice. Admin client for
// the same reason as the production report: policy_movements_select RLS
// has the identical per-row EXISTS-subquery shape that already caused two
// real statement timeouts elsewhere in this schema.
export type RemittanceKind = "premium" | "commission";

const RECEIPT_PATH = "/remittance-receipt";

export async function RemittancesView({
  kind,
  searchParams,
}: {
  kind: RemittanceKind;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const filters = parseRemittanceFilters(sp);
  const activeTab = kind;
  const isPremium = kind === "premium";
  const basePath = isPremium ? "/dashboard/remittances/premiums" : "/dashboard/remittances/commissions";
  const title = isPremium ? "Αποδόσεις Ασφαλίστρων" : "Αποδόσεις Προμηθειών";

  // Χωρίς διάστημα δεν φορτώνεται τίποτα: με 43.500 κινήσεις στη βάση, μια
  // αφιλτράριστη σελίδα κατέβαζε χιλιάδες γραμμές σε κάθε άνοιγμα.
  const hasRange = Boolean(
    filters.issueFrom || filters.issueTo || filters.startFrom || filters.startTo,
  );
  const remitStatus = sp.remit_status === "done" ? "done" : "pending";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = parsePerPage(sp.per_page);
  const admin = createAdminClient();

  const [{ data: agents }, { data: carriers }, { data: insuranceLines }] = await Promise.all([
    admin.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name"),
    admin.from("carriers").select("id, name").order("name"),
    admin.from("insurance_lines").select("id, name_el").order("sort_order"),
  ]);

  let premiumRows: (RemittanceMovementRow & { premium_remitted_at?: string })[] = [];
  let commissionRows: (RemittanceMovementRow & { commission: number; outgoing_commission_remitted_at?: string })[] =
    [];
  let premiumTotalPages = 1;
  let commissionTotalPages = 1;
  let premiumTotalCount = 0;
  let commissionTotalCount = 0;
  const uncollectedByMovement = new Map<string, number>();

  if (hasRange && remitStatus === "pending") {
    // PostgREST silently caps a response at 1000 rows — an unchunked fetch
    // here would quietly truncate the worklist (and its totals) once the
    // backlog grows past that, so page through explicitly. The id tiebreak
    // keeps the paging stable across equal issue_dates.
    const CHUNK = 1000;
    const MAX_WORKLIST_ROWS = 10000;
    const fetchAllPending = async (column: "premium_remitted_at" | "outgoing_commission_remitted_at") => {
      const rows: RemittanceMovementRow[] = [];
      for (let from = 0; from < MAX_WORKLIST_ROWS; from += CHUNK) {
        const { data } = await applyRemittanceFilters(
          admin.from("policy_movements").select(MOVEMENT_SELECT).is(column, null),
          filters,
        )
          .order("issue_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + CHUNK - 1);
        const batch = (data ?? []) as unknown as RemittanceMovementRow[];
        rows.push(...batch);
        if (batch.length < CHUNK) break;
      }
      return rows;
    };

    const [rawPremiumPending, commissionCandidates] = await Promise.all([
      fetchAllPending("premium_remitted_at"),
      fetchAllPending("outgoing_commission_remitted_at"),
    ]);

    premiumRows = rawPremiumPending;

    // Απόδοση ασφαλίστρων που δεν έχουν καν εισπραχθεί είναι σχεδόν πάντα
    // λάθος στιγμή — flag each pending movement's still-uncollected balance
    // so the worklist shows it next to the amount instead of hiding it.
    // Παράλληλα: με μεγάλο ιστορικό αυτά είναι δεκάδες ερωτήματα, και
    // σειριακά πρόσθεταν δεκάδες δευτερόλεπτα στη σελίδα.
    const idChunks: string[][] = [];
    for (let start = 0; start < premiumRows.length; start += 200) {
      idChunks.push(premiumRows.slice(start, start + 200).map((m) => m.id));
    }
    const instBatches = await Promise.all(
      idChunks.map((ids) =>
        admin.from("policy_installments").select("movement_id, amount, paid_amount").in("movement_id", ids),
      ),
    );
    for (const { data: insts } of instBatches) {
      for (const i of insts ?? []) {
        if (!i.movement_id) continue;
        const remaining = Math.max(i.amount - (i.paid_amount ?? 0), 0);
        uncollectedByMovement.set(i.movement_id, (uncollectedByMovement.get(i.movement_id) ?? 0) + remaining);
      }
    }

    // Only movements that actually carry a nonzero outgoing commission are
    // worth listing — matches the production report's own precedent for
    // resolving "Προμήθεια Συνεργάτη" (first-installment path for every kind
    // but cancellation, which attaches via policy_movement_id instead).
    const commissionByMovement = await getOutgoingCommissionsByMovement(
      admin,
      commissionCandidates.map((m) => ({ id: m.id, isReal: true })),
    );
    commissionRows = commissionCandidates
      .map((m) => ({ ...m, commission: commissionByMovement.get(m.id) ?? 0 }))
      .filter((m) => m.commission !== 0);
    premiumTotalCount = premiumRows.length;
    commissionTotalCount = commissionRows.length;
  } else if (hasRange) {
    // "Αποδοθέντα" — an audit trail of everything already marked remitted,
    // newest first. Unlike the pending worklist (always small — a remit
    // action removes the row) this only ever grows, so it's paginated;
    // and it deliberately does NOT drop zero-commission rows the way the
    // pending list does — a history view should show what was actually
    // marked done, not re-apply "was this worth remitting" hindsight.
    const from = (page - 1) * perPage;

    // Four applyRemittanceFilters calls in one function body (two count
    // queries, two row queries) push the PostgREST client's type inference
    // past TS's instantiation-depth limit (TS2589) — applyRemittanceFilters'
    // T extends FilterableQuery<T> constraint is fine once or twice per
    // scope, but not four times over against this page's already
    // embed-heavy select (policy_movements → policies → clients, plus
    // siblings). Routing through `any` here only affects these four
    // call sites' *type checking*; the filters still run identically at
    // runtime — applyRemittanceFilters' own body has no generic magic,
    // it's just a chain of .eq/.ilike/.in/.gte/.lte calls.
    const applyFiltersUnsafe = (query: unknown) => applyRemittanceFilters(query as never, filters);

    // head:true drops the response body (we only want the count), but the
    // select string still needs every embed applyRemittanceFilters' filters
    // dot-path through (policies, policies.clients, ...) — a flat "id"
    // select can't resolve those, and PostgREST was silently returning
    // count=0 for any filtered request instead of erroring.
    let premiumCountQuery = admin
      .from("policy_movements")
      .select(MOVEMENT_SELECT, { count: "exact", head: true })
      .not("premium_remitted_at", "is", null);
    premiumCountQuery = applyFiltersUnsafe(premiumCountQuery);

    let commissionCountQuery = admin
      .from("policy_movements")
      .select(MOVEMENT_SELECT, { count: "exact", head: true })
      .not("outgoing_commission_remitted_at", "is", null);
    commissionCountQuery = applyFiltersUnsafe(commissionCountQuery);

    let premiumQuery = admin
      .from("policy_movements")
      .select(MOVEMENT_SELECT_PREMIUM_DONE)
      .not("premium_remitted_at", "is", null);
    premiumQuery = applyFiltersUnsafe(premiumQuery);
    premiumQuery = premiumQuery.order("premium_remitted_at", { ascending: false }).range(from, from + perPage - 1);

    let commissionQuery = admin
      .from("policy_movements")
      .select(MOVEMENT_SELECT_COMMISSION_DONE)
      .not("outgoing_commission_remitted_at", "is", null);
    commissionQuery = applyFiltersUnsafe(commissionQuery);
    commissionQuery = commissionQuery
      .order("outgoing_commission_remitted_at", { ascending: false })
      .range(from, from + perPage - 1);

    const [
      { count: premiumCount },
      { count: commissionCount },
      { data: rawPremiumDone },
      { data: rawCommissionDone },
    ] = await Promise.all([premiumCountQuery, commissionCountQuery, premiumQuery, commissionQuery]);

    premiumRows = (rawPremiumDone ?? []) as unknown as (RemittanceMovementRow & { premium_remitted_at: string })[];
    const commissionDone = (rawCommissionDone ?? []) as unknown as (RemittanceMovementRow & {
      outgoing_commission_remitted_at: string;
    })[];
    const commissionByMovement = await getOutgoingCommissionsByMovement(
      admin,
      commissionDone.map((m) => ({ id: m.id, isReal: true })),
    );
    commissionRows = commissionDone.map((m) => ({ ...m, commission: commissionByMovement.get(m.id) ?? 0 }));

    premiumTotalCount = premiumCount ?? 0;
    commissionTotalCount = commissionCount ?? 0;
    premiumTotalPages = Math.max(1, Math.ceil(premiumTotalCount / perPage));
    commissionTotalPages = Math.max(1, Math.ceil(commissionTotalCount / perPage));
  }

  function renderTable<T extends RemittanceMovementRow>(opts: {
    rows: T[];
    // Η στήλη που αποδίδεται (μικτά ή προμήθεια) φοράει το badge· οι
    // υπόλοιπες είναι πληροφοριακές.
    amountLabel: string;
    getAmount: (m: T) => number;
    // Οι προμήθειες δείχνουν ΚΑΙ τα ασφάλιστρα της κίνησης, ώστε να
    // φαίνεται σε τι ποσό αντιστοιχεί η προμήθεια.
    showPremiums?: boolean;
    action: (movementId: string) => Promise<void>;
    bulkAction?: (movementIds: string[]) => Promise<{ error: string } | undefined>;
    bulkSuccessLabel?: string;
    mode: "pending" | "done";
    getRemittedAt?: (m: T) => string | null | undefined;
    getUncollected?: (m: T) => number;
    totalPages?: number;
  }) {
    const {
      rows,
      amountLabel,
      getAmount,
      showPremiums,
      action,
      bulkAction,
      bulkSuccessLabel,
      mode,
      getRemittedAt,
      getUncollected,
      totalPages,
    } = opts;
    const ids = rows.map((m) => m.id);
    // Τα ποσά ταξιδεύουν στη μπάρα ώστε να δείχνει το σύνολο ΤΩΝ ΕΠΙΛΕΓΜΕΝΩΝ
    // — αυτό είναι το ποσό που θα παραδοθεί, και πρέπει να φαίνεται πριν
    // πατηθεί η απόδοση, όχι μόνο πάνω στο έντυπο.
    const amountById: Record<string, number> = {};
    for (const m of rows) amountById[m.id] = getAmount(m);
    const listedTotal = rows.reduce((sum, m) => sum + getAmount(m), 0);

    const totalsBar = (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-2.5">
        <span className="text-sm text-muted-foreground">
          {rows.length} {mode === "pending" ? "εκκρεμείς" : "αποδοθείσες"} εγγραφές
          {mode === "done" && " σε αυτή τη σελίδα"}
        </span>
        <span className="text-sm">
          <span className="text-muted-foreground">
            {mode === "pending" ? `Σύνολο ${amountLabel.toLowerCase()}: ` : "Σύνολο σελίδας: "}
          </span>
          <span className="font-semibold tabular-nums">{listedTotal.toFixed(2)} €</span>
        </span>
      </div>
    );

    const table = (
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {mode === "pending" ? (
                <TableHead className="w-8">
                  <BulkSelectAllCheckbox ids={ids} />
                </TableHead>
              ) : (
                <TableHead>Αποδόθηκε</TableHead>
              )}
              <TableHead>Έκδοση</TableHead>
              <TableHead>Έναρξη</TableHead>
              <TableHead>Είδος</TableHead>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Χαρακτηριστικό</TableHead>
              <TableHead>Κλάδος</TableHead>
              <TableHead>Εταιρεία</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead className="text-right">Καθαρά</TableHead>
              {showPremiums && <TableHead className="text-right">Μικτά</TableHead>}
              <TableHead>{amountLabel}</TableHead>
              <TableHead>Συνεργάτης</TableHead>
              <TableHead />
            </TableRow>
            <TableRow>
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <Input
                  form="remittances-filters"
                  name="policy_number"
                  placeholder="Συμβόλαιο..."
                  defaultValue={filters.policyNumber ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <Input
                  form="remittances-filters"
                  name="risk"
                  placeholder="Χαρακτηριστικό..."
                  defaultValue={filters.risk ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <Input
                  form="remittances-filters"
                  name="client"
                  placeholder="Πελάτης..."
                  defaultValue={filters.clientName ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              {showPremiums && <TableHead className="pb-2" />}
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((m) => {
                const policy = one(m.policies);
                const client = one(policy?.clients ?? null);
                const agent = one(policy?.agency_users ?? null);
                const carrier = one(policy?.carriers ?? null);
                const line = one(policy?.insurance_lines ?? null);
                return (
                  <TableRow key={m.id}>
                    {mode === "pending" ? (
                      <TableCell>
                        <BulkSelectCheckbox id={m.id} />
                      </TableCell>
                    ) : (
                      <TableCell className="text-muted-foreground">
                        {getRemittedAt?.(m) ? formatDateTime(getRemittedAt(m)!) : "—"}
                      </TableCell>
                    )}
                    <TableCell>{formatDate(m.issue_date)}</TableCell>
                    <TableCell>{formatDate(m.start_date)}</TableCell>
                    <TableCell>{POLICY_MOVEMENT_KIND_LABELS[m.kind] ?? m.kind}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/policies/${m.policy_id}`} className="hover:underline">
                        {policy?.policy_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{policy?.risk_label ?? "—"}</TableCell>
                    <TableCell>{line?.name_el ?? "—"}</TableCell>
                    <TableCell>{carrier?.name ?? "—"}</TableCell>
                    <TableCell>{client?.display_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.premium_net != null ? `${m.premium_net.toFixed(2)} €` : "—"}
                    </TableCell>
                    {showPremiums && (
                      <TableCell className="text-right tabular-nums">{m.premium_gross.toFixed(2)} €</TableCell>
                    )}
                    <TableCell>
                      <Badge variant={mode === "pending" ? "warning" : "success"}>
                        {getAmount(m).toFixed(2)} €
                      </Badge>
                      {(() => {
                        const uncollected = getUncollected?.(m) ?? 0;
                        return uncollected > 0 ? (
                          <p className="mt-1 text-xs text-destructive">
                            Ανείσπρακτο {uncollected.toFixed(2)} €
                          </p>
                        ) : null;
                      })()}
                    </TableCell>
                    <TableCell>{agent?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      {mode === "pending" ? (
                        <RemitRowButton
                          movementId={m.id}
                          action={action}
                          receiptHref={`${RECEIPT_PATH}?kind=${kind}&ids=${m.id}`}
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <form action={action.bind(null, m.id)}>
                            <Button type="submit" size="sm" variant="outline">
                              Αναίρεση
                            </Button>
                          </form>
                          {/* Επανεκτύπωση: η απόδειξη δεν εξαρτάται από την ενέργεια. */}
                          <ReceiptPrintLink href={`${RECEIPT_PATH}?kind=${kind}&ids=${m.id}`} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={showPremiums ? 14 : 13} className="text-center text-muted-foreground">
                  {mode === "pending" ? "Δεν υπάρχουν εκκρεμείς αποδόσεις." : "Δεν υπάρχουν αποδοθέντα."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );

    if (mode === "done") {
      return (
        <div className="flex flex-col gap-3">
          {totalsBar}
          {table}
          <Pagination
            page={page}
            totalPages={totalPages ?? 1}
            basePath={basePath}
            searchParams={{
              tab: activeTab,
              remit_status: "done",
              per_page: sp.per_page,
              policy_number: filters.policyNumber,
              risk: filters.risk,
              client: filters.clientName,
              agent: filters.agentIds?.join(","),
              carrier: filters.carrierId,
              line: filters.lineId,
              kind: filters.kinds?.join(","),
              status: filters.status,
              issue_from: filters.issueFrom,
              issue_to: filters.issueTo,
              start_from: filters.startFrom,
              start_to: filters.startTo,
            }}
          />
        </div>
      );
    }

    return (
      <BulkSelectionProvider>
        <div className="flex flex-col gap-3">
          {totalsBar}
          {table}
          {bulkAction && bulkSuccessLabel && (
            <RemittanceBulkBar
              action={bulkAction}
              successLabel={bulkSuccessLabel}
              receiptKind={kind}
              amountById={amountById}
            />
          )}
        </div>
      </BulkSelectionProvider>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader title={title} />
      <form id="remittances-filters" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <ProductionFiltersPanel
          form="remittances-filters"
          agents={(agents ?? []).map((a) => ({ id: a.id, label: a.full_name }))}
          carriers={(carriers ?? []).map((c) => ({ id: c.id, label: c.name }))}
          insuranceLines={(insuranceLines ?? []).map((l) => ({ id: l.id, label: l.name_el }))}
          agentIds={filters.agentIds}
          carrierId={filters.carrierId}
          lineId={filters.lineId}
          kinds={filters.kinds}
          status={filters.status}
          issueFrom={filters.issueFrom}
          issueTo={filters.issueTo}
          startFrom={filters.startFrom}
          startTo={filters.startTo}
          remitStatusOptions={[
            { id: "pending", label: "Εκκρεμείς" },
            { id: "done", label: "Αποδοθέντα" },
          ]}
          remitStatus={remitStatus}
        />

        <div className="flex flex-col gap-4">
          {!hasRange ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <p className="text-sm font-medium">Διάλεξε διάστημα για να φορτώσουν οι αποδόσεις</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Συμπλήρωσε ημερομηνία έκδοσης ή έναρξης στα κριτήρια και πάτα «Εφαρμογή φίλτρων».
                Χωρίς διάστημα η σελίδα θα κατέβαζε ολόκληρο το χαρτοφυλάκιο.
              </p>
            </div>
          ) : (
            <>
              {remitStatus === "done" && (
                <p className="text-sm text-muted-foreground">
                  {isPremium ? premiumTotalCount : commissionTotalCount} αποδοθείσες εγγραφές συνολικά
                </p>
              )}
              {isPremium
                ? remitStatus === "pending"
                  ? renderTable({
                      rows: premiumRows,
                      amountLabel: "Μικτά",
                      getAmount: (m) => m.premium_gross,
                      action: remitPremium,
                      bulkAction: bulkRemitPremiums,
                      bulkSuccessLabel: "Αποδόθηκαν ασφάλιστρα",
                      mode: "pending",
                      getUncollected: (m) => uncollectedByMovement.get(m.id) ?? 0,
                    })
                  : renderTable({
                      rows: premiumRows,
                      amountLabel: "Μικτά",
                      getAmount: (m) => m.premium_gross,
                      action: undoPremiumRemit,
                      mode: "done",
                      getRemittedAt: (m) => m.premium_remitted_at,
                      totalPages: premiumTotalPages,
                    })
                : remitStatus === "pending"
                  ? renderTable({
                      rows: commissionRows,
                      amountLabel: "Προμήθεια",
                      getAmount: (m) => m.commission,
                      showPremiums: true,
                      action: remitCommission,
                      bulkAction: bulkRemitOutgoingCommissions,
                      bulkSuccessLabel: "Αποδόθηκαν προμήθειες",
                      mode: "pending",
                    })
                  : renderTable({
                      rows: commissionRows,
                      amountLabel: "Προμήθεια",
                      getAmount: (m) => m.commission,
                      showPremiums: true,
                      action: undoCommissionRemit,
                      mode: "done",
                      getRemittedAt: (m) => m.outgoing_commission_remitted_at,
                      totalPages: commissionTotalPages,
                    })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
