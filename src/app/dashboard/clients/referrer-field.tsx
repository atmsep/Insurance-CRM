"use client";

import { useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchClients } from "./actions";

export function ReferrerField({
  excludeId,
  defaultReferrerId,
  defaultReferrerLabel,
  defaultRelationship,
}: {
  excludeId?: string;
  defaultReferrerId?: string;
  defaultReferrerLabel?: string;
  defaultRelationship?: string;
}) {
  const [referrerId, setReferrerId] = useState(defaultReferrerId ?? "");

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>Συστήνων</Label>
        <Combobox
          name="referred_by_client_id"
          value={referrerId}
          initialLabel={defaultReferrerLabel}
          placeholder="Πληκτρολόγησε τουλάχιστον 3 γράμματα..."
          minLength={3}
          searchAction={(query) => searchClients(query, excludeId)}
          onSelect={(option) => setReferrerId(option.id)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="referrer_relationship">Είδος συγγένειας</Label>
        <Input
          id="referrer_relationship"
          name="referrer_relationship"
          placeholder="π.χ. φίλος, συγγενής, συνάδελφος..."
          defaultValue={defaultRelationship ?? ""}
        />
      </div>
    </>
  );
}
