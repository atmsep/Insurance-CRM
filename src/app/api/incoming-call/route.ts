import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeGreekPhone } from "@/lib/phone";

// Some numbers in the DB match a couple dozen (or a couple hundred)
// clients — bad-import placeholder values, not real shared phones. Above
// this many matches, a "which one was it?" prompt stops being useful, so
// treat it the same as no match at all instead of showing an unusable list.
const MAX_DISAMBIGUATION_CANDIDATES = 6;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CALLER_ID_SECRET ||
    authHeader !== `Bearer ${process.env.CALLER_ID_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const phoneNumber = typeof body?.phone_number === "string" ? body.phone_number : null;
  if (!phoneNumber) {
    return new Response("Missing phone_number", { status: 400 });
  }

  const supabase = createAdminClient();
  const normalized = normalizeGreekPhone(phoneNumber);
  const lastDigits = normalized.slice(-8);

  let clientId: string | null = null;
  let clientName: string | null = null;
  let candidateClients: { id: string; display_name: string }[] | null = null;

  const { data: override } = await supabase
    .from("phone_owner_overrides")
    .select("client_id")
    .eq("phone_number", normalized)
    .maybeSingle();

  if (override) {
    const { data: overrideClient } = await supabase
      .from("clients")
      .select("display_name")
      .eq("id", override.client_id)
      .single();
    clientId = override.client_id;
    clientName = overrideClient?.display_name ?? null;
  } else if (lastDigits.length === 8) {
    const { data: candidates } = await supabase
      .from("clients")
      .select("id, display_name, phone_mobile, phone_landline")
      .or(`phone_mobile.ilike.%${lastDigits}%,phone_landline.ilike.%${lastDigits}%`)
      .eq("is_active", true)
      .limit(20);

    const matches = (candidates ?? []).filter((c) => {
      const mobile = c.phone_mobile ? normalizeGreekPhone(c.phone_mobile) : null;
      const landline = c.phone_landline ? normalizeGreekPhone(c.phone_landline) : null;
      return mobile === normalized || landline === normalized;
    });

    if (matches.length === 1) {
      clientId = matches[0].id;
      clientName = matches[0].display_name;
    } else if (matches.length > 1 && matches.length <= MAX_DISAMBIGUATION_CANDIDATES) {
      candidateClients = matches.map((m) => ({ id: m.id, display_name: m.display_name }));
    }
  }

  const { data: call } = await supabase
    .from("incoming_calls")
    .insert({
      phone_number: phoneNumber,
      client_id: clientId,
      client_name: clientName,
      needs_disambiguation: !!candidateClients,
      candidate_clients: candidateClients,
    })
    .select("id")
    .single();

  // The live toast only reaches whoever has the app open right now — the
  // client's own agent gets a persistent in-app notification too, so a call
  // taken while they were away doesn't vanish.
  if (clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("assigned_agent_id")
      .eq("id", clientId)
      .maybeSingle();
    if (client?.assigned_agent_id) {
      await supabase.from("notifications").insert({
        recipient_id: client.assigned_agent_id,
        kind: "incoming_call",
        title: `Κλήση από ${clientName ?? phoneNumber}`,
        body: phoneNumber,
        link: `/dashboard/clients/${clientId}?tab=calls`,
      });
    }
  }

  return Response.json({ id: call?.id, matched: !!clientId, client_name: clientName });
}
