import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { installmentRemaining, isBillablePolicyStatus } from "../policies/balance";
import { PrintButton } from "@/components/print-button";
import { ListPageHeader } from "@/components/list-page-header";
import { ReportPrintHeader } from "../reports/_components/report-print-header";
import { UncollectedList, type UncollectedRow, type AgentGroup } from "./_components/uncollected-list";

// Τα ανείσπρακτα ήταν καρτέλα μέσα στο Ταμείο. Είναι δική τους σελίδα γιατί
// δεν είναι δουλειά της ημέρας: το Ταμείο κλείνει μια συγκεκριμένη μέρα,
// ενώ αυτό είναι μόνιμο υπόλοιπο ανεξάρτητο από ημερομηνία.

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type Row = {
  id: string;
  policy_id: string;
  due_date: string;
  amount: number;
  paid_amount: number | null;
  status: string;
  policy_movements: SingleOrMany<{ issue_date: string | null; start_date: string | null }>;
  policies: SingleOrMany<{
    policy_number: string;
    risk_label: string | null;
    status: string;
    issue_date: string | null;
    start_date: string | null;
    assigned_agent_id: string | null;
    clients: SingleOrMany<{ display_name: string | null }>;
    agency_users: SingleOrMany<{ full_name: string }>;
    carriers: SingleOrMany<{ name: string }>;
    insurance_lines: SingleOrMany<{ name_el: string }>;
  }>;
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

  // Το PostgREST κόβει σιωπηλά στις 1000 γραμμές, οπότε διαβάζεται σε κομμάτια.
  const CHUNK = 1000;
  const MAX_ROWS = 10000;
  const raw: unknown[] = [];
  for (let from = 0; from < MAX_ROWS; from += CHUNK) {
    let q = admin
      .from("policy_installments")
      .select(
        "id, policy_id, due_date, amount, paid_amount, status, " +
          "policy_movements(issue_date, start_date), " +
          "policies!inner(policy_number, risk_label, status, issue_date, start_date, assigned_agent_id, " +
          "clients(display_name), agency_users!policies_assigned_agent_id_fkey(full_name), " +
          "carriers(name), insurance_lines(name_el))",
      )
      .in("status", ["pending", "overdue", "partially_paid"])
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + CHUNK - 1);
    if (scopeAgentId) q = q.eq("policies.assigned_agent_id", scopeAgentId);
    if (untilDate) q = q.lte("due_date", untilDate);
    const { data } = await q;
    const batch = data ?? [];
    raw.push(...batch);
    if (batch.length < CHUNK) break;
  }

  const [{ data: agents }, { data: paymentMethods }] = await Promise.all([
    isAdmin
      ? admin.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: [] }),
    admin.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  // Εκκρεμής δόση ακυρωμένου ή πρόχειρου συμβολαίου δεν είναι πια οφειλή —
  // ίδιος κανόνας με το getOutstandingByPolicy.
  const rows: UncollectedRow[] = [];
  let total = 0;
  let matched = 0;
  for (const r of raw as Row[]) {
    const policy = one(r.policies);
    if (!policy || !isBillablePolicyStatus(policy.status)) continue;
    const remaining = installmentRemaining(r);
    if (remaining <= 0) continue;
    // Το φίλτρο ποσού εφαρμόζεται στο ΥΠΟΛΟΙΠΟ, όχι στο αρχικό ποσό.
    if (maxAmount !== null && remaining > maxAmount) continue;

    total += remaining;
    matched++;
    if (rows.length >= LIST_LIMIT) continue;

    const movement = one(r.policy_movements);
    rows.push({
      id: r.id,
      policyId: r.policy_id,
      policyNumber: policy.policy_number,
      riskLabel: policy.risk_label,
      line: one(policy.insurance_lines)?.name_el ?? null,
      carrier: one(policy.carriers)?.name ?? null,
      client: one(policy.clients)?.display_name ?? null,
      // Οι ημερομηνίες της ΚΙΝΗΣΗΣ περιγράφουν τη συγκεκριμένη περίοδο· το
      // συμβόλαιο κρατά μόνο την τρέχουσα, που για παλιά δόση είναι λάθος.
      issueDate: movement?.issue_date ?? policy.issue_date,
      startDate: movement?.start_date ?? policy.start_date,
      dueDate: r.due_date,
      amount: r.amount,
      remaining,
      agentId: policy.assigned_agent_id,
      agentName: one(policy.agency_users)?.full_name ?? "Χωρίς συνεργάτη",
    });
  }

  // Σε προβολή «όλοι οι συνεργάτες» σπάει σε ενότητες ανά συνεργάτη, με
  // δικό της υποσύνολο η καθεμία.
  const grouped = isAdmin && !scopeAgentId;
  const byAgent = new Map<string, AgentGroup>();
  for (const r of rows) {
    const key = r.agentId ?? NO_AGENT;
    const g = byAgent.get(key) ?? { agentId: key, agentName: r.agentName, rows: [], total: 0 };
    g.rows.push(r);
    g.total += r.remaining;
    byAgent.set(key, g);
  }
  const groups = grouped
    ? [...byAgent.values()].sort((a, b) => b.total - a.total)
    : [{ agentId: "all", agentName: "", rows, total }];

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());

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
              {(agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
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

      <UncollectedList
        groups={groups}
        grouped={grouped}
        paymentMethods={paymentMethods ?? []}
        today={today}
        truncated={matched > rows.length}
        shownCount={rows.length}
      />
    </div>
  );
}
