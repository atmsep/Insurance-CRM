"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";

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
  revalidatePath("/dashboard/settings");
}
