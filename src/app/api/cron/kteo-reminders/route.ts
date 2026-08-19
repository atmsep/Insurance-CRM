import { createAdminClient } from "@/lib/supabase/admin";

// How far before the ΚΤΕΟ expiry the reminder task appears. Constant for
// now (like the celebration cron's same-day rule) — can become an
// app_settings value if the office ever wants it adjustable.
const DAYS_AHEAD = 14;

type VehicleRow = {
  policy_id: string;
  kteo_expiry_date: string;
  plate_number: string | null;
  policies:
    | {
        policy_number: string;
        status: string;
        assigned_agent_id: string | null;
        clients: { display_name: string | null } | { display_name: string | null }[] | null;
      }
    | {
        policy_number: string;
        status: string;
        assigned_agent_id: string | null;
        clients: { display_name: string | null } | { display_name: string | null }[] | null;
      }[]
    | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Creates one internal υπενθύμιση per vehicle whose ΚΤΕΟ expires within
// the next DAYS_AHEAD days. Idempotent without a log table: the task's
// due_date is the expiry date itself, so (policy_id, task_type, due_date)
// identifies the reminder — an existing row (open OR completed) means this
// expiry was already surfaced and the cron skips it. Like the celebrations
// cron, this only ever creates the internal task, never contacts a client.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: setting } = await supabase
    .from("app_settings")
    .select("enabled")
    .eq("key", "kteo_reminder_tasks")
    .maybeSingle();
  if (setting && !setting.enabled) {
    return Response.json({ skipped: "kteo_reminder_tasks is disabled in Settings" });
  }

  const athensToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
  const horizon = new Date(`${athensToday}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + DAYS_AHEAD);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const { data: vehicles, error } = await supabase
    .from("policy_vehicle_details")
    .select(
      "policy_id, kteo_expiry_date, plate_number, " +
        "policies!inner(policy_number, status, assigned_agent_id, clients(display_name))",
    )
    .gte("kteo_expiry_date", athensToday)
    .lte("kteo_expiry_date", horizonDate)
    .in("policies.status", ["active", "pending_renewal"]);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (vehicles ?? []) as unknown as VehicleRow[];
  if (rows.length === 0) return Response.json({ matched: 0 });

  const { data: fallbackAgent } = await supabase
    .from("agency_users")
    .select("id")
    .in("role", ["owner", "admin"])
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let tasksCreated = 0;
  for (const v of rows) {
    const policy = one(v.policies);
    if (!policy) continue;

    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("task_type", "kteo_reminder")
      .eq("policy_id", v.policy_id)
      .eq("due_date", v.kteo_expiry_date)
      .limit(1)
      .maybeSingle();
    if (existing) continue;

    const assignee = policy.assigned_agent_id ?? fallbackAgent?.id ?? null;
    if (!assignee) continue;

    const clientName = one(policy.clients)?.display_name ?? "";
    const plate = v.plate_number ? ` (${v.plate_number})` : "";
    const { error: insertError } = await supabase.from("tasks").insert({
      title: `Λήγει το ΚΤΕΟ${plate} — ${clientName || policy.policy_number}`,
      task_type: "kteo_reminder",
      assigned_to: assignee,
      policy_id: v.policy_id,
      due_date: v.kteo_expiry_date,
      priority: "medium",
    });
    if (!insertError) tasksCreated++;
  }

  return Response.json({ matched: rows.length, tasksCreated });
}
