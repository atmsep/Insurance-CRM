import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, renderTemplate } from "@/lib/email";
import { getNameDay } from "@/lib/name-days";

type CelebrationType = "name_day" | "birthday";

type ClientRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  assigned_agent_id: string | null;
  client_individuals:
    | { first_name: string; date_of_birth: string | null }
    | { first_name: string; date_of_birth: string | null }[]
    | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const TITLES: Record<CelebrationType, (name: string) => string> = {
  name_day: (name) => `Σήμερα γιορτάζει ο/η ${name}`,
  birthday: (name) => `Σήμερα έχει γενέθλια ο/η ${name}`,
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const [{ data: taskSetting }, { data: emailSetting }] = await Promise.all([
    supabase.from("app_settings").select("enabled").eq("key", "celebration_tasks").maybeSingle(),
    supabase.from("app_settings").select("enabled").eq("key", "celebration_emails").maybeSingle(),
  ]);
  const tasksEnabled = taskSetting ? taskSetting.enabled : true;
  const emailsEnabled = emailSetting ? emailSetting.enabled : true;

  if (!tasksEnabled && !emailsEnabled) {
    return Response.json({ skipped: "celebration automations disabled in Settings" });
  }

  // "Today" in Greece, not wherever the cron happens to run — a client's
  // name-day/birthday has to line up with the local calendar date.
  const athensDate = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
  const [, monthStr, dayStr] = athensDate.split("-");
  const month = Number(monthStr);
  const day = Number(dayStr);

  const { data: clients } = await supabase
    .from("clients")
    .select("id, email, display_name, assigned_agent_id, client_individuals(first_name, date_of_birth)")
    .eq("client_type", "individual")
    .eq("is_active", true);

  const matches: { client: ClientRow; type: CelebrationType }[] = [];
  for (const c of (clients ?? []) as ClientRow[]) {
    const individual = one(c.client_individuals);
    if (!individual) continue;

    const nameDay = getNameDay(individual.first_name);
    if (nameDay && nameDay.month === month && nameDay.day === day) {
      matches.push({ client: c, type: "name_day" });
    }

    if (individual.date_of_birth) {
      const dob = new Date(individual.date_of_birth);
      if (dob.getUTCMonth() + 1 === month && dob.getUTCDate() === day) {
        matches.push({ client: c, type: "birthday" });
      }
    }
  }

  if (matches.length === 0) {
    return Response.json({ matched: 0 });
  }

  const { data: fallbackAgent } = await supabase
    .from("agency_users")
    .select("id")
    .in("role", ["owner", "admin"])
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const [{ data: nameDayTemplate }, { data: birthdayTemplate }] = await Promise.all([
    supabase.from("email_templates").select("subject, body, is_active").eq("key", "name_day").maybeSingle(),
    supabase.from("email_templates").select("subject, body, is_active").eq("key", "birthday").maybeSingle(),
  ]);
  const templates: Record<CelebrationType, { subject: string; body: string; is_active: boolean } | null> = {
    name_day: nameDayTemplate,
    birthday: birthdayTemplate,
  };

  let tasksCreated = 0;
  let emailsSent = 0;
  const errors: string[] = [];

  for (const { client, type } of matches) {
    // Idempotent: the unique constraint on (client_id, celebration_type,
    // celebration_date) makes a second cron run the same day a no-op —
    // claim the slot first, then fill in what actually happened below.
    const { error: logError } = await supabase.from("client_celebrations_log").insert({
      client_id: client.id,
      celebration_type: type,
      celebration_date: athensDate,
    });
    if (logError) continue;

    const name = client.display_name ?? "τον πελάτη";
    let taskId: string | null = null;

    if (tasksEnabled) {
      const assignee = client.assigned_agent_id ?? fallbackAgent?.id ?? null;
      if (assignee) {
        const { data: task } = await supabase
          .from("tasks")
          .insert({
            title: TITLES[type](name),
            task_type: type,
            assigned_to: assignee,
            client_id: client.id,
            due_date: athensDate,
            priority: "medium",
          })
          .select("id")
          .single();
        taskId = task?.id ?? null;
        if (taskId) tasksCreated++;
      }
    }

    let emailWasSent = false;
    if (emailsEnabled && client.email) {
      const template = templates[type];
      if (template && template.is_active) {
        const fields = {
          client_name: name,
          agency_name: process.env.AGENCY_NAME || "το ασφαλιστικό μας γραφείο",
        };
        const result = await sendEmail({
          to: client.email,
          subject: renderTemplate(template.subject, fields),
          html: renderTemplate(template.body, fields),
        });
        if (result.ok) {
          emailWasSent = true;
          emailsSent++;
        } else {
          errors.push(`${name}: ${result.error}`);
        }
      }
    }

    await supabase
      .from("client_celebrations_log")
      .update({ task_id: taskId, email_sent: emailWasSent })
      .eq("client_id", client.id)
      .eq("celebration_type", type)
      .eq("celebration_date", athensDate);
  }

  return Response.json({ matched: matches.length, tasksCreated, emailsSent, errors });
}
