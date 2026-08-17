"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClientRecord, type ClientFormState } from "./actions";
import { ReferrerField } from "./referrer-field";
import { EntitySelect } from "@/components/entity-select";
import { useFormValues } from "@/hooks/use-form-values";

export function ClientForm({ agents }: { agents: { id: string; full_name: string }[] }) {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    createClientRecord,
    undefined,
  );
  const [clientType, setClientType] = useState<"individual" | "legal_entity">("individual");
  const { field } = useFormValues();

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Τύπος πελάτη</Label>
        <Select
          value={clientType}
          onValueChange={(v) => setClientType(v as "individual" | "legal_entity")}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue>
              {(value: string) => (value === "individual" ? "Φυσικό πρόσωπο" : "Νομικό πρόσωπο")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Φυσικό πρόσωπο</SelectItem>
            <SelectItem value="legal_entity">Νομικό πρόσωπο</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="client_type" value={clientType} />
      </div>

      {clientType === "individual" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Επώνυμο" name="last_name" required field={field} />
          <Field label="Όνομα" name="first_name" required field={field} />
          <Field label="Πατρώνυμο" name="father_name" field={field} />
          <Field label="Ημερομηνία γέννησης" name="date_of_birth" type="date" field={field} />
          <Field label="Επάγγελμα" name="occupation" field={field} />
          <Field
            label="ΑΜΚΑ"
            name="amka"
            field={field}
            invalid={state?.field === "amka"}
            errorMessage={state?.field === "amka" ? state.error : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Επωνυμία" name="company_name" required className="sm:col-span-2" field={field} />
          <Field label="ΚΑΔ" name="kad" field={field} />
          <Field label="Νόμιμος εκπρόσωπος" name="legal_representative_name" field={field} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="ΑΦΜ"
          name="afm"
          field={field}
          invalid={state?.field === "afm"}
          errorMessage={state?.field === "afm" ? state.error : undefined}
        />
        <Field label="ΔΟΥ" name="doy" field={field} />
        <Field
          label="Email"
          name="email"
          type="email"
          field={field}
          invalid={state?.field === "email"}
          errorMessage={state?.field === "email" ? state.error : undefined}
        />
        <Field label="Κινητό τηλέφωνο" name="phone_mobile" field={field} />
        <Field label="Σταθερό τηλέφωνο" name="phone_landline" field={field} />
        <Field label="Πόλη" name="address_city" field={field} />
        <Field label="Νομός" name="address_region" field={field} />
        <Field label="ΤΚ" name="address_postal_code" field={field} />
        <Field label="IBAN" name="iban" field={field} />
        <Field label="Πηγή σύστασης" name="referral_source" field={field} />
        <ReferrerField />
        <EntitySelect
          label="Συνεργάτης"
          name="assigned_agent_id"
          options={agents.map((a) => ({ id: a.id, label: a.full_name }))}
          placeholder="Επίλεξε συνεργάτη"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Σημειώσεις</Label>
        <Textarea id="notes" name="notes" rows={3} {...field("notes")} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Αποθήκευση..." : "Δημιουργία πελάτη"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  className,
  field,
  invalid,
  errorMessage,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
  field: (name: string) => { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void };
  invalid?: boolean;
  errorMessage?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        aria-invalid={invalid || undefined}
        {...field(name)}
      />
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}
