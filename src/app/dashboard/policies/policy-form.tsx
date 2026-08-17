"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useFormValues } from "@/hooks/use-form-values";
import { VEHICLE_USAGE_LABELS, PROPERTY_TYPE_LABELS } from "./policy-labels";
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
    manufacture_month?: number | null;
    make?: string | null;
    model?: string | null;
    manufacturer?: string | null;
    color?: string | null;
    body_type?: string | null;
    vin_chassis_number?: string | null;
    engine_number?: string | null;
    engine_cc?: number | null;
    horsepower?: number | null;
    seats?: number | null;
    gross_weight_kg?: number | null;
    tonnage?: number | null;
    has_trailer?: boolean | null;
    usage_type?: string | null;
    driver_gender?: string | null;
    capacity_role?: string | null;
    zone_code?: string | null;
    insurance_package?: string | null;
    protection_measures?: string | null;
    kteo_expiry_date?: string | null;
    insured_value?: number | null;
    discount_percent?: number | null;
    special_discount_percent?: number | null;
    surcharge_percent?: number | null;
    required_license_type?: string | null;
    is_financed?: boolean | null;
    title_retained?: boolean | null;
    financing_bank?: string | null;
    bonus_malus_class?: string | null;
    prior_claims_count?: number | null;
  };
  property?: {
    property_type?: string | null;
    address_street?: string | null;
    address_city?: string | null;
    address_postal_code?: string | null;
    kaek_number?: string | null;
    construction_year?: number | null;
    square_meters?: number | null;
    commercial_value?: number | null;
    has_alarm?: boolean | null;
    occupancy_status?: string | null;
    zone_code?: string | null;
    building_value?: number | null;
    contents_value?: number | null;
    category?: string | null;
    covered_square_meters?: number | null;
    floor?: string | null;
    construction_type?: string | null;
    capacity_role?: string | null;
    security_measures?: string | null;
    earthquake_coverage?: boolean | null;
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

// Λήξη defaults off Έναρξη + the term the chosen Συχνότητα implies
// (μηνιαία → +1 month, τριμηνιαία → +3, εξαμηνιαία → +6, ετήσια/εφάπαξ →
// +1 year) instead of always assuming a full year — same rule for a brand
// new policy and a renewal, since both go through this one form. UTC
// arithmetic so the result never shifts a day from the browser's zone.
function computeEndDate(startDate: string, frequency: PaymentFrequency): string {
  if (!startDate) return "";
  const d = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  switch (frequency) {
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "semiannual":
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
    default:
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

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
  const [endDateTouched, setEndDateTouched] = useState(false);
  const renewVehicle = renewFrom?.vehicle;
  const renewProperty = renewFrom?.property;
  const { field, checkboxField, values, setValue } = useFormValues({
    policy_number: renewFrom?.policyNumber ?? "",
    start_date: renewFrom?.startDate ?? "",
    end_date:
      computeEndDate(renewFrom?.startDate ?? "", frequency) || (renewFrom?.endDate ?? ""),
    plate_number: renewVehicle?.plate_number ?? "",
    manufacture_year: renewVehicle?.manufacture_year != null ? String(renewVehicle.manufacture_year) : "",
    manufacture_month: renewVehicle?.manufacture_month != null ? String(renewVehicle.manufacture_month) : "",
    make: renewVehicle?.make ?? "",
    model: renewVehicle?.model ?? "",
    manufacturer: renewVehicle?.manufacturer ?? "",
    color: renewVehicle?.color ?? "",
    body_type: renewVehicle?.body_type ?? "",
    vin_chassis_number: renewVehicle?.vin_chassis_number ?? "",
    engine_number: renewVehicle?.engine_number ?? "",
    engine_cc: renewVehicle?.engine_cc != null ? String(renewVehicle.engine_cc) : "",
    horsepower: renewVehicle?.horsepower != null ? String(renewVehicle.horsepower) : "",
    seats: renewVehicle?.seats != null ? String(renewVehicle.seats) : "",
    gross_weight_kg: renewVehicle?.gross_weight_kg != null ? String(renewVehicle.gross_weight_kg) : "",
    tonnage: renewVehicle?.tonnage != null ? String(renewVehicle.tonnage) : "",
    has_trailer: renewVehicle?.has_trailer ? "true" : "",
    driver_gender: renewVehicle?.driver_gender ?? "",
    capacity_role: renewVehicle?.capacity_role ?? renewProperty?.capacity_role ?? "",
    zone_code: renewVehicle?.zone_code ?? renewProperty?.zone_code ?? "",
    insurance_package: renewVehicle?.insurance_package ?? "",
    protection_measures: renewVehicle?.protection_measures ?? "",
    kteo_expiry_date: renewVehicle?.kteo_expiry_date ?? "",
    insured_value: renewVehicle?.insured_value != null ? String(renewVehicle.insured_value) : "",
    discount_percent: renewVehicle?.discount_percent != null ? String(renewVehicle.discount_percent) : "",
    special_discount_percent:
      renewVehicle?.special_discount_percent != null ? String(renewVehicle.special_discount_percent) : "",
    surcharge_percent: renewVehicle?.surcharge_percent != null ? String(renewVehicle.surcharge_percent) : "",
    required_license_type: renewVehicle?.required_license_type ?? "",
    is_financed: renewVehicle?.is_financed ? "true" : "",
    title_retained: renewVehicle?.title_retained ? "true" : "",
    financing_bank: renewVehicle?.financing_bank ?? "",
    bonus_malus_class: renewVehicle?.bonus_malus_class ?? "",
    prior_claims_count: renewVehicle?.prior_claims_count != null ? String(renewVehicle.prior_claims_count) : "",
    address_street: renewProperty?.address_street ?? "",
    address_city: renewProperty?.address_city ?? "",
    address_postal_code: renewProperty?.address_postal_code ?? "",
    kaek_number: renewProperty?.kaek_number ?? "",
    construction_year: renewProperty?.construction_year != null ? String(renewProperty.construction_year) : "",
    construction_type: renewProperty?.construction_type ?? "",
    floor: renewProperty?.floor ?? "",
    square_meters: renewProperty?.square_meters != null ? String(renewProperty.square_meters) : "",
    covered_square_meters:
      renewProperty?.covered_square_meters != null ? String(renewProperty.covered_square_meters) : "",
    occupancy_status: renewProperty?.occupancy_status ?? "",
    category: renewProperty?.category ?? "",
    commercial_value: renewProperty?.commercial_value != null ? String(renewProperty.commercial_value) : "",
    building_value: renewProperty?.building_value != null ? String(renewProperty.building_value) : "",
    contents_value: renewProperty?.contents_value != null ? String(renewProperty.contents_value) : "",
    security_measures: renewProperty?.security_measures ?? "",
    has_alarm: renewProperty?.has_alarm ? "true" : "",
    earthquake_coverage: renewProperty?.earthquake_coverage ? "true" : "",
    coverage_type: renewFrom?.lifeHealth?.coverage_type ?? "",
    sum_insured: renewFrom?.lifeHealth?.sum_insured != null ? String(renewFrom.lifeHealth.sum_insured) : "",
  });
  const [usageType, setUsageType] = useState<string>(renewVehicle?.usage_type ?? "");
  const [propertyType, setPropertyType] = useState<string>(renewProperty?.property_type ?? "");

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  useEffect(() => {
    if (endDateTouched) return;
    const computed = computeEndDate(values.start_date, frequency);
    if (computed) setValue("end_date", computed);
  }, [values.start_date, frequency, endDateTouched, setValue]);

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
          field={field}
          invalid={state?.field === "policy_number"}
          errorMessage={state?.field === "policy_number" ? state.error : undefined}
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
        <Field label="Έναρξη" name="start_date" type="date" required field={field} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="end_date">Λήξη</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            required
            value={values.end_date ?? ""}
            onChange={(e) => {
              setEndDateTouched(true);
              setValue("end_date", e.target.value);
            }}
          />
        </div>
        <PremiumFields defaultGross={renewFrom?.premiumGross} defaultNet={renewFrom?.premiumNet} required />
      </div>

      {selectedLine?.requires_vehicle_details && (
        <>
          <fieldset className="flex flex-col gap-4 rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">Στοιχεία οχήματος</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Πινακίδα" name="plate_number" field={field} />
              <Field label="Μάρκα" name="make" field={field} />
              <Field label="Μοντέλο" name="model" field={field} />
              <Field label="Εργοστάσιο κατασκευής" name="manufacturer" field={field} />
              <Field label="Έτος κατασκευής" name="manufacture_year" type="number" field={field} />
              <Field label="Μήνας κατασκευής" name="manufacture_month" type="number" field={field} />
              <Field label="Χρώμα" name="color" field={field} />
              <Field label="Τύπος αμαξώματος" name="body_type" field={field} />
              <Field label="Αρ. πλαισίου (VIN)" name="vin_chassis_number" field={field} />
              <Field label="Αρ. κινητήρα" name="engine_number" field={field} />
              <Field label="Κυβικά" name="engine_cc" type="number" field={field} />
              <Field label="Ίπποι" name="horsepower" type="number" field={field} />
              <Field label="Θέσεις" name="seats" type="number" field={field} />
              <Field label="Μικτό βάρος (κιλά)" name="gross_weight_kg" type="number" field={field} />
              <Field label="Τόνοι" name="tonnage" type="number" field={field} />
              <Field label="Κλάση bonus-malus" name="bonus_malus_class" field={field} />
              <Field label="Πλήθος προηγούμενων ζημιών" name="prior_claims_count" type="number" field={field} />
              <div className="flex items-center gap-2 pt-6">
                <Checkbox id="has_trailer" name="has_trailer" {...checkboxField("has_trailer")} />
                <Label htmlFor="has_trailer">Ρυμούλκα</Label>
              </div>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">Χρήση &amp; ασφάλιση</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="usage_type_trigger">Χρήση</Label>
                <Select value={usageType} onValueChange={(val) => setUsageType(val ?? "")}>
                  <SelectTrigger id="usage_type_trigger" className="w-full">
                    <SelectValue>{(val: string) => VEHICLE_USAGE_LABELS[val] ?? "— (προαιρετικό)"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VEHICLE_USAGE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="usage_type" value={usageType} />
              </div>
              <Field label="Φύλο οδηγού" name="driver_gender" field={field} />
              <Field label="Ιδιότητα ασφαλισμένου" name="capacity_role" field={field} />
              <Field label="Ζώνη" name="zone_code" field={field} />
              <Field label="Πακέτο ασφάλισης" name="insurance_package" field={field} />
              <Field label="Μέτρα προστασίας" name="protection_measures" field={field} />
              <Field label="Λήξη ΚΤΕΟ" name="kteo_expiry_date" type="date" field={field} />
              <Field label="Ασφαλισμένη αξία (€)" name="insured_value" type="number" field={field} />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">Χρηματοδότηση &amp; εκπτώσεις</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Έκπτωση (%)" name="discount_percent" type="number" field={field} />
              <Field label="Ειδική έκπτωση (%)" name="special_discount_percent" type="number" field={field} />
              <Field label="Επιβαρύνσεις (%)" name="surcharge_percent" type="number" field={field} />
              <Field label="Είδος διπλώματος" name="required_license_type" field={field} />
              <div className="flex items-center gap-2">
                <Checkbox id="is_financed" name="is_financed" {...checkboxField("is_financed")} />
                <Label htmlFor="is_financed">Χρηματοδότηση</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="title_retained" name="title_retained" {...checkboxField("title_retained")} />
                <Label htmlFor="title_retained">Παρακράτηση κυριότητας</Label>
              </div>
              <Field label="Τράπεζα χρηματοδότησης" name="financing_bank" field={field} />
            </div>
          </fieldset>
        </>
      )}

      {selectedLine?.requires_property_details && (
        <>
          <fieldset className="flex flex-col gap-4 rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">Στοιχεία ακινήτου</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="property_type_trigger">Τύπος ακινήτου</Label>
                <Select value={propertyType} onValueChange={(val) => setPropertyType(val ?? "")}>
                  <SelectTrigger id="property_type_trigger" className="w-full">
                    <SelectValue>{(val: string) => PROPERTY_TYPE_LABELS[val] ?? "— (προαιρετικό)"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROPERTY_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="property_type" value={propertyType} />
              </div>
              <Field label="Οδός" name="address_street" field={field} />
              <Field label="Πόλη" name="address_city" field={field} />
              <Field label="ΤΚ" name="address_postal_code" field={field} />
              <Field label="ΚΑΕΚ" name="kaek_number" field={field} />
              <Field label="Έτος κατασκευής" name="construction_year" type="number" field={field} />
              <Field label="Τύπος κατασκευής" name="construction_type" field={field} />
              <Field label="Όροφος" name="floor" field={field} />
              <Field label="Τετραγωνικά μέτρα" name="square_meters" type="number" field={field} />
              <Field label="Καλυμμένα τ.μ." name="covered_square_meters" type="number" field={field} />
              <Field label="Ιδιότητα ασφαλισμένου" name="capacity_role" field={field} />
              <Field label="Κατάσταση κατοίκησης" name="occupancy_status" field={field} />
              <Field label="Κατηγορία" name="category" field={field} />
              <Field label="Ζώνη" name="zone_code" field={field} />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">Αξίες &amp; κάλυψη</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Εμπορική αξία (€)" name="commercial_value" type="number" field={field} />
              <Field label="Αξία κτιρίου (€)" name="building_value" type="number" field={field} />
              <Field label="Αξία περιεχομένου (€)" name="contents_value" type="number" field={field} />
              <Field label="Μέτρα ασφαλείας" name="security_measures" field={field} />
              <div className="flex items-center gap-2">
                <Checkbox id="has_alarm" name="has_alarm" {...checkboxField("has_alarm")} />
                <Label htmlFor="has_alarm">Συναγερμός</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="earthquake_coverage" name="earthquake_coverage" {...checkboxField("earthquake_coverage")} />
                <Label htmlFor="earthquake_coverage">Κάλυψη σεισμού</Label>
              </div>
            </div>
          </fieldset>
        </>
      )}

      {selectedLine?.requires_life_health_details && (
        <fieldset className="flex flex-col gap-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Στοιχεία κάλυψης</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Είδος κάλυψης" name="coverage_type" field={field} />
            <Field label="Ασφαλισμένο κεφάλαιο (€)" name="sum_insured" type="number" field={field} />
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
  field,
  invalid,
  errorMessage,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  field: (name: string) => { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void };
  invalid?: boolean;
  errorMessage?: string;
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
        aria-invalid={invalid || undefined}
        {...field(name)}
      />
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}
