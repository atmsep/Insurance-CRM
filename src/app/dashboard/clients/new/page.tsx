import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("agency_users")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Νέος πελάτης</h1>
      <ClientForm agents={agents ?? []} />
    </div>
  );
}
