"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntitySelect } from "@/components/entity-select";
import { PremiumFields } from "../../premium-fields";
import { PaymentFrequencySelect, PAYMENT_FREQUENCY_LABELS } from "../../payment-frequency-select";
import { useFormValues } from "@/hooks/use-form-values";
import { formatDate } from "@/lib/date";
import type { PaymentFrequency } from "@/lib/database.types";

type Vehicle = {
  plate_number: string | null;
  manufacture_year: number | null;
  make: string | null;
  model: string | null;
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

  const { field } = useFormValues({
    start_date: policy.start_date,
    end_date: policy.end_date,
    plate_number: vehicle?.plate_number ?? "",
    manufacture_year: vehicle?.manufacture_year != null ? String(vehicle.manufacture_year) : "",
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    address_street: property?.address_street ?? "",
    address_city: property?.address_city ?? "",
    square_meters: property?.square_meters != null ? String(property.square_meters) : "",
    commercial_value: property?.commercial_value != null ? String(property.commercial_value) : "",
    coverage_type: lifeHealth?.coverage_type ?? "",
    sum_insured: lifeHealth?.sum_insured != null ? String(lifeHealth.sum_insured) : "",
  });

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
              <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Στοιχεία οχήματος</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="plate_number">Πινακίδα</Label>
                    <Input id="plate_number" name="plate_number" {...field("plate_number")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="manufacture_year">Έτος κατασκευής</Label>
                    <Input id="manufacture_year" name="manufacture_year" type="number" {...field("manufacture_year")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="make">Μάρκα</Label>
                    <Input id="make" name="make" {...field("make")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="model">Μοντέλο</Label>
                    <Input id="model" name="model" {...field("model")} />
                  </div>
                </div>
              </fieldset>
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
              <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Στοιχεία οχήματος</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <ViewField label="Πινακίδα" value={vehicle.plate_number} />
                  <ViewField label="Έτος κατασκευής" value={vehicle.manufacture_year} />
                  <ViewField label="Μάρκα" value={vehicle.make} />
                  <ViewField label="Μοντέλο" value={vehicle.model} />
                </div>
              </fieldset>
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
