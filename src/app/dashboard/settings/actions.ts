"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
import { isValidEmail } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";
import { CACHE_TAGS } from "@/lib/cache-tags";

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

export async function requireAdmin() {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    throw new Error("Δεν έχεις δικαίωμα για αυτή την ενέργεια.");
  }
  return agencyUser;
}

// Logo is stored at a fixed path (upsert: true) rather than one file per
// upload — there's only ever one current logo, so this avoids accumulating
// orphaned files in the bucket and sidesteps stale-extension mismatches
// (storage serves by the object's stored content-type, not the path).
export async function updateAgencyProfile(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const agencyUser = await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = (formData.get("name") as string) || null;
  const address = (formData.get("address") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const email = (formData.get("email") as string) || null;
  if (email && !isValidEmail(email)) {
    return { error: "Μη έγκυρο email." };
  }

  const { data: existing } = await supabase
    .from("agency_profile")
    .select("logo_storage_path")
    .eq("key", "default")
    .maybeSingle();

  let logoStoragePath = existing?.logo_storage_path ?? null;

  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    const { error: uploadError } = await supabase.storage
      .from("agency-assets")
      .upload("logo/current", logoFile, { contentType: logoFile.type || undefined, upsert: true });
    if (uploadError) {
      return { error: "Σφάλμα κατά το ανέβασμα του λογότυπου: " + uploadError.message };
    }
    logoStoragePath = "logo/current";
  }

  const { error } = await supabase.from("agency_profile").upsert({
    key: "default",
    name,
    address,
    phone,
    email,
    logo_storage_path: logoStoragePath,
    updated_by: agencyUser.id,
  });
  if (error) {
    return { error: "Σφάλμα κατά την αποθήκευση: " + error.message };
  }

  updateTag(CACHE_TAGS.agencyProfile);
  revalidatePath("/dashboard/settings");
  return { success: "Τα στοιχεία γραφείου αποθηκεύτηκαν." };
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

  updateTag(CACHE_TAGS.carriers);
  revalidatePath("/dashboard/settings");
}

export async function toggleCarrierActive(carrierId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("carriers").update({ is_active: isActive }).eq("id", carrierId);
  updateTag(CACHE_TAGS.carriers);
  revalidatePath("/dashboard/settings");
}

