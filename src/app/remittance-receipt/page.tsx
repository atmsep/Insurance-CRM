import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "@/components/print-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/date";
import { getAgencyProfileCached } from "@/lib/cached-queries/lookups";
import { POLICY_MOVEMENT_KIND_LABELS } from "../dashboard/policies/movement-labels";
import { getOutgoingCommissionsByMovement } from "../dashboard/reports/production/commissions";

// Έντυπο απόδειξης απόδοσης — το χαρτί που συνοδεύει την πραγματική
// πληρωμή προς την εταιρεία (ασφάλιστρα) ή προς τον συνεργάτη
// (προμήθειες). Σκόπιμα ΑΝΕΞΑΡΤΗΤΟ από την ίδια την ενέργεια απόδοσης:
// παίρνει μόνο τα id των κινήσεων, οπότε τυπώνεται και εκ των υστέρων για
// κάτι που αποδόθηκε χθες, χωρίς να αλλάζει τίποτα στη βάση.
//
// Ζει ΕΞΩ από το /dashboard επίτηδες: ανοίγει σε ξεχωριστό παράθυρο-έντυπο,
// και το μενού/κεφαλίδα της εφαρμογής μέσα σε τέτοιο παράθυρο είναι
// αδιέξοδο — ο χρήστης θα πλοηγούνταν μέσα σε ένα popup. Η πρόσβαση
// παραμένει κλειδωμένη: το proxy.ts στέλνει κάθε μη δημόσια διαδρομή στο
// /login, και εδώ ελέγχεται ξανά ο ρόλος.
//
// Η ομαδοποίηση δεν είναι διακόσμηση: μια απόδοση ασφαλίστρων πληρώνεται
// ΑΝΑ ΕΤΑΙΡΕΙΑ και μια απόδοση προμηθειών εισπράττεται ΑΝΑ ΣΥΝΕΡΓΑΤΗ, οπότε
// το υποσύνολο κάθε ενότητας είναι το ποσό που πραγματικά αλλάζει χέρια.

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type ReceiptRow = {
  id: string;
  kind: string;
  issue_date: string;
  start_date: string;
  premium_net: number | null;
  premium_gross: number;
  policies: SingleOrMany<{
    policy_number: string;
    risk_label: string | null;
    clients: SingleOrMany<{ display_name: string | null }>;
    agency_users: SingleOrMany<{ full_name: string }>;
    carriers: SingleOrMany<{ name: string }>;
    insurance_lines: SingleOrMany<{ name_el: string }>;
  }>;
};

// Το ίδιο όριο με την εκτύπωση της Παραγωγής: το έντυπο είναι άνθρωπος που
// περιμένει μπροστά σε καρτέλα, όχι background download.
const MAX_ROWS = 2000;

