import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

// Substitutes {{field_name}} tokens in a template's subject/body. Unknown
// fields are left blank rather than left as a literal "{{...}}" — templates
// are user-edited free text, so a typo'd token shouldn't leak into what the
// client receives.
export function renderTemplate(text: string, fields: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => fields[key] ?? "");
}

function formatDateGr(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

// The merge fields available to every policy-related template (manual
// compose and the automated renewal reminders alike).
export function buildPolicyMergeFields({
  clientName,
  policyNumber,
  lineName,
  carrierName,
  endDate,
  daysRemaining,
}: {
  clientName: string;
  policyNumber: string;
  lineName: string;
  carrierName: string;
  endDate: string;
  daysRemaining?: number;
}): Record<string, string> {
  return {
    client_name: clientName,
    policy_number: policyNumber,
    line_name: lineName,
    carrier_name: carrierName,
    end_date: formatDateGr(endDate),
    days_remaining: daysRemaining != null ? String(daysRemaining) : "",
    agency_name: process.env.AGENCY_NAME || "το ασφαλιστικό μας γραφείο",
  };
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" };

  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const { error } = await resend.emails.send({ from: fromAddress, to, subject, html });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
