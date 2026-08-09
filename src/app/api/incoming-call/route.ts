import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeGreekPhone } from "@/lib/phone";

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

  if (lastDigits.length === 8) {
    const { data: candidates } = await supabase
      .from("clients")
      .select("id, display_name, phone_mobile, phone_landline")
      .or(`phone_mobile.ilike.%${lastDigits}%,phone_landline.ilike.%${lastDigits}%`)
      .eq("is_active", true)
      .limit(20);

    const match = (candidates ?? []).find((c) => {
      const mobile = c.phone_mobile ? normalizeGreekPhone(c.phone_mobile) : null;
      const landline = c.phone_landline ? normalizeGreekPhone(c.phone_landline) : null;
      return mobile === normalized || landline === normalized;
    });

    if (match) {
      clientId = match.id;
      clientName = match.display_name;
    }
  }

  const { data: call } = await supabase
    .from("incoming_calls")
    .insert({ phone_number: phoneNumber, client_id: clientId, client_name: clientName })
    .select("id")
    .single();

  return Response.json({ id: call?.id, matched: !!clientId, client_name: clientName });
}
