"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser, getCurrentAgencyUser } from "@/lib/dal";
import type { ClientType, InteractionType } from "@/lib/database.types";
import { isValidAfm, isValidAmka, isValidEmail, isValidIban, normalizePhoneForStorage } from "@/lib/validation";
import { logActivity, logActivityBatch } from "@/lib/activity-log";
import { normalizeGreekPhone } from "@/lib/phone";

export type ClientFormState = { error: string; field?: string } | undefined;

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
    return { error: "Το ΑΦΜ δεν είναι έγκυρο (9 ψηφία, λάθος ψηφίο ελέγχου).", field: "afm" };
  }
  if (email && !isValidEmail(email)) {
    return { error: "Το email δεν είναι έγκυρο.", field: "email" };
  }
  if (amka && !isValidAmka(amka)) {
    return { error: "Το ΑΜΚΑ πρέπει να έχει ακριβώς 11 ψηφία.", field: "amka" };
  }

  const iban = (formData.get("iban") as string) || null;
  if (iban && !isValidIban(iban)) {
    return { error: "Το IBAN δεν είναι έγκυρο.", field: "iban" };
  }

  const phoneMobile = (formData.get("phone_mobile") as string) || null;
  const phoneLandline = (formData.get("phone_landline") as string) || null;

  const common = {
    client_type: clientType,
    afm,
    doy: (formData.get("doy") as string) || null,
    email,
    // Stored in bare-digits normal form so caller-ID matching and search
    // compare like with like, however the number was typed.
    phone_mobile: phoneMobile ? normalizePhoneForStorage(phoneMobile) : null,
    phone_landline: phoneLandline ? normalizePhoneForStorage(phoneLandline) : null,
    address_city: (formData.get("address_city") as string) || null,
    address_region: (formData.get("address_region") as string) || null,
    address_postal_code: (formData.get("address_postal_code") as string) || null,
    iban,
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

  if (clientError?.code === "23505") {
    return { error: "Υπάρχει ήδη πελάτης με αυτό το ΑΦΜ.", field: "afm" };
  }
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

  await logActivity(supabase, {
    entityType: "client",
    entityId: client.id,
    action: "created",
    description: "Δημιουργήθηκε ο πελάτης.",
    actorId: agencyUser.id,
  });

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

  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    summary.errors.push({ row: 0, reason: "Μόνο διαχειριστής μπορεί να κάνει μαζική εισαγωγή." });
    return summary;
  }
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

