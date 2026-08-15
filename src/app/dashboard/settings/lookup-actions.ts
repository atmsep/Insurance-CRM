"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "./actions";

// Whitelist of tables the generic actions below are allowed to touch — the
// table name comes from a bound client argument (see simple-lookup-tab.tsx
// callers), so it must never be passed through unchecked.
const SIMPLE_LOOKUP_TABLES = [
  "banks",
  "client_categories",
  "lead_sources",
  "specialties",
  "vehicle_brands",
  "vehicle_usages",
  "currencies",
  "collection_centers",
  "occupations",
  "claim_categories",
] as const;

export type SimpleLookupTable = (typeof SIMPLE_LOOKUP_TABLES)[number];

function assertTable(table: SimpleLookupTable) {
  if (!SIMPLE_LOOKUP_TABLES.includes(table)) {
    throw new Error("Άγνωστος πίνακας.");
  }
}

// The parametric-tables tab fetches each sub-tab's rows lazily (on first
// activation) instead of the settings page loading all of them eagerly —
// some of these (occupations, areas) run into the thousands of rows, which
// made the whole Ρυθμίσεις page slow to load even when nobody opened that
// tab. Paginated with .range() because PostgREST caps every response at
// its own db-max-rows setting (1000 here) no matter what .limit() the
// client asks for — occupations already has 630 rows and could grow past
// that silently.
export async function getLookupRows(table: SimpleLookupTable) {
  assertTable(table);
  await requireAdmin();
  const supabase = await createSupabaseClient();
  const pageSize = 1000;
  const all: { id: string; name: string; is_active: boolean }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data } = await supabase
      .from(table)
      .select("id, name, is_active")
      .order("sort_order")
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

export async function createLookupRow(table: SimpleLookupTable, formData: FormData) {
  assertTable(table);
  await requireAdmin();
  const name = formData.get("name") as string;
  if (!name) return;
  const supabase = await createSupabaseClient();
  await supabase.from(table).insert({ name });
  revalidatePath("/dashboard/settings");
}

export async function updateLookupRow(
  table: SimpleLookupTable,
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  assertTable(table);
  await requireAdmin();
  const name = formData.get("name") as string;
  if (!name) return { error: "Το όνομα είναι υποχρεωτικό." };
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from(table).update({ name }).eq("id", id);
  if (error) return { error: "Σφάλμα αποθήκευσης." };
  revalidatePath("/dashboard/settings");
  return {};
}

export async function toggleLookupRowActive(table: SimpleLookupTable, id: string, isActive: boolean) {
  assertTable(table);
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from(table).update({ is_active: isActive }).eq("id", id);
  revalidatePath("/dashboard/settings");
}

export async function deleteLookupRow(table: SimpleLookupTable, id: string): Promise<{ error?: string }> {
  assertTable(table);
  await requireAdmin();
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Δεν μπορεί να διαγραφεί — χρησιμοποιείται ήδη αλλού."
          : "Σφάλμα διαγραφής.",
    };
  }
  revalidatePath("/dashboard/settings");
  return {};
}

// Areas (ΤΚ/Πόλη/Περιφέρεια) has its own shape (no single "name" field), so
// it gets its own small set of actions instead of going through the
// generic simple-lookup table whitelist above.

export async function getAreas() {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  // PostgREST caps every response at its own db-max-rows setting (1000 on
  // this project) no matter what .limit() the client asks for — areas has
  // 1429 rows, so a single request silently truncates. Page through with
  // .range() until a page comes back short.
  const pageSize = 1000;
  const all: { id: string; postal_code: string | null; city: string; region: string | null; is_active: boolean }[] =
    [];
  for (let from = 0; ; from += pageSize) {
    const { data } = await supabase
      .from("areas")
      .select("id, postal_code, city, region, is_active")
      .order("postal_code")
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

export async function createArea(formData: FormData) {
  await requireAdmin();
  const city = formData.get("city") as string;
  if (!city) return;
  const supabase = await createSupabaseClient();
  await supabase.from("areas").insert({
    city,
    postal_code: (formData.get("postal_code") as string) || null,
    region: (formData.get("region") as string) || null,
  });
  revalidatePath("/dashboard/settings");
}

export async function updateArea(id: string, formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const city = formData.get("city") as string;
  if (!city) return { error: "Η πόλη είναι υποχρεωτική." };
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("areas")
    .update({
      city,
      postal_code: (formData.get("postal_code") as string) || null,
      region: (formData.get("region") as string) || null,
    })
    .eq("id", id);
  if (error) return { error: "Σφάλμα αποθήκευσης." };
  revalidatePath("/dashboard/settings");
  return {};
}

export async function toggleAreaActive(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("areas").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/dashboard/settings");
}

export async function deleteArea(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("areas").delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Δεν μπορεί να διαγραφεί — χρησιμοποιείται ήδη αλλού."
          : "Σφάλμα διαγραφής.",
    };
  }
  revalidatePath("/dashboard/settings");
  return {};
}

// insurance_lines has richer columns (code, feature flags) than the simple
// lookups above but the same UI shape — its own dedicated actions.

export async function getInsuranceLinesFull() {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  const { data } = await supabase
    .from("insurance_lines")
    .select(
      "id, code, name_el, requires_vehicle_details, requires_property_details, requires_life_health_details, is_active",
    )
    .order("sort_order");
  return data ?? [];
}

export async function createInsuranceLine(formData: FormData) {
  await requireAdmin();
  const code = (formData.get("code") as string)?.toUpperCase();
  const nameEl = formData.get("name_el") as string;
  if (!code || !nameEl) return;
  const supabase = await createSupabaseClient();
  await supabase.from("insurance_lines").insert({
    code,
    name_el: nameEl,
    requires_vehicle_details: formData.get("requires_vehicle_details") === "on",
    requires_property_details: formData.get("requires_property_details") === "on",
    requires_life_health_details: formData.get("requires_life_health_details") === "on",
  });
  revalidatePath("/dashboard/settings");
}

export async function updateInsuranceLine(id: string, formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const nameEl = formData.get("name_el") as string;
  if (!nameEl) return { error: "Το όνομα είναι υποχρεωτικό." };
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("insurance_lines")
    .update({
      name_el: nameEl,
      requires_vehicle_details: formData.get("requires_vehicle_details") === "on",
      requires_property_details: formData.get("requires_property_details") === "on",
      requires_life_health_details: formData.get("requires_life_health_details") === "on",
    })
    .eq("id", id);
  if (error) return { error: "Σφάλμα αποθήκευσης." };
  revalidatePath("/dashboard/settings");
  return {};
}

export async function toggleInsuranceLineActive(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("insurance_lines").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/dashboard/settings");
}

export async function deleteInsuranceLine(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("insurance_lines").delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Δεν μπορεί να διαγραφεί — χρησιμοποιείται ήδη αλλού."
          : "Σφάλμα διαγραφής.",
    };
  }
  revalidatePath("/dashboard/settings");
  return {};
}
