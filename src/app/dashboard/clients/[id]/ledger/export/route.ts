import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { toCsv, csvResponse } from "@/lib/csv";
import { buildLedgerRows } from "../../_components/ledger-tab";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAgencyUser();
  const { id } = await params;
  const supabase = await createClient();

  // Same client_installments_ledger RPC the page itself uses (migration
  // 0070) — the equivalent plain embedded query hit a real statement
  // timeout under an authenticated session.
  const { data: installments } = await supabase.rpc("client_installments_ledger", { p_client_id: id });

  const { rows } = buildLedgerRows(
    (installments ?? []) as unknown as Parameters<typeof buildLedgerRows>[0],
  );

  const csvRows = rows.map((r) => ({
    date: r.date,
    policy: r.policyNumber,
    description: r.description,
    debit: r.debit > 0 ? r.debit.toFixed(2) : "",
    credit: r.credit > 0 ? r.credit.toFixed(2) : "",
    balance: r.balance.toFixed(2),
  }));

  const csv = toCsv(csvRows, [
    { key: "date", label: "Ημερομηνία" },
    { key: "policy", label: "Συμβόλαιο" },
    { key: "description", label: "Περιγραφή" },
    { key: "debit", label: "Χρέωση" },
    { key: "credit", label: "Πίστωση" },
    { key: "balance", label: "Υπόλοιπο" },
  ]);

  return csvResponse(csv, "logistiki-kartela.csv");
}
