"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { createClaim, type ClaimFormState } from "./actions";
import { searchPolicies } from "../policies/actions";

export function ClaimForm({
  defaultPolicyId,
  defaultPolicyLabel,
}: {
  defaultPolicyId?: string;
  defaultPolicyLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ClaimFormState, FormData>(
    createClaim,
    undefined,
  );
  const [policyId, setPolicyId] = useState(defaultPolicyId ?? "");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Συμβόλαιο</Label>
        <Combobox
          name="policy_id"
          value={policyId}
          initialLabel={defaultPolicyLabel}
          placeholder="Αναζήτηση συμβολαίου με αριθμό ή πελάτη..."
          searchAction={searchPolicies}
          onSelect={(option) => setPolicyId(option.id)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="claim_number">Αριθμός ζημιάς</Label>
          <Input id="claim_number" name="claim_number" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="date_of_loss">Ημερομηνία ζημιάς</Label>
          <Input id="date_of_loss" name="date_of_loss" type="date" required max={today} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="date_reported">Ημερομηνία αναφοράς</Label>
          <Input id="date_reported" name="date_reported" type="date" defaultValue={today} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="claim_amount_estimated">Εκτιμώμενο ποσό (€)</Label>
          <Input id="claim_amount_estimated" name="claim_amount_estimated" type="number" step="0.01" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Περιγραφή</Label>
        <Textarea id="description" name="description" rows={4} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || !policyId} className="w-fit">
        {pending ? "Αποθήκευση..." : "Καταχώρηση ζημιάς"}
      </Button>
    </form>
  );
}
