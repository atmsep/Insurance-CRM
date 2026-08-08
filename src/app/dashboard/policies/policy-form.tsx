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
import { Combobox } from "@/components/ui/combobox";
import { EntitySelect } from "@/components/entity-select";
import { createPolicy, getClientAssignedAgent, type PolicyFormState } from "./actions";
import { searchClients } from "../clients/actions";
import { PremiumFields } from "./premium-fields";
import type { PaymentFrequency } from "@/lib/database.types";

type InsuranceLine = {
  id: string;
  code: string;
  name_el: string;
  requires_vehicle_details: boolean;
  requires_property_details: boolean;
  requires_life_health_details: boolean;
};

export type RenewFromData = {
  policyId: string;
  policyGroupId: string;
  policyNumber: string;
  startDate: string;
  endDate: string;
  premiumGross: number;
  premiumNet?: number | null;
  taxesFees?: number | null;
  paymentFrequency: PaymentFrequency;
  vehicle?: {
    plate_number?: string | null;
    manufacture_year?: number | null;
    make?: string | null;
    model?: string | null;
  };
  property?: {
    address_street?: string | null;
    address_city?: string | null;
    square_meters?: number | null;
    commercial_value?: number | null;
  };
  lifeHealth?: { coverage_type?: string | null; sum_insured?: number | null };
};

const PAYMENT_FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: "annual", label: "Ετήσια" },
  { value: "semiannual", label: "Εξαμηνιαία" },
  { value: "quarterly", label: "Τριμηνιαία" },
  { value: "monthly", label: "Μηνιαία" },
  { value: "single_premium", label: "Εφάπαξ" },
];

export function PolicyForm({
  carriers,
  insuranceLines,
  agents,
  brokerOffices,
  defaultClientId,
  defaultClientLabel,
  defaultCarrierId,
  defaultLineId,
  defaultAgentId,
  defaultBrokerOfficeId,
  renewFrom,
}: {
  carriers: { id: string; name: string }[];
  insuranceLines: InsuranceLine[];
  agents: { id: string; full_name: string }[];
  brokerOffices: { id: string; name: string }[];
  defaultClientId?: string;
  defaultClientLabel?: string;
  defaultCarrierId?: string;
  defaultLineId?: string;
  defaultAgentId?: string;
  defaultBrokerOfficeId?: string;
  renewFrom?: RenewFromData;
}) {
  const [state, formAction, pending] = useActionState<PolicyFormState, FormData>(
    createPolicy,
    undefined,
  );
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [carrierId, setCarrierId] = useState(defaultCarrierId ?? "");
  const [lineId, setLineId] = useState(defaultLineId ?? "");
  const [agentId, setAgentId] = useState(defaultAgentId ?? "");
  const [frequency, setFrequency] = useState<PaymentFrequency>(
    renewFrom?.paymentFrequency ?? "annual",
  );

  const selectedLine = useMemo(
    () => insuranceLines.find((l) => l.id === lineId),
    [insuranceLines, lineId],
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {renewFrom && (
        <>
          <input type="hidden" name="renew_from_policy_id" value={renewFrom.policyId} />
          <input type="hidden" name="policy_group_id" value={renewFrom.policyGroupId} />
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Πελάτης</Label>
          <Combobox
            name="client_id"
            value={clientId}
            initialLabel={defaultClientLabel}
            placeholder="Αναζήτηση πελάτη με όνομα, ΑΦΜ ή τηλέφωνο..."
            searchAction={searchClients}
            onSelect={(option) => {
              setClientId(option.id);
              getClientAssignedAgent(option.id).then((agentId) => setAgentId(agentId ?? ""));
            }}
          />
        </div>

        <EntitySelect
          label="Συνεργάτης"
          name="assigned_agent_id"
          options={agents.map((a) => ({ id: a.id, label: a.full_name }))}
          placeholder="Επίλεξε συνεργάτη"
          value={agentId}
          onValueChange={setAgentId}
        />

        <EntitySelect
          label="Συνεργαζόμενο γραφείο"
          name="broker_office_id"
          options={brokerOffices.map((b) => ({ id: b.id, label: b.name }))}
          defaultValue={defaultBrokerOfficeId}
          placeholder="— (προαιρετικό)"
        />

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

        <Field
          label="Αριθμός συμβολαίου"
          name="policy_number"
          required
          defaultValue={renewFrom?.policyNumber}
        />
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
        <Field label="Έναρξη" name="start_date" type="date" required defaultValue={renewFrom?.startDate} />
        <Field label="Λήξη" name="end_date" type="date" required defaultValue={renewFrom?.endDate} />
        <PremiumFields defaultGross={renewFrom?.premiumGross} defaultNet={renewFrom?.premiumNet} required />
      </div>

      {selectedLine?.requires_vehicle_details && (
        <fieldset className="flex flex-col gap-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Στοιχεία οχήματος</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Πινακίδα" name="plate_number" defaultValue={renewFrom?.vehicle?.plate_number} />
            <Field
              label="Έτος κατασκευής"
              name="manufacture_year"
              type="number"
              defaultValue={renewFrom?.vehicle?.manufacture_year}
            />
            <Field label="Μάρκα" name="make" defaultValue={renewFrom?.vehicle?.make} />
            <Field label="Μοντέλο" name="model" defaultValue={renewFrom?.vehicle?.model} />
          </div>
        </fieldset>
      )}

      {selectedLine?.requires_property_details && (
        <fieldset className="flex flex-col gap-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Στοιχεία ακινήτου</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Οδός" name="address_street" defaultValue={renewFrom?.property?.address_street} />
            <Field label="Πόλη" name="address_city" defaultValue={renewFrom?.property?.address_city} />
            <Field
              label="Τετραγωνικά μέτρα"
              name="square_meters"
              type="number"
              defaultValue={renewFrom?.property?.square_meters}
            />
            <Field
              label="Εμπορική αξία (€)"
              name="commercial_value"
              type="number"
              defaultValue={renewFrom?.property?.commercial_value}
            />
          </div>
        </fieldset>
      )}

      {selectedLine?.requires_life_health_details && (
        <fieldset className="flex flex-col gap-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Στοιχεία κάλυψης</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Είδος κάλυψης"
              name="coverage_type"
              defaultValue={renewFrom?.lifeHealth?.coverage_type}
            />
            <Field
              label="Ασφαλισμένο κεφάλαιο (€)"
              name="sum_insured"
              type="number"
              defaultValue={renewFrom?.lifeHealth?.sum_insured}
            />
          </div>
        </fieldset>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Αποθήκευση..." : renewFrom ? "Δημιουργία ανανέωσης" : "Δημιουργία συμβολαίου"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        required={required}
        defaultValue={defaultValue ?? undefined}
      />
    </div>
  );
}
