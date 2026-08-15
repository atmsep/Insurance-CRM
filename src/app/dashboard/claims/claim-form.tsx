"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { createClaim, type ClaimFormState } from "./actions";
import { searchPolicies } from "../policies/actions";
import { useFormValues } from "@/hooks/use-form-values";
import { ClaimCategorySelect } from "./claim-category-select";

export function ClaimForm({
  defaultPolicyId,
  defaultPolicyLabel,
  claimCategories,
}: {
  defaultPolicyId?: string;
  defaultPolicyLabel?: string;
  claimCategories: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ClaimFormState, FormData>(
    createClaim,
    undefined,
  );
  const [policyId, setPolicyId] = useState(defaultPolicyId ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const { field } = useFormValues({ date_reported: today });

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

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
          <Input id="claim_number" name="claim_number" {...field("claim_number")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="file_number">Αρ. φακέλου</Label>
          <Input id="file_number" name="file_number" {...field("file_number")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="date_of_loss">Ημερομηνία ζημιάς</Label>
          <Input id="date_of_loss" name="date_of_loss" type="date" required max={today} {...field("date_of_loss")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="date_reported">Ημερομηνία αναφοράς</Label>
          <Input id="date_reported" name="date_reported" type="date" {...field("date_reported")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="injured_party_name">Παθών</Label>
          <Input id="injured_party_name" name="injured_party_name" {...field("injured_party_name")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Κατηγορία ζημιάς</Label>
          <ClaimCategorySelect categories={claimCategories} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="claim_amount_estimated">Εκτιμώμενο ποσό (€)</Label>
          <Input
            id="claim_amount_estimated"
            name="claim_amount_estimated"
            type="number"
            step="0.01"
            {...field("claim_amount_estimated")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Περιγραφή</Label>
        <Textarea id="description" name="description" rows={4} {...field("description")} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || !policyId} className="w-fit">
        {pending ? "Αποθήκευση..." : "Καταχώρηση ζημιάς"}
      </Button>
    </form>
  );
}
