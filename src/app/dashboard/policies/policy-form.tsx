"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPolicy, type PolicyFormState } from "./actions";
import type { PaymentFrequency } from "@/lib/database.types";

type InsuranceLine = {
  id: string;
  code: string;
  name_el: string;
  requires_vehicle_details: boolean;
  requires_property_details: boolean;
  requires_life_health_details: boolean;
};

const PAYMENT_FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: "annual", label: "Ετήσια" },
  { value: "semiannual", label: "Εξαμηνιαία" },
  { value: "quarterly", label: "Τριμηνιαία" },
  { value: "monthly", label: "Μηνιαία" },
  { value: "single_premium", label: "Εφάπαξ" },
];

export function PolicyForm({
  clients,
  carriers,
  insuranceLines,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  carriers: { id: string; name: string }[];
  insuranceLines: InsuranceLine[];
  defaultClientId?: string;
}) {
  const [state, formAction, pending] = useActionState<PolicyFormState, FormData>(
    createPolicy,
    undefined,
  );
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [carrierId, setCarrierId] = useState("");
  const [lineId, setLineId] = useState("");
  const [frequency, setFrequency] = useState<PaymentFrequency>("annual");

  const selectedLine = useMemo(
    () => insuranceLines.find((l) => l.id === lineId),
    [insuranceLines, lineId],
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Πελάτης</Label>
          <Select value={clientId} onValueChange={(v) => setClientId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string) => clients.find((c) => c.id === value)?.name ?? "Επίλεξε πελάτη"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="client_id" value={clientId} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Ασφαλιστική εταιρεία</Label>
          <Select value={carrierId} onValueChange={(v) => setCarrierId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string) => carriers.find((c) => c.id === value)?.name ?? "Επίλεξε εταιρεία"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {carriers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="carrier_id" value={carrierId} />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Κλάδος ασφάλισης</Label>
          <Select value={lineId} onValueChange={(v) => setLineId(v ?? "")}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue>
                {(value: string) =>
                  insuranceLines.find((l) => l.id === value)?.name_el ?? "Επίλεξε κλάδο"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {insuranceLines.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name_el}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="insurance_line_id" value={lineId} />
        </div>

        <Field label="Αριθμός συμβολαίου" name="policy_number" required />
        <div className="flex flex-col gap-2">
          <Label>Συχνότητα πληρωμής</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as PaymentFrequency)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: PaymentFrequency) =>
                  PAYMENT_FREQUENCIES.find((f) => f.value === value)?.label ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="payment_frequency" value={frequency} />
        </div>
        <Field label="Έναρξη" name="start_date" type="date" required />
        <Field label="Λήξη" name="end_date" type="date" required />
        <Field label="Μικτό ασφάλιστρο (€)" name="premium_gross" type="number" required />
      </div>

      {selectedLine?.requires_vehicle_details && (
        <fieldset className="flex flex-col gap-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Στοιχεία οχήματος</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Πινακίδα" name="plate_number" />
            <Field label="Έτος κατασκευής" name="manufacture_year" type="number" />
            <Field label="Μάρκα" name="make" />
            <Field label="Μοντέλο" name="model" />
          </div>
        </fieldset>
      )}

      {selectedLine?.requires_property_details && (
        <fieldset className="flex flex-col gap-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Στοιχεία ακινήτου</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Οδός" name="address_street" />
            <Field label="Πόλη" name="address_city" />
            <Field label="Τετραγωνικά μέτρα" name="square_meters" type="number" />
            <Field label="Εμπορική αξία (€)" name="commercial_value" type="number" />
          </div>
        </fieldset>
      )}

      {selectedLine?.requires_life_health_details && (
        <fieldset className="flex flex-col gap-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Στοιχεία κάλυψης</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Είδος κάλυψης" name="coverage_type" />
            <Field label="Ασφαλισμένο κεφάλαιο (€)" name="sum_insured" type="number" />
          </div>
        </fieldset>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Αποθήκευση..." : "Δημιουργία συμβολαίου"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={type === "number" ? "0.01" : undefined} required={required} />
    </div>
  );
}
