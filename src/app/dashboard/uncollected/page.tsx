import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { ListPageHeader } from "@/components/list-page-header";
import { ReportPrintHeader } from "../reports/_components/report-print-header";
import { getActiveAgentsCached, getPaymentMethodsCached } from "@/lib/cached-queries/lookups";
import { athensToday } from "@/lib/date";
import { UncollectedList, type UncollectedRow, type AgentGroup } from "./_components/uncollected-list";

// Τα ανείσπρακτα ήταν καρτέλα μέσα στο Ταμείο. Είναι δική τους σελίδα γιατί
// δεν είναι δουλειά της ημέρας: το Ταμείο κλείνει μια συγκεκριμένη μέρα,
// ενώ αυτό είναι μόνιμο υπόλοιπο ανεξάρτητο από ημερομηνία.

// Ό,τι επιστρέφει η uncollected_installments (migration 0114). Τα numeric
// της Postgres φτάνουν ως string μέσω PostgREST, γι' αυτό περνούν από
// Number(). Τα τρία τελευταία είναι ΤΑ ΙΔΙΑ σε κάθε γραμμή: υπολογίζονται
// με window functions πάνω στο ΠΛΗΡΕΣ φιλτραρισμένο σύνολο, πριν μπει το
// όριο εμφάνισης — γι' αυτό το σύνολο δεν ακολουθεί τις 800 γραμμές.
type Row = {
  id: string;
  policy_id: string;
  policy_number: string;
  risk_label: string | null;
  line_name: string | null;
  carrier_name: string | null;
  client_name: string | null;
  issue_date: string | null;
  start_date: string | null;
  due_date: string;
  amount: string;
  paid_amount: string | null;
  status: string;
  installment_number: number;
  remaining: string;
  agent_id: string | null;
  agent_name: string;
  agent_total: string;
  grand_total: string;
  matched_count: string;
};

// Πόσες γραμμές δείχνει η λίστα. Πάνω από αυτό δεν επιλέγεις με το χέρι —
// στενεύεις τα κριτήρια.
const LIST_LIMIT = 800;
const NO_AGENT = "__none__";

