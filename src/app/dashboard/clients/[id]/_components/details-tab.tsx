"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReferrerField } from "../../referrer-field";
import { EntitySelect } from "@/components/entity-select";
import { useFormValues } from "@/hooks/use-form-values";

const ID_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  adt: "Α.Δ.Τ.",
  passport: "Διαβατήριο",
  other: "Άλλο",
};

type Client = {
  id: string;
  client_type: string;
  afm: string | null;
  doy: string | null;
  email: string | null;
  phone_mobile: string | null;
  phone_landline: string | null;
  address_street: string | null;
  address_number: string | null;
  address_city: string | null;
  address_region: string | null;
  address_postal_code: string | null;
  iban: string | null;
  referral_source: string | null;
  referred_by_client_id: string | null;
  referrer_relationship: string | null;
  assigned_agent_id: string | null;
  notes: string | null;
  client_individuals: {
    father_name: string | null;
    date_of_birth: string | null;
    occupation: string | null;
    id_document_type: string | null;
    id_document_number: string | null;
    amka: string | null;
  } | null;
  client_legal_entities: {
    legal_form: string | null;
    kad: string | null;
    gemi_number: string | null;
    legal_representative_name: string | null;
  } | null;
};

function ViewField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

export function DetailsTab({
  client,
  agents,
  referrerLabel,
  totalBilled,
  totalPaid,
  totalTips,
  outstanding,
  referralRewardTotal,
  referralRewardPolicyCount,
  updateAction,
}: {
  client: Client;
  agents: { id: string; full_name: string }[];
  referrerLabel: string | undefined;
  totalBilled: number;
  totalPaid: number;
  totalTips: number;
  outstanding: number;
  referralRewardTotal: number;
  referralRewardPolicyCount: number;
  updateAction: (formData: FormData) => Promise<{ error: string } | undefined>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const agentLabel = agents.find((a) => a.id === client.assigned_agent_id)?.full_name;

  const { field, values, setValue } = useFormValues({
    father_name: client.client_individuals?.father_name ?? "",
    date_of_birth: client.client_individuals?.date_of_birth ?? "",
    occupation: client.client_individuals?.occupation ?? "",
    id_document_type: client.client_individuals?.id_document_type ?? "",
    id_document_number: client.client_individuals?.id_document_number ?? "",
    amka: client.client_individuals?.amka ?? "",
    legal_form: client.client_legal_entities?.legal_form ?? "",
    kad: client.client_legal_entities?.kad ?? "",
    gemi_number: client.client_legal_entities?.gemi_number ?? "",
    legal_representative_name: client.client_legal_entities?.legal_representative_name ?? "",
    afm: client.afm ?? "",
    doy: client.doy ?? "",
    email: client.email ?? "",
    phone_mobile: client.phone_mobile ?? "",
    phone_landline: client.phone_landline ?? "",
    address_street: client.address_street ?? "",
    address_number: client.address_number ?? "",
    address_city: client.address_city ?? "",
    address_region: client.address_region ?? "",
    address_postal_code: client.address_postal_code ?? "",
    iban: client.iban ?? "",
    referral_source: client.referral_source ?? "",
    notes: client.notes ?? "",
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Στοιχεία επικοινωνίας</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setIsEditing((v) => !v)}>
              {isEditing ? "Ακύρωση" : "Επεξεργασία"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form
              action={async (formData) => {
                setIsSaving(true);
                const result = await updateAction(formData);
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
              <input type="hidden" name="client_type" value={client.client_type} />
              {client.client_type === "individual" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="father_name">Πατρώνυμο</Label>
                    <Input id="father_name" name="father_name" {...field("father_name")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="date_of_birth">Ημερομηνία γέννησης</Label>
                    <Input id="date_of_birth" name="date_of_birth" type="date" {...field("date_of_birth")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="occupation">Επάγγελμα</Label>
                    <Input id="occupation" name="occupation" {...field("occupation")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="amka">ΑΜΚΑ</Label>
                    <Input id="amka" name="amka" {...field("amka")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="id_document_type">Τύπος ταυτότητας</Label>
                    <select
                      id="id_document_type"
                      name="id_document_type"
                      className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                      value={values.id_document_type ?? ""}
                      onChange={(e) => setValue("id_document_type", e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="adt">Α.Δ.Τ.</option>
                      <option value="passport">Διαβατήριο</option>
                      <option value="other">Άλλο</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="id_document_number">Αριθμός ταυτότητας</Label>
                    <Input id="id_document_number" name="id_document_number" {...field("id_document_number")} />
                  </div>
                </div>
              )}
              {client.client_type === "legal_entity" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="legal_form">Νομική μορφή</Label>
                    <Input id="legal_form" name="legal_form" {...field("legal_form")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="kad">ΚΑΔ</Label>
                    <Input id="kad" name="kad" {...field("kad")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="gemi_number">Αριθμός Γ.Ε.ΜΗ.</Label>
                    <Input id="gemi_number" name="gemi_number" {...field("gemi_number")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="legal_representative_name">Νόμιμος εκπρόσωπος</Label>
                    <Input
                      id="legal_representative_name"
                      name="legal_representative_name"
                      {...field("legal_representative_name")}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="afm">ΑΦΜ</Label>
                  <Input id="afm" name="afm" {...field("afm")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doy">ΔΟΥ</Label>
                  <Input id="doy" name="doy" {...field("doy")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" {...field("email")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone_mobile">Κινητό τηλέφωνο</Label>
                  <Input id="phone_mobile" name="phone_mobile" {...field("phone_mobile")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone_landline">Σταθερό τηλέφωνο</Label>
                  <Input id="phone_landline" name="phone_landline" {...field("phone_landline")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="address_street">Οδός</Label>
                  <Input id="address_street" name="address_street" {...field("address_street")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="address_number">Αριθμός</Label>
                  <Input id="address_number" name="address_number" {...field("address_number")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="address_city">Πόλη</Label>
                  <Input id="address_city" name="address_city" {...field("address_city")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="address_region">Νομός</Label>
                  <Input id="address_region" name="address_region" {...field("address_region")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="address_postal_code">ΤΚ</Label>
                  <Input
                    id="address_postal_code"
                    name="address_postal_code"
                    {...field("address_postal_code")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input id="iban" name="iban" {...field("iban")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="referral_source">Πηγή σύστασης</Label>
                  <Input
                    id="referral_source"
                    name="referral_source"
                    placeholder="π.χ. Facebook, Google..."
                    {...field("referral_source")}
                  />
                </div>
                <ReferrerField
                  excludeId={client.id}
                  defaultReferrerId={client.referred_by_client_id ?? undefined}
                  defaultReferrerLabel={referrerLabel}
                  defaultRelationship={client.referrer_relationship ?? undefined}
                />
                <EntitySelect
                  label="Συνεργάτης"
                  name="assigned_agent_id"
                  options={agents.map((a) => ({ id: a.id, label: a.full_name }))}
                  defaultValue={client.assigned_agent_id ?? undefined}
                  placeholder="Επίλεξε συνεργάτη"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="notes">Σημειώσεις</Label>
                <Textarea id="notes" name="notes" rows={3} {...field("notes")} />
              </div>
              <Button type="submit" disabled={isSaving} className="w-fit">
                {isSaving ? "Αποθήκευση..." : "Αποθήκευση"}
              </Button>
            </form>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {client.client_type === "individual" && (
                <>
                  <ViewField label="Πατρώνυμο" value={client.client_individuals?.father_name} />
                  <ViewField label="Ημερομηνία γέννησης" value={client.client_individuals?.date_of_birth} />
                  <ViewField label="Επάγγελμα" value={client.client_individuals?.occupation} />
                  <ViewField label="ΑΜΚΑ" value={client.client_individuals?.amka} />
                  <ViewField
                    label="Ταυτότητα"
                    value={
                      client.client_individuals?.id_document_type
                        ? `${ID_DOCUMENT_TYPE_LABELS[client.client_individuals.id_document_type] ?? client.client_individuals.id_document_type} ${client.client_individuals?.id_document_number ?? ""}`.trim()
                        : client.client_individuals?.id_document_number
                    }
                  />
                </>
              )}
              {client.client_type === "legal_entity" && (
                <>
                  <ViewField label="Νομική μορφή" value={client.client_legal_entities?.legal_form} />
                  <ViewField label="ΚΑΔ" value={client.client_legal_entities?.kad} />
                  <ViewField label="Αριθμός Γ.Ε.ΜΗ." value={client.client_legal_entities?.gemi_number} />
                  <ViewField
                    label="Νόμιμος εκπρόσωπος"
                    value={client.client_legal_entities?.legal_representative_name}
                  />
                </>
              )}
              <ViewField label="ΑΦΜ" value={client.afm} />
              <ViewField label="ΔΟΥ" value={client.doy} />
              <ViewField label="Email" value={client.email} />
              <ViewField label="Κινητό τηλέφωνο" value={client.phone_mobile} />
              <ViewField label="Σταθερό τηλέφωνο" value={client.phone_landline} />
              <ViewField label="Οδός" value={client.address_street} />
              <ViewField label="Αριθμός" value={client.address_number} />
              <ViewField label="Πόλη" value={client.address_city} />
              <ViewField label="Νομός" value={client.address_region} />
              <ViewField label="ΤΚ" value={client.address_postal_code} />
              <ViewField label="IBAN" value={client.iban} />
              <ViewField label="Πηγή σύστασης" value={client.referral_source} />
              <ViewField label="Συστήνων" value={referrerLabel} />
              {client.referred_by_client_id && (
                <ViewField
                  label="Προμήθεια σύστασης"
                  value={
                    referralRewardPolicyCount > 0
                      ? `${referralRewardTotal.toFixed(2)} € σε ${referralRewardPolicyCount} συμβόλαι${
                          referralRewardPolicyCount === 1 ? "ο" : "α"
                        }`
                      : undefined
                  }
                />
              )}
              <ViewField label="Συνεργάτης" value={agentLabel} />
              <div className="col-span-full flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Σημειώσεις</span>
                <span className="text-sm whitespace-pre-wrap">{client.notes || "—"}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Οικονομική εικόνα</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Χρεωθέν σύνολο</span>
            <span className="text-right font-medium">{totalBilled.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Εισπραγμένο</span>
            <span className="text-right font-medium">{totalPaid.toFixed(2)} €</span>
          </div>
          {totalTips > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Φιλοδωρήματα</span>
              <span className="text-right font-medium">{totalTips.toFixed(2)} €</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Υπόλοιπο</span>
            <span className={`text-right font-medium ${outstanding > 0 ? "text-warning" : ""}`}>
              {outstanding.toFixed(2)} €
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
