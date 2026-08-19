import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
import { getAgencyProfileCached } from "@/lib/cached-queries/lookups";
import { AutoPrint } from "@/components/auto-print";
import { PrintButton } from "@/components/print-button";
import { BackButton } from "@/components/back-button";
import { formatDate, formatDateTime } from "@/lib/date";

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type ReceiptPaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  receipt_number: string | null;
  paid_by: string | null;
  is_reversed: boolean;
  reversal_reason: string | null;
  cheque_bank: string | null;
  cheque_number: string | null;
  cheque_due_date: string | null;
  payment_methods: SingleOrMany<{ name: string }>;
  agency_users: SingleOrMany<{ full_name: string }>;
  policy_installments: SingleOrMany<{
    installment_number: number;
    amount: number;
    policy_id: string;
    policies: SingleOrMany<{
      policy_number: string;
      risk_label: string | null;
      clients: SingleOrMany<{ display_name: string | null; afm: string | null }>;
      carriers: SingleOrMany<{ name: string }>;
      insurance_lines: SingleOrMany<{ name_el: string }>;
    }>;
  }>;
};

// Εκτυπώσιμη απόδειξη είσπραξης — the page a cashier hands (or emails as
// PDF-print) to the client. Reached from the Ταμείο day view; opens in a
// new tab and auto-prints. Admin client + explicit scoping, same rationale
// as the Ταμείο page itself; a non-admin can only print their own
// collections, matching the day view's per-agent scope.
export default async function ReceiptPrintPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  const admin = createAdminClient();

  const { data: rawPayment } = await admin
    .from("installment_payments")
    .select(
      "id, amount, paid_at, receipt_number, paid_by, is_reversed, reversal_reason, " +
        "cheque_bank, cheque_number, cheque_due_date, payment_methods(name), " +
        "agency_users!installment_payments_paid_by_fkey(full_name), " +
        "policy_installments!inner(installment_number, amount, policy_id, " +
        "policies(policy_number, risk_label, clients(display_name, afm), carriers(name), insurance_lines(name_el)))",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (!rawPayment) notFound();
  const payment = rawPayment as unknown as ReceiptPaymentRow;
  if (!isAdmin && payment.paid_by !== agencyUser.id) notFound();

  const installment = one(payment.policy_installments);
  const policy = one(installment?.policies ?? null);
  const client = one(policy?.clients ?? null);
  const carrier = one(policy?.carriers ?? null);
  const line = one(policy?.insurance_lines ?? null);
  const method = one(payment.payment_methods);
  const collector = one(payment.agency_users);
  const profile = await getAgencyProfileCached();
  const isCheque = Boolean(payment.cheque_bank || payment.cheque_number || payment.cheque_due_date);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      {!payment.is_reversed && <AutoPrint />}
      <div className="no-print flex items-center justify-between">
        <BackButton />
        <PrintButton />
      </div>

      {payment.is_reversed && (
        <div className="rounded-md border border-destructive/50 p-3 text-sm font-medium text-destructive">
          ΑΚΥΡΩΜΕΝΗ ΕΙΣΠΡΑΞΗ{payment.reversal_reason ? ` — ${payment.reversal_reason}` : ""}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-4">
          {profile.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt={profile.name ?? ""} className="h-14 w-auto object-contain" />
          )}
          <div className="text-sm">
            {profile.name && <p className="font-semibold">{profile.name}</p>}
            {profile.address && <p>{profile.address}</p>}
            {(profile.phone || profile.email) && (
              <p>{[profile.phone, profile.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-lg font-semibold">Απόδειξη είσπραξης</p>
          <p>Αρ. {payment.receipt_number ?? "—"}</p>
          <p className="text-muted-foreground">{formatDateTime(payment.paid_at)}</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-2 text-muted-foreground">Πελάτης</td>
            <td className="py-2 text-right font-medium">
              {client?.display_name ?? "—"}
              {client?.afm ? ` · ΑΦΜ ${client.afm}` : ""}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 text-muted-foreground">Συμβόλαιο</td>
            <td className="py-2 text-right font-medium">{policy?.policy_number ?? "—"}</td>
          </tr>
          {policy?.risk_label && (
            <tr className="border-b">
              <td className="py-2 text-muted-foreground">Χαρακτηριστικό</td>
              <td className="py-2 text-right">{policy.risk_label}</td>
            </tr>
          )}
          <tr className="border-b">
            <td className="py-2 text-muted-foreground">Κλάδος / Εταιρεία</td>
            <td className="py-2 text-right">
              {[line?.name_el, carrier?.name].filter(Boolean).join(" · ") || "—"}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 text-muted-foreground">Δόση</td>
            <td className="py-2 text-right">
              #{installment?.installment_number ?? "—"} ({(installment?.amount ?? 0).toFixed(2)} €)
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 text-muted-foreground">Τρόπος πληρωμής</td>
            <td className="py-2 text-right">
              {method?.name ?? "—"}
              {isCheque && (
                <span className="block text-xs text-muted-foreground">
                  {[
                    payment.cheque_bank,
                    payment.cheque_number,
                    payment.cheque_due_date ? `λήξη ${formatDate(payment.cheque_due_date)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className="py-3 text-base font-semibold">Ποσό είσπραξης</td>
            <td className="py-3 text-right text-base font-semibold">{payment.amount.toFixed(2)} €</td>
          </tr>
        </tbody>
      </table>

      <div className="flex items-end justify-between pt-8 text-sm">
        <div>
          <p className="text-muted-foreground">Εισπράκτορας</p>
          <p className="font-medium">{collector?.full_name ?? "—"}</p>
        </div>
        <div className="w-48 border-t pt-2 text-center text-muted-foreground">Υπογραφή</div>
      </div>
    </div>
  );
}
