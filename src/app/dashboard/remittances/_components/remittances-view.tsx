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
import { getActiveAgentsCached, getCarriersCached, getInsuranceLinesCached } from "@/lib/cached-queries/lookups";
import { resolveWindow, describeWindow } from "@/lib/list-page/window";

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

// Πάνω από αυτό δεν επιλέγεις με το χέρι — στενεύεις το διάστημα. Τα σύνολα
// ΔΕΝ ακολουθούν αυτό το όριο: η βάση τα υπολογίζει πριν το limit (0117).
const WORKLIST_LIMIT = 1000;

// Ό,τι επιστρέφει η remittance_worklist. Τα numeric της Postgres φτάνουν ως
// string μέσω PostgREST.
type WorklistRow = {
  id: string;
  policy_id: string;
  kind: string;
  document_number: string | null;
  issue_date: string;
  start_date: string;
  premium_net: string | null;
  premium_gross: string;
  policy_number: string;
  risk_label: string | null;
  client_name: string | null;
  agent_name: string | null;
  carrier_name: string | null;
  line_name: string | null;
  commission: string;
  uncollected: string;
  total_amount: string;
  matched_count: string;
};

// Η επίπεδη γραμμή της συνάρτησης ξαναγίνεται το ένθετο σχήμα που περιμένει
// ο πίνακας, ώστε να μη χρειαστεί να ξαναγραφτεί ολόκληρο το renderTable
// (το οποίο εξυπηρετεί ΚΑΙ την προβολή «Αποδοθέντα», που παραμένει
// σελιδοποιημένο ερώτημα πάνω στον πίνακα).
function toMovementRow(w: WorklistRow): RemittanceMovementRow {
  return {
    id: w.id,
    kind: w.kind,
    document_number: w.document_number,
    issue_date: w.issue_date,
    start_date: w.start_date,
    premium_net: w.premium_net === null ? null : Number(w.premium_net),
    premium_gross: Number(w.premium_gross),
    policy_id: w.policy_id,
    policies: {
      policy_number: w.policy_number,
      risk_label: w.risk_label,
      clients: { display_name: w.client_name },
      agency_users: w.agent_name ? { full_name: w.agent_name } : null,
      carriers: w.carrier_name ? { name: w.carrier_name } : null,
      insurance_lines: w.line_name ? { name_el: w.line_name } : null,
    },
  };
}

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

  // Προεπιλεγμένο παράθυρο αντί για κενή οθόνη (lib/list-page/window.ts):
  // η σελίδα ζητούσε από τον χρήστη να διαλέξει διάστημα πριν δείξει
  // οτιδήποτε, που είναι αδιέξοδο στο πρώτο άνοιγμα. Ανοίγει στον τρέχοντα
  // μήνα και το δηλώνει· αφιλτράριστη δεν τρέχει ποτέ.
  const hasOwnRange = Boolean(
    filters.issueFrom || filters.issueTo || filters.startFrom || filters.startTo,
  );
  const dateWindow = resolveWindow(filters.issueFrom, filters.issueTo, "month");
  if (!hasOwnRange) {
    filters.issueFrom = dateWindow.from;
    filters.issueTo = dateWindow.to;
  }
  const remitStatus = sp.remit_status === "done" ? "done" : "pending";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = parsePerPage(sp.per_page);
  const admin = createAdminClient();

  // Ρυθμίσεις γραφείου, όχι δεδομένα: cached (lib/cached-queries/lookups.ts).
  const [agents, carriers, insuranceLines] = await Promise.all([
    getActiveAgentsCached(),
    getCarriersCached(),
    getInsuranceLinesCached(),
  ]);

  let premiumRows: (RemittanceMovementRow & { premium_remitted_at?: string })[] = [];
  let commissionRows: (RemittanceMovementRow & { commission: number; outgoing_commission_remitted_at?: string })[] =
    [];
  let premiumTotalPages = 1;
  let commissionTotalPages = 1;
  let premiumTotalCount = 0;
  let commissionTotalCount = 0;
  const uncollectedByMovement = new Map<string, number>();
  let pendingError = false;

  if (remitStatus === "pending") {
    // Ένα ερώτημα αντί για τρεις σαρώσεις (migration 0117). Πριν: σειριακός
    // βρόχος έως 10.000 κινήσεις για τα ασφάλιστρα, δεύτερος ίδιος για τις
    // προμήθειες, και δεκάδες chunked ερωτήματα στις δόσεις για το
    // ανείσπρακτο υπόλοιπο. Η συνάρτηση λύνει και τα τρία μαζί, και
    // επιστρέφει το σύνολο ΟΛΟΥ του φιλτραρισμένου συνόλου.
    const { data: worklistData, error: worklistError } = await admin.rpc("remittance_worklist", {
      p_kind: kind,
      p_policy_number: filters.policyNumber ?? null,
      p_risk: filters.risk ?? null,
      p_client_name: filters.clientName ?? null,
      p_agent_ids: filters.agentIds ?? null,
      p_carrier_id: filters.carrierId ?? null,
      p_line_id: filters.lineId ?? null,
      p_kinds: filters.kinds ?? null,
      p_status: filters.status ?? null,
      p_issue_from: filters.issueFrom ?? null,
      p_issue_to: filters.issueTo ?? null,
      p_start_from: filters.startFrom ?? null,
      p_start_to: filters.startTo ?? null,
      p_limit: WORKLIST_LIMIT,
    });
    pendingError = Boolean(worklistError);

    const worklist = (worklistData ?? []) as unknown as WorklistRow[];
    const mapped = worklist.map(toMovementRow);
    if (isPremium) {
      premiumRows = mapped;
      premiumTotalCount = worklist.length ? Number(worklist[0].matched_count) : 0;
      // Απόδοση ασφαλίστρων που δεν έχουν καν εισπραχθεί είναι σχεδόν πάντα
      // λάθος στιγμή — το υπόλοιπο φαίνεται δίπλα στο ποσό.
      for (const w of worklist) uncollectedByMovement.set(w.id, Number(w.uncollected));
    } else {
      commissionRows = mapped.map((m, i) => ({ ...m, commission: Number(worklist[i].commission) }));
      commissionTotalCount = worklist.length ? Number(worklist[0].matched_count) : 0;
    }
  } else {
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
          agents={agents}
          carriers={carriers}
          insuranceLines={insuranceLines}
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
          {!hasOwnRange && (
            <p className="text-sm text-muted-foreground">
              Εμφανίζονται οι αποδόσεις <span className="font-medium">{describeWindow(dateWindow)}</span>. Άλλαξε τις
              ημερομηνίες στα κριτήρια για άλλο διάστημα.
            </p>
          )}
          {pendingError ? (
            <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
              Δεν ήταν δυνατή η φόρτωση των αποδόσεων. Δοκίμασε ξανά ή στένεψε το διάστημα.
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
