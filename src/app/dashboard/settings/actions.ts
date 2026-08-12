"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
import { isValidEmail } from "@/lib/validation";

export type ActionState = { error: string } | { success: string } | undefined;

export async function updatePassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!newPassword || newPassword.length < 8) {
    return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Οι κωδικοί δεν ταιριάζουν." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: "Σφάλμα: " + error.message };
  }

  return { success: "Ο κωδικός άλλαξε επιτυχώς." };
}

async function requireAdmin() {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    throw new Error("Δεν έχεις δικαίωμα για αυτή την ενέργεια.");
  }
  return agencyUser;
}

// Δικαιούχοι Προμηθειών ARE the team's own συνεργάτες — every agency_user
// gets a linked commission_payees row (is_external = false) kept in sync
// here instead of requiring a separate manual "Προσθήκη δικαιούχου" entry.
// Genuinely external collaborators (no CRM login) still go through the
// payees tab's own create form, which never sets agency_user_id.
async function syncPayeeForAgencyUser(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  agencyUser: { id: string; full_name: string; email: string; phone?: string | null; is_active?: boolean },
) {
  await supabase.from("commission_payees").upsert(
    {
      agency_user_id: agencyUser.id,
      name: agencyUser.full_name,
      email: agencyUser.email,
      phone: agencyUser.phone ?? null,
      is_external: false,
      is_active: agencyUser.is_active ?? true,
    },
    { onConflict: "agency_user_id" },
  );
}

export async function createCarrier(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = formData.get("name") as string;
  if (!name) return;

  await supabase.from("carriers").insert({
    name,
    legal_name: (formData.get("legal_name") as string) || null,
    contact_phone: (formData.get("contact_phone") as string) || null,
    contact_email: (formData.get("contact_email") as string) || null,
  });

  revalidatePath("/dashboard/settings");
}

export async function toggleCarrierActive(carrierId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("carriers").update({ is_active: isActive }).eq("id", carrierId);
  revalidatePath("/dashboard/settings");
}

export async function createPayee(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = formData.get("name") as string;
  if (!name) return;

  await supabase.from("commission_payees").insert({
    name,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
  });

  revalidatePath("/dashboard/settings");
}

export async function togglePayeeActive(payeeId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("commission_payees").update({ is_active: isActive }).eq("id", payeeId);
  revalidatePath("/dashboard/settings");
}

export async function createBrokerOffice(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = formData.get("name") as string;
  if (!name) return;

  await supabase.from("broker_offices").insert({
    name,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
  });

  revalidatePath("/dashboard/settings");
}

export async function toggleBrokerOfficeActive(brokerOfficeId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase
    .from("broker_offices")
    .update({ is_active: isActive })
    .eq("id", brokerOfficeId)
    .eq("is_direct", false);
  revalidatePath("/dashboard/settings");
}

export async function createCarrierCommissionRate(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const brokerOfficeId = formData.get("broker_office_id") as string;
  const carrierId = formData.get("carrier_id") as string;
  const insuranceLineId = formData.get("insurance_line_id") as string;
  const percent = formData.get("default_commission_percent");

  if (!brokerOfficeId || !carrierId || !insuranceLineId || !percent) {
    return { error: "Συμπλήρωσε γραφείο, εταιρεία, κλάδο και ποσοστό." };
  }

  const { error } = await supabase.from("carrier_commission_rates").insert({
    broker_office_id: brokerOfficeId,
    carrier_id: carrierId,
    insurance_line_id: insuranceLineId,
    default_commission_percent: Number(percent),
    valid_from: (formData.get("valid_from") as string) || undefined,
    valid_to: (formData.get("valid_to") as string) || null,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "Υπάρχει ήδη ενεργή σύμβαση για αυτό το γραφείο/εταιρεία/κλάδο με την ίδια ημερομηνία έναρξης.",
      };
    }
    return { error: "Σφάλμα κατά την αποθήκευση: " + error.message };
  }

  revalidatePath("/dashboard/settings");
}

export async function updateCarrierCommissionRate(
  rateId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const percent = formData.get("default_commission_percent");
  if (!percent) {
    return { error: "Συμπλήρωσε το ποσοστό." };
  }

  const { error } = await supabase
    .from("carrier_commission_rates")
    .update({
      default_commission_percent: Number(percent),
      valid_from: (formData.get("valid_from") as string) || undefined,
      valid_to: (formData.get("valid_to") as string) || null,
    })
    .eq("id", rateId);

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "Υπάρχει ήδη ενεργή σύμβαση για αυτό το γραφείο/εταιρεία/κλάδο με την ίδια ημερομηνία έναρξης.",
      };
    }
    return { error: "Σφάλμα κατά την αποθήκευση: " + error.message };
  }

  revalidatePath("/dashboard/settings");
}

export async function toggleCarrierCommissionRateActive(rateId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("carrier_commission_rates").update({ is_active: isActive }).eq("id", rateId);
  revalidatePath("/dashboard/settings");
}

export async function createPaymentMethod(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = formData.get("name") as string;
  if (!name) return;

  await supabase.from("payment_methods").insert({ name });

  revalidatePath("/dashboard/settings");
}

