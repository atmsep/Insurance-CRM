import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { toCsv, csvResponse } from "@/lib/csv";
import { resolveClientName } from "@/lib/client-name";

export async function GET(request: Request) {
  await requireAgencyUser();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const afm = searchParams.get("afm");
  const phone = searchParams.get("phone");
  const city = searchParams.get("city");
  const showInactive = searchParams.get("show_inactive") === "1";
  const ids = searchParams.get("ids");

  let query = supabase
    .from("clients")
    .select(
      "client_type, afm, phone_mobile, address_city, is_active, client_individuals(first_name,last_name), client_legal_entities(company_name)",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (ids) {
    query = query.in("id", ids.split(","));
  } else {
    if (!showInactive) query = query.eq("is_active", true);
    if (name) query = query.ilike("display_name", `%${name}%`);
    if (afm) query = query.ilike("afm", `%${afm}%`);
    if (phone) query = query.ilike("phone_mobile", `%${phone}%`);
    if (city) query = query.ilike("address_city", `%${city}%`);
  }

  const { data: clients } = await query;

  const rows = (clients ?? []).map((c) => {
    const name = resolveClientName(c as never);
    return {
      name: name === "—" ? "" : name,
      afm: c.afm ?? "",
      phone: c.phone_mobile ?? "",
      city: c.address_city ?? "",
      status: c.is_active ? "Ενεργός" : "Ανενεργός",
    };
  });

  const csv = toCsv(rows, [
    { key: "name", label: "Ονομα / Επωνυμία" },
    { key: "afm", label: "ΑΦΜ" },
    { key: "phone", label: "Τηλέφωνο" },
    { key: "city", label: "Πόλη" },
    { key: "status", label: "Κατάσταση" },
  ]);

  return csvResponse(csv, "pelates.csv");
}
