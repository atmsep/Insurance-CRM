import { createClient } from "@/lib/supabase/server";
import type { EntityType } from "./actions";

export type DocumentWithUrl = {
  id: string;
  file_name: string;
  document_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  storage_path: string;
  url: string | null;
};

export async function getDocumentsFor(
  entityType: EntityType,
  entityId: string,
): Promise<DocumentWithUrl[]> {
  const supabase = await createClient();
  const column =
    entityType === "client" ? "client_id" : entityType === "policy" ? "policy_id" : "claim_id";

  const { data } = await supabase
    .from("documents")
    .select("id, file_name, document_type, file_size_bytes, uploaded_at, storage_path")
    .eq(column, entityId)
    .order("uploaded_at", { ascending: false });

  if (!data?.length) return [];

  return Promise.all(
    data.map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: signed?.signedUrl ?? null };
    }),
  );
}
