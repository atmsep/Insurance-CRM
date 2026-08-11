import type { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { renderTemplate } from "@/lib/email";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

export type CelebrationType = "name_day" | "birthday";

export const CELEBRATION_ICONS: Record<CelebrationType, string> = {
  name_day: "🎉",
  birthday: "🎂",
};

export const CELEBRATION_LABELS: Record<CelebrationType, string> = {
  name_day: "Γιορτή",
  birthday: "Γενέθλια",
};

export function isCelebrationType(value: string): value is CelebrationType {
  return value === "name_day" || value === "birthday";
}

type CelebrationTemplate = { subject: string; body: string } | null;

export type CelebrationTemplates = Record<CelebrationType, CelebrationTemplate>;

export async function getCelebrationTemplates(supabase: SupabaseClient): Promise<CelebrationTemplates> {
  const { data } = await supabase
    .from("email_templates")
    .select("key, subject, body")
    .in("key", ["name_day", "birthday"])
    .eq("is_active", true);

  const templates: CelebrationTemplates = { name_day: null, birthday: null };
  for (const row of data ?? []) {
    if (row.key && isCelebrationType(row.key)) {
      templates[row.key] = { subject: row.subject, body: row.body };
    }
  }
  return templates;
}

// Renders the client's wish text from the system template, or falls back to
// a generic message if the template was deactivated/deleted — the reminder
// task should always be sendable, even without a configured template.
export function buildCelebrationWish(
  template: CelebrationTemplate,
  clientName: string,
): { subject: string; body: string } {
  const fields = {
    client_name: clientName,
    agency_name: process.env.AGENCY_NAME || "το ασφαλιστικό μας γραφείο",
  };
  if (template) {
    return {
      subject: renderTemplate(template.subject, fields),
      body: renderTemplate(template.body, fields),
    };
  }
  return {
    subject: `Χρόνια Πολλά, ${clientName}!`,
    body: `Αγαπητέ/ή ${clientName},\n\nΣας ευχόμαστε χρόνια πολλά!\n\nΜε εκτίμηση,\n${fields.agency_name}`,
  };
}
