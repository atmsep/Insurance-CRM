"use client";

import { useActionState, useState } from "react";
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
import { AgentSelect } from "./agent-select";

export function ClientForm({ agents }: { agents: { id: string; full_name: string }[] }) {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    createClientRecord,
    undefined,
  );
  const [clientType, setClientType] = useState<"individual" | "legal_entity">("individual");

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
          <Field label="Όνομα" name="first_name" required />
          <Field label="Επώνυμο" name="last_name" required />
          <Field label="Πατρώνυμο" name="father_name" />
          <Field label="Ημερομηνία γέννησης" name="date_of_birth" type="date" />
          <Field label="Επάγγελμα" name="occupation" />
          <Field label="ΑΜΚΑ" name="amka" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Επωνυμία" name="company_name" required className="sm:col-span-2" />
          <Field label="ΚΑΔ" name="kad" />
          <Field label="Νόμιμος εκπρόσωπος" name="legal_representative_name" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="ΑΦΜ" name="afm" />
        <Field label="ΔΟΥ" name="doy" />
        <Field label="Email" name="email" type="email" />
        <Field label="Κινητό τηλέφωνο" name="phone_mobile" />
        <Field label="Σταθερό τηλέφωνο" name="phone_landline" />
        <Field label="Πόλη" name="address_city" />
        <Field label="IBAN" name="iban" />
        <Field label="Πηγή σύστασης" name="referral_source" />
        <ReferrerField />
        <AgentSelect agents={agents} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Σημειώσεις</Label>
        <Textarea id="notes" name="notes" rows={3} />
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}
