import { createAdminClient } from "@/lib/supabase/admin";
import { getNameDay } from "@/lib/name-days";

type CelebrationType = "name_day" | "birthday";

type ClientRow = {
  id: string;
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

// This job only creates the internal reminder task — sending the actual
// wishes to the client is a deliberate manual step the agent takes by
// clicking the task (see sendCelebrationWish in dashboard/tasks/actions.ts),
// not something this cron does on its own.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: taskSetting } = await supabase
    .from("app_settings")
    .select("enabled")
    .eq("key", "celebration_tasks")
    .maybeSingle();
  const tasksEnabled = taskSetting ? taskSetting.enabled : true;

  if (!tasksEnabled) {
    return Response.json({ skipped: "celebration reminders disabled in Settings" });
  }

  // "Today" in Greece, not wherever the cron happens to run — a client's
  // name-day/birthday has to line up with the local calendar date.
  const athensDate = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
  const [, monthStr, dayStr] = athensDate.split("-");
  const month = Number(monthStr);
  const day = Number(dayStr);

  const { data: clients } = await supabase
    .from("clients")
    .select("id, display_name, assigned_agent_id, client_individuals(first_name, date_of_birth)")
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

  let tasksCreated = 0;

  for (const { client, type } of matches) {
    // Idempotent: the unique constraint on (client_id, celebration_type,
    // celebration_date) makes a second cron run the same day a no-op —
    // claim the slot first, then fill in the task id below.
    const { error: logError } = await supabase.from("client_celebrations_log").insert({
      client_id: client.id,
      celebration_type: type,
      celebration_date: athensDate,
    });
    if (logError) continue;

    const name = client.display_name ?? "τον πελάτη";
    const assignee = client.assigned_agent_id ?? fallbackAgent?.id ?? null;
    let taskId: string | null = null;

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

    await supabase
      .from("client_celebrations_log")
      .update({ task_id: taskId })
      .eq("client_id", client.id)
      .eq("celebration_type", type)
      .eq("celebration_date", athensDate);
  }

  return Response.json({ matched: matches.length, tasksCreated });
}
