import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, renderTemplate, buildPolicyMergeFields } from "@/lib/email";

type PolicyRow = {
  id: string;
  policy_number: string;
  end_date: string;
  insurance_lines: { name_el: string } | { name_el: string }[] | null;
  carriers: { name: string } | { name: string }[] | null;
  clients: {
    email: string | null;
    display_name: string | null;
  } | {
    email: string | null;
    display_name: string | null;
  }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function sendBatch(
  supabase: ReturnType<typeof createAdminClient>,
  daysRemaining: 30 | 7,
  sentColumn: "renewal_notice_30d_sent_at" | "renewal_notice_7d_sent_at",
  templateKey: "renewal_30d" | "renewal_7d",
) {
  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body, is_active")
    .eq("key", templateKey)
    .maybeSingle();

  if (!template || !template.is_active) {
    return { sent: 0, skipped: 0, errors: [`template ${templateKey} missing or inactive`] };
  }

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysRemaining);

  const { data: policies } = await supabase
    .from("policies")
    .select(
      "id, policy_number, end_date, insurance_lines(name_el), carriers(name), clients(email, display_name)",
    )
    .in("status", ["active", "pending_renewal"])
    .is(sentColumn, null)
    .gte("end_date", today.toISOString().slice(0, 10))
    .lte("end_date", cutoff.toISOString().slice(0, 10));

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const p of (policies ?? []) as PolicyRow[]) {
    const client = one(p.clients);
    if (!client?.email) {
      skipped++;
      continue;
    }

    const line = one(p.insurance_lines);
    const carrier = one(p.carriers);

    const fields = buildPolicyMergeFields({
      clientName: client.display_name ?? "πελάτη",
      policyNumber: p.policy_number,
      lineName: line?.name_el ?? "—",
      carrierName: carrier?.name ?? "—",
      endDate: p.end_date,
      daysRemaining,
    });

    const result = await sendEmail({
      to: client.email,
      subject: renderTemplate(template.subject, fields),
      html: renderTemplate(template.body, fields),
    });

    if (result.ok) {
      sent++;
      await supabase.from("policies").update({ [sentColumn]: new Date().toISOString() }).eq("id", p.id);
    } else {
      errors.push(`${p.policy_number}: ${result.error}`);
    }
  }

  return { sent, skipped, errors };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: setting } = await supabase
    .from("app_settings")
    .select("enabled")
    .eq("key", "renewal_reminder_emails")
    .maybeSingle();

  if (setting && !setting.enabled) {
    return Response.json({ skipped: "renewal_reminder_emails is disabled in Settings" });
  }

  const [result30, result7] = await Promise.all([
    sendBatch(supabase, 30, "renewal_notice_30d_sent_at", "renewal_30d"),
    sendBatch(supabase, 7, "renewal_notice_7d_sent_at", "renewal_7d"),
  ]);

  return Response.json({ notice30: result30, notice7: result7 });
}