export async function updateClientNotes(
  clientId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const email = (formData.get("email") as string) || null;
  if (email && !isValidEmail(email)) {
    return { error: "Το email δεν είναι έγκυρο." };
  }

  const afm = (formData.get("afm") as string) || null;
  if (afm && !isValidAfm(afm)) {
    return { error: "Το ΑΦΜ δεν είναι έγκυρο." };
  }

  const updateIban = (formData.get("iban") as string) || null;
  if (updateIban && !isValidIban(updateIban)) {
    return { error: "Το IBAN δεν είναι έγκυρο." };
  }

  const referredByClientId = (formData.get("referred_by_client_id") as string) || null;
  if (referredByClientId === clientId) {
    return { error: "Ένας πελάτης δεν μπορεί να είναι συστήνων του εαυτού του." };
  }

  const clientType = formData.get("client_type") as string;
  const firstName = (formData.get("first_name") as string) || "";
  const lastName = (formData.get("last_name") as string) || "";
  if (clientType === "individual" && (!firstName.trim() || !lastName.trim())) {
    return { error: "Το όνομα και το επώνυμο είναι υποχρεωτικά." };
  }
  const companyName = (formData.get("company_name") as string) || "";
  if (clientType === "legal_entity" && !companyName.trim()) {
    return { error: "Η επωνυμία είναι υποχρεωτική." };
  }

  const { error: clientError } = await supabase
    .from("clients")
    .update({
      afm,
      doy: (formData.get("doy") as string) || null,
      email,
      phone_mobile: (formData.get("phone_mobile") as string)
        ? normalizePhoneForStorage(formData.get("phone_mobile") as string)
        : null,
      phone_landline: (formData.get("phone_landline") as string)
        ? normalizePhoneForStorage(formData.get("phone_landline") as string)
        : null,
      address_street: (formData.get("address_street") as string) || null,
      address_number: (formData.get("address_number") as string) || null,
      address_city: (formData.get("address_city") as string) || null,
      address_region: (formData.get("address_region") as string) || null,
      address_postal_code: (formData.get("address_postal_code") as string) || null,
      iban: updateIban,
      notes: (formData.get("notes") as string) || null,
      referral_source: (formData.get("referral_source") as string) || null,
      referred_by_client_id: referredByClientId,
      referrer_relationship: (formData.get("referrer_relationship") as string) || null,
      assigned_agent_id: (formData.get("assigned_agent_id") as string) || null,
    })
    .eq("id", clientId);

  if (clientError?.code === "23505") {
    return { error: "Υπάρχει ήδη άλλος πελάτης με αυτό το ΑΦΜ." };
  }
  if (clientError) {
    return { error: "Σφάλμα κατά την αποθήκευση: " + clientError.message };
  }

  if (clientType === "individual") {
    const amka = (formData.get("amka") as string) || null;
    if (amka && !isValidAmka(amka)) {
      return { error: "Το ΑΜΚΑ δεν είναι έγκυρο." };
    }

    const { error: individualError } = await supabase
      .from("client_individuals")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        father_name: (formData.get("father_name") as string) || null,
        date_of_birth: (formData.get("date_of_birth") as string) || null,
        occupation: (formData.get("occupation") as string) || null,
        id_document_type: (formData.get("id_document_type") as string) || null,
        id_document_number: (formData.get("id_document_number") as string) || null,
        amka,
      })
      .eq("client_id", clientId);

    if (individualError) {
      return { error: "Σφάλμα κατά την αποθήκευση: " + individualError.message };
    }
  }

  if (clientType === "legal_entity") {
    const { error: legalEntityError } = await supabase
      .from("client_legal_entities")
      .update({
        company_name: companyName.trim(),
        legal_form: (formData.get("legal_form") as string) || null,
        kad: (formData.get("kad") as string) || null,
        gemi_number: (formData.get("gemi_number") as string) || null,
        legal_representative_name: (formData.get("legal_representative_name") as string) || null,
      })
      .eq("client_id", clientId);

    if (legalEntityError) {
      return { error: "Σφάλμα κατά την αποθήκευση: " + legalEntityError.message };
    }
  }

  await logActivity(supabase, {
    entityType: "client",
    entityId: clientId,
    action: "updated",
    description: "Ενημερώθηκαν τα στοιχεία επικοινωνίας.",
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function toggleClientActive(
  clientId: string,
  isActive: boolean,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  // Deactivation hides the client (and their book) from every list and
  // from caller-ID matching — an admin decision, same boundary as the bulk
  // variant below.
  if (!isActive && agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Μόνο διαχειριστής μπορεί να απενεργοποιήσει πελάτη." };
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("clients").update({ is_active: isActive }).eq("id", clientId);
  if (error) return { error: "Σφάλμα: " + error.message };
  await logActivity(supabase, {
    entityType: "client",
    entityId: clientId,
    action: isActive ? "activated" : "deactivated",
    description: isActive ? "Ο πελάτης ενεργοποιήθηκε." : "Ο πελάτης απενεργοποιήθηκε.",
    actorId: agencyUser.id,
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/clients");
}

export async function deactivateClients(
  clientIds: string[],
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (clientIds.length === 0) return;
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Μόνο διαχειριστής μπορεί να απενεργοποιήσει πελάτες." };
  }
  const supabase = await createSupabaseClient();

  const { error } = await supabase.from("clients").update({ is_active: false }).in("id", clientIds);
  if (error) {
    return { error: "Σφάλμα κατά τη μαζική ενημέρωση: " + error.message };
  }

  await logActivityBatch(
    supabase,
    clientIds.map((clientId) => ({
      entityType: "client",
      entityId: clientId,
      action: "deactivated",
      description: "Ο πελάτης απενεργοποιήθηκε (μαζική ενέργεια).",
      actorId: agencyUser.id,
    })),
  );
  revalidatePath("/dashboard/clients");
}

export async function createInteraction(clientId: string, formData: FormData) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const interactionType = (formData.get("interaction_type") as InteractionType) || "note";
  const subject = (formData.get("subject") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const followUpNeeded = formData.get("follow_up_needed") === "on";

  const { error } = await supabase.from("interactions").insert({
    client_id: clientId,
    agent_id: agencyUser.id,
    interaction_type: interactionType,
    subject,
    notes,
    follow_up_needed: followUpNeeded,
  });
  if (error) return;

  await logActivity(supabase, {
    entityType: "client",
    entityId: clientId,
    action: "interaction_created",
    description: "Καταχωρήθηκε νέα επικοινωνία.",
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
}

// Never required — a call shows up in the history automatically the
// moment the phone rings (see incoming-call-listener.tsx / the caller-ID
// bridge), this just lets someone jot down what was discussed afterward.
// clientId comes first (not callId) so the client detail page can bind it
// once and hand CallsTab a (callId, formData) => ... action, which it then
// binds per row — .bind() only fixes parameters left-to-right.
export async function updateIncomingCallNotes(clientId: string, callId: string, formData: FormData) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const notes = (formData.get("notes") as string) || null;

  const { error } = await supabase.from("incoming_calls").update({ notes }).eq("id", callId);
  if (error) return;

  revalidatePath(`/dashboard/clients/${clientId}`);
}

// Manual counterpart to resolveIncomingCall (calls/actions.ts) — lets staff
// claim a phone number for this client up front, from the checkbox next to
// the number on their card, without waiting for an ambiguous call to prompt
// for it. Same phone_owner_overrides table, same effect on /api/incoming-call.
export async function setCallerIdOwner(
  clientId: string,
  phoneNumber: string,
  isOwner: boolean,
): Promise<{ error: string } | { ok: true }> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const normalized = normalizeGreekPhone(phoneNumber);
  if (!normalized) return { error: "Μη έγκυρο τηλέφωνο." };

  if (isOwner) {
    const { error } = await supabase
      .from("phone_owner_overrides")
      .upsert(
        { phone_number: normalized, client_id: clientId, set_by: agencyUser.id, set_at: new Date().toISOString() },
        { onConflict: "phone_number" },
      );
    if (error) return { error: "Σφάλμα κατά την αποθήκευση: " + error.message };
  } else {
    const { error } = await supabase
      .from("phone_owner_overrides")
      .delete()
      .eq("phone_number", normalized)
      .eq("client_id", clientId);
    if (error) return { error: "Σφάλμα κατά την αφαίρεση: " + error.message };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true };
}

export async function updateClientProfile(
  clientId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const marketingOptIn = formData.get("marketing_opt_in") === "on";
  const priorConsentAt = (formData.get("prior_gdpr_consent_at") as string) || null;
  // Checking the box for the first time stamps consent now; leaving it
  // checked keeps the original consent date instead of bumping it on every
  // unrelated profile edit; unchecking clears it.
  const gdprConsentAt = marketingOptIn ? (priorConsentAt ?? new Date().toISOString()) : null;

  const incomeRaw = formData.get("income") as string;
  const income = incomeRaw ? Number(incomeRaw) : null;

  const { error } = await supabase
    .from("clients")
    .update({
      marketing_opt_in: marketingOptIn,
      gdpr_consent_at: gdprConsentAt,
      income,
      marital_status: (formData.get("marital_status") as string) || null,
      nationality: (formData.get("nationality") as string) || null,
      language: (formData.get("language") as string) || null,
    })
    .eq("id", clientId);

  if (error) {
    return { error: "Σφάλμα κατά την αποθήκευση: " + error.message };
  }

  await logActivity(supabase, {
    entityType: "client",
    entityId: clientId,
    action: "profile_updated",
    description: "Ενημερώθηκε το προφίλ.",
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
}

// Powers the clients list page's default "last 50 visited" view. Fired
// from a client-side useEffect (VisitTracker), never called directly from
// a server component render — Next.js runs server-component side effects
// on <Link> prefetch too, which would log a "visit" from a plain hover.
export async function recordClientVisit(clientId: string) {
  const agencyUser = await getCurrentAgencyUser();
  if (!agencyUser) return;
  const supabase = await createSupabaseClient();
  await supabase.from("client_visits").upsert(
    { client_id: clientId, agency_user_id: agencyUser.id, visited_at: new Date().toISOString() },
    { onConflict: "client_id,agency_user_id" },
  );
}
