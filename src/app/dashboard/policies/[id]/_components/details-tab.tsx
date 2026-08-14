"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntitySelect } from "@/components/entity-select";
import { PremiumFields } from "../../premium-fields";
import { PaymentFrequencySelect, PAYMENT_FREQUENCY_LABELS } from "../../payment-frequency-select";
import { useFormValues } from "@/hooks/use-form-values";
import { formatDate } from "@/lib/date";
import type { PaymentFrequency, VehicleUsage } from "@/lib/database.types";

const VEHICLE_USAGE_LABELS: Record<string, string> = {
  private: "Ιδιωτική χρήση",
  commercial: "Επαγγελματική χρήση",
  taxi: "Ταξί",
  rental: "Ενοικίαση",
  motorcycle: "Μοτοσυκλέτα",
  other: "Άλλο",
};

type Vehicle = {
  plate_number: string | null;
  manufacture_year: number | null;
  manufacture_month: number | null;
  make: string | null;
  model: string | null;
  vin_chassis_number: string | null;
  engine_cc: number | null;
  engine_number: string | null;
  usage_type: VehicleUsage | null;
  kteo_expiry_date: string | null;
  insured_value: number | null;
  zone_code: string | null;
  insurance_package: string | null;
  driver_gender: string | null;
  horsepower: number | null;
  body_type: string | null;
  gross_weight_kg: number | null;
  capacity_role: string | null;
  protection_measures: string | null;
  has_trailer: boolean;
  discount_percent: number | null;
  special_discount_percent: number | null;
  surcharge_percent: number | null;
  is_financed: boolean;
  title_retained: boolean;
  financing_bank: string | null;
  seats: number | null;
  manufacturer: string | null;
  required_license_type: string | null;
  color: string | null;
  tonnage: number | null;
} | null;

type Property = {
  address_street: string | null;
  address_city: string | null;
  square_meters: number | null;
  commercial_value: number | null;
} | null;

type LifeHealth = {
  coverage_type: string | null;
  sum_insured: number | null;
} | null;

type Policy = {
  id: string;
  previous_policy_id: string | null;
  start_date: string;
  end_date: string;
  premium_gross: number;
  premium_net: number | null;
  payment_frequency: PaymentFrequency;
  assigned_agent_id: string | null;
  broker_office_id: string | null;
};

