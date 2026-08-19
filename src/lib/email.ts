import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencyProfile } from "@/lib/agency-profile";

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
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
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

// Appended to every outgoing email — manual (policy/celebration compose)
// and automated (renewal-reminder cron) alike — so office branding can't
// be missed just because a template's own body doesn't reference
// {{agency_name}}. Fetched fresh (not the unstable_cache-wrapped getter in
// cached-queries/lookups.ts) to avoid a circular import: that module
// already imports from celebrations.ts, which imports renderTemplate from
// this file. Uncached is fine here — sending mail is not a hot path.
async function buildAgencyFooterHtml(): Promise<string> {
  const admin = createAdminClient();
  const profile = await getAgencyProfile(admin as unknown as Parameters<typeof getAgencyProfile>[0]);
  if (!profile.name && !profile.address && !profile.phone && !profile.email && !profile.logoUrl) {
    return "";
  }

  const logoCell = profile.logoUrl
    ? `<td style="padding-right:12px;vertical-align:top;"><img src="${profile.logoUrl}" alt="${profile.name ?? ""}" style="display:block;max-height:48px;max-width:160px;" /></td>`
    : "";
  const contactLine = [profile.phone, profile.email].filter(Boolean).join(" &middot; ");

  return `
    <table role="presentation" style="margin-top:24px;border-collapse:collapse;">
      <tr>
        <td colspan="2" style="padding-top:16px;border-top:1px solid #e5e5e5;font-size:1px;line-height:1px;">&nbsp;</td>
      </tr>
      <tr>
        ${logoCell}
        <td style="vertical-align:top;font-family:sans-serif;font-size:13px;color:#555;">
          ${profile.name ? `<strong>${profile.name}</strong><br/>` : ""}
          ${profile.address ? `${profile.address}<br/>` : ""}
          ${contactLine}
        </td>
      </tr>
    </table>
  `;
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
  const footer = await buildAgencyFooterHtml();

  const { error } = await resend.emails.send({ from: fromAddress, to, subject, html: html + footer });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