function money(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

export default async function RemittanceReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; ids?: string }>;
}) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const isPremium = sp.kind !== "commission";
  const ids = (sp.ids ?? "").split(",").filter(Boolean).slice(0, MAX_ROWS);
  const profile = await getAgencyProfileCached();

  const title = isPremium ? "Απόδειξη Απόδοσης Ασφαλίστρων" : "Απόδειξη Απόδοσης Προμηθειών";
  const printedAt = new Date().toLocaleString("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (ids.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Δεν επιλέχθηκαν κινήσεις. Επίλεξε γραμμές στις Αποδόσεις και πάτα «Απόδοση».
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  // Το PostgREST κόβει στις 1000 γραμμές· το .in() σε 2000 id διαβάζεται σε
  // κομμάτια για να μη λείψουν σιωπηλά εγγραφές από την απόδειξη.
  const rows: ReceiptRow[] = [];
  for (let from = 0; from < ids.length; from += 500) {
    const { data } = await admin
      .from("policy_movements")
      .select(
        "id, kind, issue_date, start_date, premium_net, premium_gross, " +
          "policies!inner(policy_number, risk_label, clients!inner(display_name), " +
          "agency_users!policies_assigned_agent_id_fkey(full_name), carriers(name), insurance_lines(name_el))",
      )
      .in("id", ids.slice(from, from + 500))
      .order("issue_date", { ascending: true });
    rows.push(...((data ?? []) as unknown as ReceiptRow[]));
  }

  const commissionByMovement = isPremium
    ? new Map<string, number>()
    : await getOutgoingCommissionsByMovement(
        admin,
        rows.map((m) => ({ id: m.id, isReal: true })),
      );

  const amountOf = (m: ReceiptRow) => (isPremium ? m.premium_gross : (commissionByMovement.get(m.id) ?? 0));

  // Ασφάλιστρα → ανά εταιρεία· προμήθειες → ανά συνεργάτη.
  const groups = new Map<string, { label: string; rows: ReceiptRow[]; total: number; net: number; gross: number }>();
  for (const m of rows) {
    const policy = one(m.policies);
    const label = isPremium
      ? (one(policy?.carriers ?? null)?.name ?? "Χωρίς εταιρεία")
      : (one(policy?.agency_users ?? null)?.full_name ?? "Χωρίς συνεργάτη");
    const g = groups.get(label) ?? { label, rows: [], total: 0, net: 0, gross: 0 };
    g.rows.push(m);
    g.total += amountOf(m);
    g.net += m.premium_net ?? 0;
    g.gross += m.premium_gross;
    groups.set(label, g);
  }
  const sections = [...groups.values()].sort((a, b) => b.total - a.total);
  const grandTotal = sections.reduce((sum, g) => sum + g.total, 0);
  const recipientLabel = isPremium ? "Εταιρεία" : "Συνεργάτης";

  return (
    <div className="flex flex-col gap-6 p-6 print:p-0">
      {/* ΔΕΝ τυπώνεται μόνο του: ο διάλογος εκτύπωσης σκέπαζε αμέσως τα
          σύνολα, που είναι ακριβώς αυτό που θέλει να ελέγξει κανείς πριν
          παραδώσει τα χρήματα. Τυπώνει ο χρήστης όταν συμφωνήσει. */}
      <div className="flex items-center justify-between gap-4 no-print">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Σύνολο προς απόδοση</p>
            <p className="text-xl font-semibold tabular-nums">{money(grandTotal)}</p>
          </div>
          <PrintButton />
        </div>
      </div>

      {/* Επιστολόχαρτο: φαίνεται και στην οθόνη, ώστε να ελέγχεται πριν το χαρτί. */}
      <div className="flex items-start justify-between border-b pb-3">
        <div className="flex flex-col gap-0.5 text-sm">
          {profile.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt={profile.name ?? ""} className="mb-1 h-12 w-auto object-contain" />
          )}
          {profile.name && <span className="font-medium">{profile.name}</span>}
          {profile.address && <span className="text-muted-foreground">{profile.address}</span>}
          {(profile.phone || profile.email) && (
            <span className="text-muted-foreground">
              {[profile.phone, profile.email].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <div className="text-right text-sm">
          <p className="text-muted-foreground">Ημερομηνία: {printedAt}</p>
          <p className="text-muted-foreground">Εκδότης: {agencyUser.full_name}</p>
        </div>
      </div>

      {/* Στην οθόνη ο τίτλος είναι ο h1 πάνω-πάνω μαζί με το κουμπί
          εκτύπωσης· εκείνος κρύβεται στο χαρτί, οπότε ο τίτλος του εντύπου
          μπαίνει εδώ, κεντραρισμένος όπως στα υπόλοιπα έντυπα. */}
      <h2 className="print-only text-center text-lg font-semibold">{title}</h2>

      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Κινήσεις</p>
          <p className="font-semibold tabular-nums">{rows.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{recipientLabel === "Εταιρεία" ? "Εταιρείες" : "Συνεργάτες"}</p>
          <p className="font-semibold tabular-nums">{sections.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {isPremium ? "Σύνολο απόδοσης ασφαλίστρων" : "Σύνολο απόδοσης προμηθειών"}
          </p>
          <p className="font-semibold tabular-nums">{money(grandTotal)}</p>
        </div>
      </div>

      {sections.map((g) => (
        <div key={g.label} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              {recipientLabel}: {g.label}
            </h2>
            <span className="text-sm font-semibold tabular-nums">
              {g.rows.length} κιν. · {money(g.total)}
            </span>
          </div>
          <div className="overflow-x-auto rounded-md border text-xs [&_td]:whitespace-normal [&_th]:whitespace-normal [&_.tabular-nums]:whitespace-nowrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Έκδοση</TableHead>
                  <TableHead>Έναρξη</TableHead>
                  <TableHead>Είδος</TableHead>
                  <TableHead>Συμβόλαιο</TableHead>
                  <TableHead>Χαρακτηριστικό</TableHead>
                  <TableHead>Κλάδος</TableHead>
                  <TableHead>Πελάτης</TableHead>
                  {!isPremium && <TableHead>Εταιρεία</TableHead>}
                  <TableHead className="text-right">Καθαρά</TableHead>
                  <TableHead className="text-right">Μικτά</TableHead>
                  {!isPremium && <TableHead className="text-right">Προμήθεια</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.rows.map((m) => {
                  const policy = one(m.policies);
                  return (
                    <TableRow key={m.id}>
                      <TableCell>{formatDate(m.issue_date)}</TableCell>
                      <TableCell>{formatDate(m.start_date)}</TableCell>
                      <TableCell>{POLICY_MOVEMENT_KIND_LABELS[m.kind] ?? m.kind}</TableCell>
                      <TableCell className="font-medium">{policy?.policy_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{policy?.risk_label ?? "—"}</TableCell>
                      <TableCell>{one(policy?.insurance_lines ?? null)?.name_el ?? "—"}</TableCell>
                      <TableCell>{one(policy?.clients ?? null)?.display_name ?? "—"}</TableCell>
                      {!isPremium && <TableCell>{one(policy?.carriers ?? null)?.name ?? "—"}</TableCell>}
                      <TableCell className="text-right tabular-nums">
                        {m.premium_net != null ? money(m.premium_net) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(m.premium_gross)}</TableCell>
                      {!isPremium && (
                        <TableCell className="text-right tabular-nums font-medium">
                          {money(commissionByMovement.get(m.id) ?? 0)}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={isPremium ? 7 : 8}>Σύνολο — {g.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(g.net)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(g.gross)}</TableCell>
                  {!isPremium && <TableCell className="text-right tabular-nums">{money(g.total)}</TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-3">
        <span className="font-semibold">
          {isPremium ? "ΓΕΝΙΚΟ ΣΥΝΟΛΟ ΑΠΟΔΟΣΗΣ ΑΣΦΑΛΙΣΤΡΩΝ" : "ΓΕΝΙΚΟ ΣΥΝΟΛΟ ΑΠΟΔΟΣΗΣ ΠΡΟΜΗΘΕΙΩΝ"}
        </span>
        <span className="text-lg font-semibold tabular-nums">{money(grandTotal)}</span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-12 text-center text-sm">
        <div>
          <div className="border-t pt-2">Ο παραδίδων</div>
          <p className="mt-1 text-xs text-muted-foreground">{agencyUser.full_name}</p>
        </div>
        <div>
          <div className="border-t pt-2">Ο παραλαμβάνων</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {sections.length === 1 ? sections[0].label : " "}
          </p>
        </div>
      </div>
    </div>
  );
}