export async function updateCarrier(carrierId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = formData.get("name") as string;
  if (!name) return;

  await supabase
    .from("carriers")
    .update({
      name,
      legal_name: (formData.get("legal_name") as string) || null,
      contact_phone: (formData.get("contact_phone") as string) || null,
      contact_email: (formData.get("contact_email") as string) || null,
      assistance_phone: (formData.get("assistance_phone") as string) || null,
      claims_phone: (formData.get("claims_phone") as string) || null,
      claims_email: (formData.get("claims_email") as string) || null,
    })
    .eq("id", carrierId);

  updateTag(CACHE_TAGS.carriers);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/policies", "layout");
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


export async function createEmailTemplate(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = formData.get("name") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;
  if (!name || !subject || !body) return;

  await supabase.from("email_templates").insert({ name, subject, body });

  revalidatePath("/dashboard/settings");
  updateTag(CACHE_TAGS.celebrationTemplates);
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
  updateTag(CACHE_TAGS.celebrationTemplates);
}

export async function toggleEmailTemplateActive(templateId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("email_templates").update({ is_active: isActive }).eq("id", templateId);
  revalidatePath("/dashboard/settings");
  updateTag(CACHE_TAGS.celebrationTemplates);
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
  updateTag(CACHE_TAGS.agencyUsers);
}

export async function toggleAgencyUserActive(userId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("agency_users").update({ is_active: isActive }).eq("id", userId);
  await supabase.from("commission_payees").update({ is_active: isActive }).eq("agency_user_id", userId);

  // RLS already locks a deactivated user out of every table, but their auth
  // session would otherwise stay technically valid — ban the login itself
  // too (and lift the ban on reactivation).
  const { data: target } = await supabase
    .from("agency_users")
    .select("auth_user_id")
    .eq("id", userId)
    .maybeSingle();
  if (target?.auth_user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(target.auth_user_id, {
      ban_duration: isActive ? "none" : "876000h",
    });
  }

  revalidatePath("/dashboard/settings");
  updateTag(CACHE_TAGS.agencyUsers);
}

// Full profile edit from the agent's own detail page — name/phone/hire
// date/role together, plus the login email if it changed
// (which also has to update auth.users, not just the agency_users row, or
// the two would drift apart and the agent couldn't log in with the new
// address). Same (clientId, formData) => {error}|undefined convention as
// updateClientNotes, since the detail page's edit card follows the same
// toggle-edit-mode UI as the client page's Στοιχεία tab.
export async function updateAgencyUserProfile(
  userId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const fullName = (formData.get("full_name") as string) || "";
  const email = (formData.get("email") as string) || "";
  const phone = (formData.get("phone") as string) || null;
  const hireDate = (formData.get("hire_date") as string) || null;
  const role = (formData.get("role") as string) || "agent";

  if (!fullName) return { error: "Δώσε ονοματεπώνυμο." };
  if (!isValidEmail(email)) return { error: "Δώσε ένα έγκυρο email." };

  const { data: current } = await supabase
    .from("agency_users")
    .select("auth_user_id, email, is_active")
    .eq("id", userId)
    .single();

  if (!current) return { error: "Ο συνεργάτης δεν βρέθηκε." };

  if (email !== current.email) {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(current.auth_user_id, { email });
    if (authError) {
      return { error: "Σφάλμα ενημέρωσης email σύνδεσης: " + authError.message };
    }
  }

  const { error } = await supabase
    .from("agency_users")
    .update({
      full_name: fullName,
      email,
      phone,
      hire_date: hireDate,
      role,
    })
    .eq("id", userId);

  if (error) return { error: "Σφάλμα: " + error.message };

  await syncPayeeForAgencyUser(supabase, {
    id: userId,
    full_name: fullName,
    email,
    phone,
    is_active: current.is_active,
  });

  revalidatePath(`/dashboard/settings/team/${userId}`);
  revalidatePath("/dashboard/settings");
  updateTag(CACHE_TAGS.agencyUsers);
}

// Admin-set password for a locked-out συνεργάτης — the recovery path when
// the self-service "Ξέχασα τον κωδικό μου" email flow isn't an option
// (no email access, typo'd address, etc.).
export async function adminSetUserPassword(
  userId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const password = (formData.get("password") as string) || "";
  const confirm = (formData.get("confirm_password") as string) || "";
  if (password.length < 8) {
    return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες." };
  }
  if (password !== confirm) {
    return { error: "Οι κωδικοί δεν ταιριάζουν." };
  }

  const supabase = await createSupabaseClient();
  const { data: target } = await supabase
    .from("agency_users")
    .select("auth_user_id, full_name")
    .eq("id", userId)
    .single();
  if (!target) return { error: "Ο συνεργάτης δεν βρέθηκε." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, { password });
  if (error) return { error: "Σφάλμα ορισμού κωδικού: " + error.message };

  return { success: `Ορίστηκε νέος κωδικός για τον/την ${target.full_name}.` };
}

// Μεταφορά χαρτοφυλακίου — όταν φεύγει (ή αλλάζει ρόλο) ένας συνεργάτης:
// όλοι οι πελάτες, τα συμβόλαιά τους και οι ανοιχτές εκκρεμότητες
// (υπενθυμίσεις/αιτήματα) περνούν μαζικά σε άλλον. Ιστορικά δεδομένα
// (κινήσεις, εισπράξεις, προμήθειες) μένουν στον αρχικό — αφορούν το
// παρελθόν του.
export async function transferPortfolio(
  fromUserId: string,
  toUserId: string,
): Promise<{ error: string } | { success: string }> {
  const actingUser = await requireAdmin();
  if (fromUserId === toUserId) return { error: "Επίλεξε διαφορετικό συνεργάτη-παραλήπτη." };
  const supabase = await createSupabaseClient();

  const [{ data: fromUser }, { data: toUser }] = await Promise.all([
    supabase.from("agency_users").select("id, full_name").eq("id", fromUserId).maybeSingle(),
    supabase.from("agency_users").select("id, full_name, is_active").eq("id", toUserId).maybeSingle(),
  ]);
  if (!fromUser || !toUser) return { error: "Δεν βρέθηκε ο συνεργάτης." };
  if (!toUser.is_active) return { error: "Ο παραλήπτης είναι ανενεργός." };

  const { count: clientCount, error: clientsError } = await supabase
    .from("clients")
    .update({ assigned_agent_id: toUserId }, { count: "exact" })
    .eq("assigned_agent_id", fromUserId);
  if (clientsError) return { error: "Σφάλμα στη μεταφορά πελατών: " + clientsError.message };

  const { count: policyCount, error: policiesError } = await supabase
    .from("policies")
    .update({ assigned_agent_id: toUserId }, { count: "exact" })
    .eq("assigned_agent_id", fromUserId);
  if (policiesError) return { error: "Σφάλμα στη μεταφορά συμβολαίων: " + policiesError.message };

  await supabase
    .from("tasks")
    .update({ assigned_to: toUserId })
    .eq("assigned_to", fromUserId)
    .eq("status", "pending");
  await supabase
    .from("client_tickets")
    .update({ assigned_to: toUserId })
    .eq("assigned_to", fromUserId)
    .in("status", ["open", "in_progress"]);

  const summary = `Μεταφέρθηκε το χαρτοφυλάκιο του/της ${fromUser.full_name} στον/στην ${toUser.full_name}: ${clientCount ?? 0} πελάτες, ${policyCount ?? 0} συμβόλαια, συν ανοιχτές υπενθυμίσεις/αιτήματα.`;
  await logActivity(supabase, {
    entityType: "agency_user",
    entityId: fromUserId,
    action: "portfolio_transferred",
    description: summary,
    actorId: actingUser.id,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath(`/dashboard/settings/team/${fromUserId}`);
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/policies");
  updateTag(CACHE_TAGS.agencyUsers);
  return { success: summary };
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
  updateTag(CACHE_TAGS.agencyUsers);
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
  updateTag(CACHE_TAGS.agencyUsers);
  return { success: `Ο/Η ${fullName} καταχωρήθηκε — μπορεί να συνδεθεί άμεσα με το email και τον κωδικό.` };
}
