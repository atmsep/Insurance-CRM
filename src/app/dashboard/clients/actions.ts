"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import type { ClientType, InteractionType } from "@/lib/database.types";
import { isValidAfm, isValidAmka, isValidEmail } from "@/lib/validation";

export type ClientFormState = { error: string } | undefined;

export async function searchClients(
  query: string,
  excludeId?: string,
): Promise<{ id: string; label: string }[]> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  if (!query.trim()) return [];

  let dbQuery = supabase
    .from("clients")
    .select("id, display_name")
    .eq("is_active", true)
    .or(`afm.ilike.%${query}%,phone_mobile.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order("display_name")
    .limit(20);

  if (excludeId) dbQuery = dbQuery.neq("id", excludeId);

  const { data } = await dbQuery;

  return (data ?? []).map((c) => ({ id: c.id, label: c.display_name ?? "—" }));
}

export async function createClientRecord(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const clientType = formData.get("client_type") as ClientType;
  const afm = (formData.get("afm") as string) || null;
  const email = (formData.get("email") as string) || null;
  const amka = (formData.get("amka") as string) || null;

  if (afm && !isValidAfm(afm)) {
    return { error: "Το ΑΦΜ δεν είναι έγκυρο (9 ψηφία, λάθος ψηφίο ελέγχου)." };
  }
  if (email && !isValidEmail(email)) {
    return { error: "Το email δεν είναι έγκυρο." };
  }
  if (amka && !isValidAmka(amka)) {
    return { error: "Το ΑΜΚΑ πρέπει να έχει ακριβώς 11 ψηφία." };
  }

  const common = {
    client_type: clientType,
    afm,
    doy: (formData.get("doy") as string) || null,
    email,
    phone_mobile: (formData.get("phone_mobile") as string) || null,
    phone_landline: (formData.get("phone_landline") as string) || null,
    address_city: (formData.get("address_city") as string) || null,
    iban: (formData.get("iban") as string) || null,
    notes: (formData.get("notes") as string) || null,
    referral_source: (formData.get("referral_source") as string) || null,
    referred_by_client_id: (formData.get("referred_by_client_id") as string) || null,
    referrer_relationship: (formData.get("referrer_relationship") as string) || null,
    assigned_agent_id: (formData.get("assigned_agent_id") as string) || agencyUser.id,
    created_by: agencyUser.id,
  };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert(common)
    .select("id")
    .single();

  if (clientError || !client) {
    return { error: "Σφάλμα κατά τη δημιουργία πελάτη: " + (clientError?.message ?? "") };
  }

  const subtypeResult =
    clientType === "individual"
      ? await supabase.from("client_individuals").insert({
          client_id: client.id,
          first_name: (formData.get("first_name") as string) ?? "",
          last_name: (formData.get("last_name") as string) ?? "",
          father_name: (formData.get("father_name") as string) || null,
          date_of_birth: (formData.get("date_of_birth") as string) || null,
          occupation: (formData.get("occupation") as string) || null,
          amka: (formData.get("amka") as string) || null,
        })
      : await supabase.from("client_legal_entities").insert({
          client_id: client.id,
          company_name: (formData.get("company_name") as string) ?? "",
          kad: (formData.get("kad") as string) || null,
          legal_representative_name: (formData.get("legal_representative_name") as string) || null,
        });

  if (subtypeResult.error) {
    // Compensate: remove the orphaned client row.
    await supabase.from("clients").delete().eq("id", client.id);
    return { error: "Σφάλμα κατά την αποθήκευση στοιχείων: " + subtypeResult.error.message };
  }

  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${client.id}?toast=${encodeURIComponent("Ο πελάτης δημιουργήθηκε.")}`);
}

export type ImportClientRow = {
  client_type?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  afm?: string;
  phone_mobile?: string;
  email?: string;
  address_city?: string;
};

export type ImportSummary = {
  created: number;
  skipped: number;
  errors: { row: number; reason: string }[];
};

