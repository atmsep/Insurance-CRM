"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import type { ClientType, InteractionType } from "@/lib/database.types";
import { isValidAfm, isValidAmka, isValidEmail } from "@/lib/validation";

export type ClientFormState = { error: string } | undefined;

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
    address_city: (formData.get("address_city") as string) || null,
    iban: (formData.get("iban") as string) || null,
    notes: (formData.get("notes") as string) || null,
    assigned_agent_id: agencyUser.id,
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
  redirect(`/dashboard/clients/${client.id}`);
}

export async function updateClientNotes(clientId: string, formData: FormData) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  await supabase
    .from("clients")
    .update({
      email: (formData.get("email") as string) || null,
      phone_mobile: (formData.get("phone_mobile") as string) || null,
      address_city: (formData.get("address_city") as string) || null,
      iban: (formData.get("iban") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", clientId);

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
