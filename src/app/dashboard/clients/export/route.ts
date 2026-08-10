import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { toCsv, csvResponse } from "@/lib/csv";
import { resolveClientName } from "@/lib/client-name";
import { parseClientFilters, applyClientFilters, needsIndividualJoin } from "../filters";

export async function GET(request: Request) {
  await requireAgencyUser();
  const supabase = await createClient();
  const { searchParams: sp } = new URL(request.url);
  const filters = parseClientFilters(Object.fromEntries(sp.entries()));
  const ids = sp.get("ids");

  const individualSelect = needsIndividualJoin(filters)
    ? "client_individuals!inner(first_name,last_name)"
    : "client_individuals(first_name,last_name)";

  let query = supabase
    .from("clients")
    .select(
      `client_code, client_type, afm, phone_mobile, address_city, is_active, ${individualSelect}, client_legal_entities(company_name)`,
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (ids) {
    query = query.in("id", ids.split(","));
  } else {
    query = applyClientFilters(query, filters);
  }

  const { data: clients } = await query;

  const rows = (clients ?? []).map((c) => {
    const name = resolveClientName(c as never);
    return {
      code: `#${c.client_code}`,
      name: name === "—" ? "" : name,
      afm: c.afm ?? "",
      phone: c.phone_mobile ?? "",
      city: c.address_city ?? "",
      status: c.is_active ? "Ενεργός" : "Ανενεργός",
    };
  });

  const csv = toCsv(rows, [
    { key: "code", label: "Κωδικός" },
    { key: "name", label: "Ονομα / Επωνυμία" },
    { key: "afm", label: "ΑΦΜ" },
    { key: "phone", label: "Τηλέφωνο" },
    { key: "city", label: "Πόλη" },
    { key: "status", label: "Κατάσταση" },
  ]);

  return csvResponse(csv, "pelates.csv");
}