export async function bulkImportClients(rows: ImportClientRow[]): Promise<ImportSummary> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const summary: ImportSummary = { created: 0, skipped: 0, errors: [] };
  const seenAfm = new Set<string>();

  if (rows.length > 500) {
    summary.errors.push({ row: 0, reason: "Μέγιστο 500 γραμμές ανά εισαγωγή — χώρισε το αρχείο." });
    return summary;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +1 for header row, +1 for 1-based

    const afm = row.afm?.trim() || null;
    if (afm && !isValidAfm(afm)) {
      summary.errors.push({ row: rowNum, reason: "Μη έγκυρο ΑΦΜ" });
      continue;
    }
    if (afm && (seenAfm.has(afm) || (await afmExists(supabase, afm)))) {
      summary.skipped++;
      continue;
    }

    const companyName = row.company_name?.trim();
    const firstName = row.first_name?.trim();
    const lastName = row.last_name?.trim();

    const clientType: ClientType =
      row.client_type === "legal_entity" || (!row.client_type && companyName)
        ? "legal_entity"
        : "individual";

    if (clientType === "individual" && (!firstName || !lastName)) {
      summary.errors.push({ row: rowNum, reason: "Λείπει όνομα/επώνυμο" });
      continue;
    }
    if (clientType === "legal_entity" && !companyName) {
      summary.errors.push({ row: rowNum, reason: "Λείπει επωνυμία" });
      continue;
    }

    const email = row.email?.trim() || null;
    if (email && !isValidEmail(email)) {
      summary.errors.push({ row: rowNum, reason: "Μη έγκυρο email" });
      continue;
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        client_type: clientType,
        afm,
        email,
        phone_mobile: row.phone_mobile?.trim() || null,
        address_city: row.address_city?.trim() || null,
        assigned_agent_id: agencyUser.id,
        created_by: agencyUser.id,
      })
      .select("id")
      .single();

    if (clientError || !client) {
      summary.errors.push({ row: rowNum, reason: clientError?.message ?? "Σφάλμα αποθήκευσης" });
      continue;
    }

    const subtypeResult =
      clientType === "individual"
        ? await supabase
            .from("client_individuals")
            .insert({ client_id: client.id, first_name: firstName!, last_name: lastName! })
        : await supabase
            .from("client_legal_entities")
            .insert({ client_id: client.id, company_name: companyName! });

    if (subtypeResult.error) {
      await supabase.from("clients").delete().eq("id", client.id);
      summary.errors.push({ row: rowNum, reason: subtypeResult.error.message });
      continue;
    }

    if (afm) seenAfm.add(afm);
    summary.created++;
  }

  revalidatePath("/dashboard/clients");
  return summary;
}

async function afmExists(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  afm: string,
) {
  const { data } = await supabase.from("clients").select("id").eq("afm", afm).maybeSingle();
  return !!data;
}

export async function updateClientNotes(clientId: string, formData: FormData) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  await supabase
    .from("clients")
    .update({
      email: (formData.get("email") as string) || null,
      phone_mobile: (formData.get("phone_mobile") as string) || null,
      phone_landline: (formData.get("phone_landline") as string) || null,
      address_city: (formData.get("address_city") as string) || null,
      iban: (formData.get("iban") as string) || null,
      notes: (formData.get("notes") as string) || null,
      referral_source: (formData.get("referral_source") as string) || null,
      referred_by_client_id: (formData.get("referred_by_client_id") as string) || null,
      referrer_relationship: (formData.get("referrer_relationship") as string) || null,
      assigned_agent_id: (formData.get("assigned_agent_id") as string) || null,
    })
    .eq("id", clientId);

  if (formData.get("client_type") === "individual") {
    await supabase
      .from("client_individuals")
      .update({
        father_name: (formData.get("father_name") as string) || null,
        date_of_birth: (formData.get("date_of_birth") as string) || null,
        occupation: (formData.get("occupation") as string) || null,
      })
      .eq("client_id", clientId);
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function toggleClientActive(clientId: string, isActive: boolean) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  await supabase.from("clients").update({ is_active: isActive }).eq("id", clientId);
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/clients");
}

export async function createInteraction(clientId: string, formData: FormData) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const interactionType = (formData.get("interaction_type") as InteractionType) || "note";
  const subject = (formData.get("subject") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const followUpNeeded = formData.get("follow_up_needed") === "on";

  await supabase.from("interactions").insert({
    client_id: clientId,
    agent_id: agencyUser.id,
    interaction_type: interactionType,
    subject,
    notes,
    follow_up_needed: followUpNeeded,
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
}
