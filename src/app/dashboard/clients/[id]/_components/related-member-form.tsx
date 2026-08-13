"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { searchClients } from "../../actions";

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: "Σύζυγος/η",
  child: "Τέκνο",
  parent: "Γονέας",
  sibling: "Αδελφός/ή",
  other: "Λοιπό",
};

export function RelatedMemberForm({
  clientId,
  addAction,
}: {
  clientId: string;
  addAction: (formData: FormData) => Promise<{ error: string } | undefined>;
}) {
  const [relatedId, setRelatedId] = useState("");

  return (
    <form
      action={async (formData) => {
        const result = await addAction(formData);
        if (result?.error) {
          toast.error(result.error);
        } else {
          setRelatedId("");
        }
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-2">
        <Label>Πελάτης</Label>
        <Combobox
          name="related_client_id"
          value={relatedId}
          placeholder="Πληκτρολόγησε τουλάχιστον 3 γράμματα..."
          minLength={3}
          searchAction={(query) => searchClients(query, clientId)}
          onSelect={(option) => setRelatedId(option.id)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="relationship_type">Σχέση</Label>
        <select
          id="relationship_type"
          name="relationship_type"
          defaultValue="spouse"
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
        >
          {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" disabled={!relatedId}>
        Σύνδεση
      </Button>
    </form>
  );
}

export { RELATIONSHIP_LABELS };