export default async function UncollectedPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; maxAmount?: string; until?: string }>;
}) {
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  const sp = await searchParams;
  const maxAmountRaw = sp.maxAmount ?? "";
  const untilDate = sp.until ?? "";
  const maxAmount = maxAmountRaw ? Number(maxAmountRaw) : null;

  // Ο απλός συνεργάτης βλέπει ΜΟΝΟ τα δικά του — δεν παρακάμπτεται με
  // παράμετρο στη διεύθυνση. Ίδιο σχήμα με το Ταμείο.
  const scopeAgentId = isAdmin ? sp.agent || null : agencyUser.id;
  const admin = createAdminClient();

  // Φιλτράρισμα, υπόλοιπα, ομαδοποίηση και σύνολα γίνονται ΣΤΗ ΒΑΣΗ
  // (migration 0114). Πριν, η σελίδα κατέβαζε έως 10.000 δόσεις σε σειριακό
  // βρόχο — μία διαδρομή ανά 1.000 γραμμές — και τα έκανε όλα σε JavaScript.
  const [agents, paymentMethods, { data: rpcData, error: rpcError }] = await Promise.all([
    isAdmin ? getActiveAgentsCached() : Promise.resolve([]),
    getPaymentMethodsCached(),
    admin.rpc("uncollected_installments", {
      p_agent_id: scopeAgentId,
      p_max_amount: maxAmount,
      p_until: untilDate || null,
      p_limit: LIST_LIMIT,
    }),
  ]);

  const raw = (rpcData ?? []) as unknown as Row[];
  const rows: UncollectedRow[] = raw.map((r) => ({
    id: r.id,
    policyId: r.policy_id,
    policyNumber: r.policy_number,
    riskLabel: r.risk_label,
    line: r.line_name,
    carrier: r.carrier_name,
    client: r.client_name,
    // Οι ημερομηνίες της ΚΙΝΗΣΗΣ περιγράφουν τη συγκεκριμένη περίοδο· το
    // συμβόλαιο κρατά μόνο την τρέχουσα, που για παλιά δόση είναι λάθος.
    // Το coalesce γίνεται πλέον μέσα στη συνάρτηση.
    issueDate: r.issue_date,
    startDate: r.start_date,
    dueDate: r.due_date,
    amount: Number(r.amount),
    paidAmount: r.paid_amount === null ? null : Number(r.paid_amount),
    status: r.status,
    installmentNumber: r.installment_number,
    remaining: Number(r.remaining),
    agentId: r.agent_id,
    agentName: r.agent_name,
  }));

  // Τα σύνολα αφορούν ΟΛΕΣ τις δόσεις που ταιριάζουν, όχι μόνο τις 800 που
  // εμφανίζονται — η βάση τα υπολογίζει με window functions πριν το όριο.
  const total = raw.length ? Number(raw[0].grand_total) : 0;
  const matched = raw.length ? Number(raw[0].matched_count) : 0;

  // Σε προβολή «όλοι οι συνεργάτες» σπάει σε ενότητες ανά συνεργάτη. Οι
  // γραμμές έρχονται ήδη ταξινομημένες κατά φθίνον υποσύνολο, και το
  // υποσύνολο έρχεται από τη βάση — άρα παραμένει σωστό ακόμα κι όταν το
  // όριο εμφάνισης κόψει γραμμές του συνεργάτη.
  const grouped = isAdmin && !scopeAgentId;
  const byAgent = new Map<string, AgentGroup>();
  raw.forEach((r, i) => {
    const key = r.agent_id ?? NO_AGENT;
    const g = byAgent.get(key) ?? {
      agentId: key,
      agentName: r.agent_name,
      rows: [],
      total: Number(r.agent_total),
    };
    g.rows.push(rows[i]);
    byAgent.set(key, g);
  });
  const groups = grouped
    ? [...byAgent.values()]
    : [{ agentId: "all", agentName: "", rows, total }];

  const today = athensToday();

  return (
    <div className="flex flex-col gap-6">
      <ReportPrintHeader title="Ανείσπρακτα" />
      <div className="no-print">
        <ListPageHeader title="Ανείσπρακτα" actions={<PrintButton />} />
      </div>

      <form className="flex flex-wrap items-end gap-3 no-print">
        {isAdmin && (
          <div className="flex flex-col gap-1">
            <label htmlFor="agent" className="text-xs text-muted-foreground">Συνεργάτης</label>
            <select
              id="agent"
              name="agent"
              defaultValue={sp.agent ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Όλοι οι συνεργάτες</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="maxAmount" className="text-xs text-muted-foreground">Υπόλοιπο έως</label>
          <input
            id="maxAmount"
            name="maxAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={maxAmountRaw}
            placeholder="π.χ. 10"
            className="h-9 w-28 rounded-md border border-input bg-transparent px-2.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="until" className="text-xs text-muted-foreground">Λήξη δόσης έως</label>
          <input
            id="until"
            name="until"
            type="date"
            defaultValue={untilDate}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">Εφαρμογή</Button>

        <div className="ml-auto flex gap-3">
          <div className="rounded-md border bg-muted px-4 py-2">
            <p className="text-xs text-muted-foreground">Σύνολο ανείσπρακτων</p>
            <p className="text-lg font-semibold tabular-nums">{total.toFixed(2)} €</p>
          </div>
          <div className="rounded-md border px-4 py-2">
            <p className="text-xs text-muted-foreground">Δόσεις</p>
            <p className="text-lg font-semibold tabular-nums">{matched}</p>
          </div>
        </div>
      </form>

      {/* Σφάλμα ποτέ σιωπηλό: χωρίς αυτό μια αποτυχία θα εμφανιζόταν ως
          «δεν υπάρχουν ανείσπρακτα», που είναι χειρότερο από μήνυμα λάθους. */}
      {rpcError ? (
        <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
          Δεν ήταν δυνατή η φόρτωση των ανείσπρακτων. Δοκίμασε ξανά ή στένεψε τα κριτήρια.
        </div>
      ) : (
        <UncollectedList
          groups={groups}
          grouped={grouped}
          paymentMethods={paymentMethods}
          today={today}
          truncated={matched > rows.length}
          shownCount={rows.length}
        />
      )}
    </div>
  );
}