export async function togglePaymentMethodActive(paymentMethodId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase
    .from("payment_methods")
    .update({ is_active: isActive })
    .eq("id", paymentMethodId);
  revalidatePath("/dashboard/settings");
}

export async function createEmailTemplate(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = formData.get("name") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;
  if (!name || !subject || !body) return;

  await supabase.from("email_templates").insert({ name, subject, body });

  revalidatePath("/dashboard/settings");
}

export async function updateEmailTemplate(templateId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = formData.get("name") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;
  if (!name || !subject || !body) return;

  await supabase.from("email_templates").update({ name, subject, body }).eq("id", templateId);

  revalidatePath("/dashboard/settings");
}

export async function toggleEmailTemplateActive(templateId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("email_templates").update({ is_active: isActive }).eq("id", templateId);
  revalidatePath("/dashboard/settings");
}

export async function toggleAppSetting(key: string, enabled: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("app_settings").update({ enabled }).eq("key", key);
  revalidatePath("/dashboard/settings");
}

export async function updateRenewalReminderDays(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const primary = Number(formData.get("primary_days"));
  const final = Number(formData.get("final_days"));

  if (!Number.isInteger(primary) || primary < 1 || !Number.isInteger(final) || final < 1) {
    return { error: "Οι μέρες πρέπει να είναι θετικοί ακέραιοι αριθμοί." };
  }
  if (final >= primary) {
    return { error: "Η τελευταία υπενθύμιση πρέπει να είναι λιγότερες μέρες πριν τη λήξη από την πρώτη." };
  }

  await Promise.all([
    supabase.from("app_settings").update({ value: primary }).eq("key", "renewal_reminder_days_primary"),
    supabase.from("app_settings").update({ value: final }).eq("key", "renewal_reminder_days_final"),
  ]);

  revalidatePath("/dashboard/settings");
  return { success: "Οι μέρες υπενθύμισης ενημερώθηκαν." };
}

export async function updateAgencyUserRole(userId: string, role: string) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("agency_users").update({ role }).eq("id", userId);
  revalidatePath("/dashboard/settings");
}

export async function toggleAgencyUserActive(userId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("agency_users").update({ is_active: isActive }).eq("id", userId);
  await supabase.from("commission_payees").update({ is_active: isActive }).eq("agency_user_id", userId);
  revalidatePath("/dashboard/settings");
}

export async function updateAgencyUserCreditLimit(userId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  const raw = formData.get("credit_limit");
  const value = typeof raw === "string" && raw.length > 0 ? Number(raw) : null;
  await supabase.from("agency_users").update({ credit_limit: value }).eq("id", userId);
  revalidatePath("/dashboard/settings");
}

export async function inviteAgencyUser(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const email = (formData.get("email") as string) || "";
  const fullName = (formData.get("full_name") as string) || "";
  const role = (formData.get("role") as string) || "agent";

  if (!isValidEmail(email)) {
    return { error: "Δώσε ένα έγκυρο email." };
  }
  if (!fullName) {
    return { error: "Δώσε ονοματεπώνυμο." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);

  if (error || !data.user) {
    return { error: "Σφάλμα πρόσκλησης: " + (error?.message ?? "") };
  }

  const supabase = await createSupabaseClient();
  const { data: newUser, error: insertError } = await supabase
    .from("agency_users")
    .insert({ auth_user_id: data.user.id, full_name: fullName, email, role })
    .select("id")
    .single();

  if (insertError || !newUser) {
    // Compensate: the invited auth user has no matching profile — remove it
    // rather than leave an orphaned login with no agency_users row.
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Σφάλμα καταχώρησης προφίλ: " + (insertError?.message ?? "") };
  }

  await syncPayeeForAgencyUser(supabase, { id: newUser.id, full_name: fullName, email });

  revalidatePath("/dashboard/settings");
  return { success: `Στάλθηκε πρόσκληση στο ${email}.` };
}

export async function createAgencyUserDirect(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const email = (formData.get("email") as string) || "";
  const fullName = (formData.get("full_name") as string) || "";
  const role = (formData.get("role") as string) || "agent";
  const password = (formData.get("password") as string) || "";

  if (!isValidEmail(email)) {
    return { error: "Δώσε ένα έγκυρο email." };
  }
  if (!fullName) {
    return { error: "Δώσε ονοματεπώνυμο." };
  }
  if (password.length < 8) {
    return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες." };
  }

  const admin = createAdminClient();
  // email_confirm: true — the account is usable immediately with the
  // password given here, no invite email / confirmation step involved.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    return { error: "Σφάλμα δημιουργίας λογαριασμού: " + (error?.message ?? "") };
  }

  const supabase = await createSupabaseClient();
  const { data: newUser, error: insertError } = await supabase
    .from("agency_users")
    .insert({ auth_user_id: data.user.id, full_name: fullName, email, role })
    .select("id")
    .single();

  if (insertError || !newUser) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Σφάλμα καταχώρησης προφίλ: " + (insertError?.message ?? "") };
  }

  await syncPayeeForAgencyUser(supabase, { id: newUser.id, full_name: fullName, email });

  revalidatePath("/dashboard/settings");
  return { success: `Ο/Η ${fullName} καταχωρήθηκε — μπορεί να συνδεθεί άμεσα με το email και τον κωδικό.` };
}