function ViewField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export function DetailsTab({
  policy,
  vehicle,
  property,
  lifeHealth,
  agents,
  brokerOffices,
  updateDetailsAction,
}: {
  policy: Policy;
  vehicle: Vehicle;
  property: Property;
  lifeHealth: LifeHealth;
  agents: { id: string; full_name: string }[];
  brokerOffices: { id: string; name: string }[];
  updateDetailsAction: (formData: FormData) => Promise<{ error: string } | undefined>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const agentLabel = agents.find((a) => a.id === policy.assigned_agent_id)?.full_name;
  const brokerOfficeLabel = brokerOffices.find((b) => b.id === policy.broker_office_id)?.name;

  const { field, checkboxField } = useFormValues({
    start_date: policy.start_date,
    end_date: policy.end_date,
    plate_number: vehicle?.plate_number ?? "",
    manufacture_year: vehicle?.manufacture_year != null ? String(vehicle.manufacture_year) : "",
    manufacture_month: vehicle?.manufacture_month != null ? String(vehicle.manufacture_month) : "",
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    vin_chassis_number: vehicle?.vin_chassis_number ?? "",
    engine_cc: vehicle?.engine_cc != null ? String(vehicle.engine_cc) : "",
    engine_number: vehicle?.engine_number ?? "",
    kteo_expiry_date: vehicle?.kteo_expiry_date ?? "",
    insured_value: vehicle?.insured_value != null ? String(vehicle.insured_value) : "",
    zone_code: vehicle?.zone_code ?? "",
    insurance_package: vehicle?.insurance_package ?? "",
    driver_gender: vehicle?.driver_gender ?? "",
    horsepower: vehicle?.horsepower != null ? String(vehicle.horsepower) : "",
    body_type: vehicle?.body_type ?? "",
    gross_weight_kg: vehicle?.gross_weight_kg != null ? String(vehicle.gross_weight_kg) : "",
    capacity_role: vehicle?.capacity_role ?? "",
    protection_measures: vehicle?.protection_measures ?? "",
    has_trailer: vehicle?.has_trailer ? "true" : "",
    discount_percent: vehicle?.discount_percent != null ? String(vehicle.discount_percent) : "",
    special_discount_percent:
      vehicle?.special_discount_percent != null ? String(vehicle.special_discount_percent) : "",
    surcharge_percent: vehicle?.surcharge_percent != null ? String(vehicle.surcharge_percent) : "",
    is_financed: vehicle?.is_financed ? "true" : "",
    title_retained: vehicle?.title_retained ? "true" : "",
    financing_bank: vehicle?.financing_bank ?? "",
    seats: vehicle?.seats != null ? String(vehicle.seats) : "",
    manufacturer: vehicle?.manufacturer ?? "",
    required_license_type: vehicle?.required_license_type ?? "",
    color: vehicle?.color ?? "",
    tonnage: vehicle?.tonnage != null ? String(vehicle.tonnage) : "",
    address_street: property?.address_street ?? "",
    address_city: property?.address_city ?? "",
    square_meters: property?.square_meters != null ? String(property.square_meters) : "",
    commercial_value: property?.commercial_value != null ? String(property.commercial_value) : "",
    coverage_type: lifeHealth?.coverage_type ?? "",
    sum_insured: lifeHealth?.sum_insured != null ? String(lifeHealth.sum_insured) : "",
  });
  const [usageType, setUsageType] = useState<string>(vehicle?.usage_type ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Στοιχεία συμβολαίου</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setIsEditing((v) => !v)}>
            {isEditing ? "Ακύρωση" : "Επεξεργασία"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {policy.previous_policy_id && (
          <p className="mb-4 text-sm text-muted-foreground">
            Προηγούμενη περίοδος:{" "}
            <Link
              href={`/dashboard/policies/${policy.previous_policy_id}`}
              className="font-medium hover:underline"
            >
              Προβολή
            </Link>
          </p>
        )}

        {isEditing ? (
          <form
            action={async (formData) => {
              setIsSaving(true);
              const result = await updateDetailsAction(formData);
              setIsSaving(false);
              if (result?.error) {
                toast.error(result.error);
              } else {
                toast.success("Οι αλλαγές αποθηκεύτηκαν.");
                setIsEditing(false);
              }
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start_date">Έναρξη</Label>
                <Input id="start_date" name="start_date" type="date" {...field("start_date")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end_date">Λήξη</Label>
                <Input id="end_date" name="end_date" type="date" {...field("end_date")} />
              </div>
              <PremiumFields defaultGross={policy.premium_gross} defaultNet={policy.premium_net} />
              <PaymentFrequencySelect defaultValue={policy.payment_frequency} />
              <EntitySelect
                label="Συνεργάτης"
                name="assigned_agent_id"
                options={agents.map((a) => ({ id: a.id, label: a.full_name }))}
                defaultValue={policy.assigned_agent_id ?? undefined}
                placeholder="Επίλεξε συνεργάτη"
              />
              <EntitySelect
                label="Συνεργαζόμενο γραφείο"
                name="broker_office_id"
                options={brokerOffices.map((b) => ({ id: b.id, label: b.name }))}
                defaultValue={policy.broker_office_id ?? undefined}
                placeholder="— (προαιρετικό)"
              />
            </div>

            {vehicle && (
              <>
                <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                  <legend className="px-1 text-sm font-medium">Στοιχεία οχήματος</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="plate_number">Πινακίδα</Label>
                      <Input id="plate_number" name="plate_number" {...field("plate_number")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="make">Μάρκα</Label>
                      <Input id="make" name="make" {...field("make")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="model">Μοντέλο</Label>
                      <Input id="model" name="model" {...field("model")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="manufacturer">Εργοστάσιο κατασκευής</Label>
                      <Input id="manufacturer" name="manufacturer" {...field("manufacturer")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="manufacture_year">Έτος κατασκευής</Label>
                      <Input
                        id="manufacture_year"
                        name="manufacture_year"
                        type="number"
                        {...field("manufacture_year")}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="manufacture_month">Μήνας κατασκευής</Label>
                      <Input
                        id="manufacture_month"
                        name="manufacture_month"
                        type="number"
                        min={1}
                        max={12}
                        {...field("manufacture_month")}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="color">Χρώμα</Label>
                      <Input id="color" name="color" {...field("color")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="body_type">Τύπος αμαξώματος</Label>
                      <Input id="body_type" name="body_type" {...field("body_type")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="vin_chassis_number">Αρ. πλαισίου (VIN)</Label>
                      <Input id="vin_chassis_number" name="vin_chassis_number" {...field("vin_chassis_number")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="engine_number">Αρ. κινητήρα</Label>
                      <Input id="engine_number" name="engine_number" {...field("engine_number")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="engine_cc">Κυβικά</Label>
                      <Input id="engine_cc" name="engine_cc" type="number" {...field("engine_cc")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="horsepower">Ίπποι</Label>
                      <Input id="horsepower" name="horsepower" type="number" {...field("horsepower")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="seats">Θέσεις</Label>
                      <Input id="seats" name="seats" type="number" {...field("seats")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="gross_weight_kg">Μικτό βάρος (κιλά)</Label>
                      <Input id="gross_weight_kg" name="gross_weight_kg" type="number" {...field("gross_weight_kg")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="tonnage">Τόνοι</Label>
                      <Input id="tonnage" name="tonnage" type="number" step="0.01" {...field("tonnage")} />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Checkbox id="has_trailer" name="has_trailer" {...checkboxField("has_trailer")} />
                      <Label htmlFor="has_trailer">Ρυμούλκα</Label>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                  <legend className="px-1 text-sm font-medium">Χρήση &amp; ασφάλιση</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="usage_type_trigger">Χρήση</Label>
                      <Select value={usageType} onValueChange={(v) => setUsageType(v ?? "")}>
                        <SelectTrigger id="usage_type_trigger" className="w-full">
                          <SelectValue>{(v: string) => VEHICLE_USAGE_LABELS[v] ?? "— (προαιρετικό)"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(VEHICLE_USAGE_LABELS).map(([v, label]) => (
                            <SelectItem key={v} value={v}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input type="hidden" name="usage_type" value={usageType} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="driver_gender">Φύλο οδηγού</Label>
                      <Input id="driver_gender" name="driver_gender" {...field("driver_gender")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="capacity_role">Ιδιότητα ασφαλισμένου</Label>
                      <Input id="capacity_role" name="capacity_role" {...field("capacity_role")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="zone_code">Ζώνη</Label>
                      <Input id="zone_code" name="zone_code" {...field("zone_code")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="insurance_package">Πακέτο ασφάλισης</Label>
                      <Input id="insurance_package" name="insurance_package" {...field("insurance_package")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="protection_measures">Μέτρα προστασίας</Label>
                      <Input id="protection_measures" name="protection_measures" {...field("protection_measures")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="kteo_expiry_date">Λήξη ΚΤΕΟ</Label>
                      <Input id="kteo_expiry_date" name="kteo_expiry_date" type="date" {...field("kteo_expiry_date")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="insured_value">Ασφαλισμένη αξία (€)</Label>
                      <Input id="insured_value" name="insured_value" type="number" {...field("insured_value")} />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                  <legend className="px-1 text-sm font-medium">Χρηματοδότηση &amp; εκπτώσεις</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="discount_percent">Έκπτωση (%)</Label>
                      <Input id="discount_percent" name="discount_percent" type="number" step="0.01" {...field("discount_percent")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="special_discount_percent">Ειδική έκπτωση (%)</Label>
                      <Input
                        id="special_discount_percent"
                        name="special_discount_percent"
                        type="number"
                        step="0.01"
                        {...field("special_discount_percent")}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="surcharge_percent">Επιβαρύνσεις (%)</Label>
                      <Input id="surcharge_percent" name="surcharge_percent" type="number" step="0.01" {...field("surcharge_percent")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="required_license_type">Είδος διπλώματος</Label>
                      <Input id="required_license_type" name="required_license_type" {...field("required_license_type")} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="is_financed" name="is_financed" {...checkboxField("is_financed")} />
                      <Label htmlFor="is_financed">Χρηματοδότηση</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="title_retained" name="title_retained" {...checkboxField("title_retained")} />
                      <Label htmlFor="title_retained">Παρακράτηση κυριότητας</Label>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="financing_bank">Τράπεζα χρηματοδότησης</Label>
                      <Input id="financing_bank" name="financing_bank" {...field("financing_bank")} />
                    </div>
                  </div>
                </fieldset>
              </>
            )}

            {property && (
              <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Στοιχεία ακινήτου</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="address_street">Οδός</Label>
                    <Input id="address_street" name="address_street" {...field("address_street")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="address_city">Πόλη</Label>
                    <Input id="address_city" name="address_city" {...field("address_city")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="square_meters">Τετραγωνικά μέτρα</Label>
                    <Input id="square_meters" name="square_meters" type="number" {...field("square_meters")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="commercial_value">Εμπορική αξία (€)</Label>
                    <Input
                      id="commercial_value"
                      name="commercial_value"
                      type="number"
                      {...field("commercial_value")}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {lifeHealth && (
              <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Στοιχεία κάλυψης</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="coverage_type">Είδος κάλυψης</Label>
                    <Input id="coverage_type" name="coverage_type" {...field("coverage_type")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sum_insured">Ασφαλισμένο κεφάλαιο (€)</Label>
                    <Input id="sum_insured" name="sum_insured" type="number" {...field("sum_insured")} />
                  </div>
                </div>
              </fieldset>
            )}

            <Button type="submit" disabled={isSaving} className="w-fit">
              {isSaving ? "Αποθήκευση..." : "Αποθήκευση"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ViewField label="Έναρξη" value={formatDate(policy.start_date)} />
              <ViewField label="Λήξη" value={formatDate(policy.end_date)} />
              <ViewField label="Μικτό ασφάλιστρο" value={`${policy.premium_gross.toFixed(2)} €`} />
              <ViewField
                label="Καθαρό ασφάλιστρο"
                value={policy.premium_net != null ? `${policy.premium_net.toFixed(2)} €` : null}
              />
              <ViewField
                label="Συχνότητα"
                value={PAYMENT_FREQUENCY_LABELS[policy.payment_frequency] ?? policy.payment_frequency}
              />
              <ViewField label="Συνεργάτης" value={agentLabel} />
              <ViewField label="Συνεργαζόμενο γραφείο" value={brokerOfficeLabel} />
            </div>

            {vehicle && (
              <>
                <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                  <legend className="px-1 text-sm font-medium">Στοιχεία οχήματος</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <ViewField label="Πινακίδα" value={vehicle.plate_number} />
                    <ViewField label="Μάρκα" value={vehicle.make} />
                    <ViewField label="Μοντέλο" value={vehicle.model} />
                    <ViewField label="Εργοστάσιο κατασκευής" value={vehicle.manufacturer} />
                    <ViewField label="Έτος κατασκευής" value={vehicle.manufacture_year} />
                    <ViewField label="Μήνας κατασκευής" value={vehicle.manufacture_month} />
                    <ViewField label="Χρώμα" value={vehicle.color} />
                    <ViewField label="Τύπος αμαξώματος" value={vehicle.body_type} />
                    <ViewField label="Αρ. πλαισίου (VIN)" value={vehicle.vin_chassis_number} />
                    <ViewField label="Αρ. κινητήρα" value={vehicle.engine_number} />
                    <ViewField label="Κυβικά" value={vehicle.engine_cc} />
                    <ViewField label="Ίπποι" value={vehicle.horsepower} />
                    <ViewField label="Θέσεις" value={vehicle.seats} />
                    <ViewField label="Μικτό βάρος" value={vehicle.gross_weight_kg != null ? `${vehicle.gross_weight_kg} κιλά` : null} />
                    <ViewField label="Τόνοι" value={vehicle.tonnage} />
                    <ViewField label="Ρυμούλκα" value={vehicle.has_trailer ? "Ναι" : "Όχι"} />
                  </div>
                </fieldset>

                <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                  <legend className="px-1 text-sm font-medium">Χρήση &amp; ασφάλιση</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <ViewField label="Χρήση" value={vehicle.usage_type ? VEHICLE_USAGE_LABELS[vehicle.usage_type] : null} />
                    <ViewField label="Φύλο οδηγού" value={vehicle.driver_gender} />
                    <ViewField label="Ιδιότητα ασφαλισμένου" value={vehicle.capacity_role} />
                    <ViewField label="Ζώνη" value={vehicle.zone_code} />
                    <ViewField label="Πακέτο ασφάλισης" value={vehicle.insurance_package} />
                    <ViewField label="Μέτρα προστασίας" value={vehicle.protection_measures} />
                    <ViewField label="Λήξη ΚΤΕΟ" value={vehicle.kteo_expiry_date ? formatDate(vehicle.kteo_expiry_date) : null} />
                    <ViewField label="Ασφαλισμένη αξία" value={vehicle.insured_value != null ? `${vehicle.insured_value} €` : null} />
                  </div>
                </fieldset>

                <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                  <legend className="px-1 text-sm font-medium">Χρηματοδότηση &amp; εκπτώσεις</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <ViewField label="Έκπτωση" value={vehicle.discount_percent != null ? `${vehicle.discount_percent}%` : null} />
                    <ViewField label="Ειδική έκπτωση" value={vehicle.special_discount_percent != null ? `${vehicle.special_discount_percent}%` : null} />
                    <ViewField label="Επιβαρύνσεις" value={vehicle.surcharge_percent != null ? `${vehicle.surcharge_percent}%` : null} />
                    <ViewField label="Είδος διπλώματος" value={vehicle.required_license_type} />
                    <ViewField label="Χρηματοδότηση" value={vehicle.is_financed ? "Ναι" : "Όχι"} />
                    <ViewField label="Παρακράτηση κυριότητας" value={vehicle.title_retained ? "Ναι" : "Όχι"} />
                    <ViewField label="Τράπεζα χρηματοδότησης" value={vehicle.financing_bank} />
                  </div>
                </fieldset>
              </>
            )}

            {property && (
              <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Στοιχεία ακινήτου</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <ViewField label="Οδός" value={property.address_street} />
                  <ViewField label="Πόλη" value={property.address_city} />
                  <ViewField label="Τετραγωνικά μέτρα" value={property.square_meters} />
                  <ViewField
                    label="Εμπορική αξία"
                    value={property.commercial_value != null ? `${property.commercial_value} €` : null}
                  />
                </div>
              </fieldset>
            )}

            {lifeHealth && (
              <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Στοιχεία κάλυψης</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ViewField label="Είδος κάλυψης" value={lifeHealth.coverage_type} />
                  <ViewField
                    label="Ασφαλισμένο κεφάλαιο"
                    value={lifeHealth.sum_insured != null ? `${lifeHealth.sum_insured} €` : null}
                  />
                </div>
              </fieldset>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
