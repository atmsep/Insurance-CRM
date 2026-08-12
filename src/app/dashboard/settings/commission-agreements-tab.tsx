"use client";

import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormValues } from "@/hooks/use-form-values";
import {
  createCommissionAgreement,
  updateCommissionAgreement,
  toggleCommissionAgreementActive,
  createCarrierCommissionRate,
  updateCarrierCommissionRate,
  toggleCarrierCommissionRateActive,
} from "./actions";

type Carrier = { id: string; name: string };
type InsuranceLine = { id: string; name_el: string };

type RateLine = {
  id: string;
  carrier_id: string;
  insurance_line_id: string;
  default_commission_percent: number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  carriers: { name: string } | { name: string }[] | null;
  insurance_lines: { name_el: string } | { name_el: string }[] | null;
};

type Agreement = {
  id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  carrier_commission_rates: RateLine[];
};

export type BrokerOfficeWithAgreements = {
  id: string;
  name: string;
  is_direct: boolean;
  is_active: boolean;
  commission_agreements: Agreement[];
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

function EditRateLineForm({ rate, onDone }: { rate: RateLine; onDone: () => void }) {
  const updateAction = updateCarrierCommissionRate.bind(null, rate.id);
  const { field } = useFormValues({
    default_commission_percent: String(rate.default_commission_percent),
    valid_from: rate.valid_from,
    valid_to: rate.valid_to ?? "",
  });

  return (
    <form
      action={async (formData) => {
        const result = await updateAction(formData);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Η γραμμή ενημερώθηκε.");
        onDone();
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`percent_${rate.id}`}>Ποσοστό (%)</Label>
        <Input
          id={`percent_${rate.id}`}
          name="default_commission_percent"
          type="number"
          step="0.01"
          required
          {...field("default_commission_percent")}
          className="w-28"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`valid_from_${rate.id}`}>Ισχύει από</Label>
        <Input
          id={`valid_from_${rate.id}`}
          name="valid_from"
          type="date"
          {...field("valid_from")}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`valid_to_${rate.id}`}>Ισχύει έως</Label>
        <Input
          id={`valid_to_${rate.id}`}
          name="valid_to"
          type="date"
          {...field("valid_to")}
          className="w-40"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Αποθήκευση
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Άκυρο
        </Button>
      </div>
    </form>
  );
}

function AddRateLineForm({
  agreementId,
  carriers,
  insuranceLines,
}: {
  agreementId: string;
  carriers: Carrier[];
  insuranceLines: InsuranceLine[];
}) {
  const [carrierId, setCarrierId] = useState("");
  const [lineId, setLineId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const { field, setValues } = useFormValues({
    default_commission_percent: "",
    valid_from: today,
    valid_to: "",
  });

  return (
    <form
      action={async (formData) => {
        const result = await createCarrierCommissionRate(formData);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Η γραμμή προστέθηκε.");
        setCarrierId("");
        setLineId("");
        setValues({ default_commission_percent: "", valid_from: today, valid_to: "" });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="agreement_id" value={agreementId} />

      <div className="flex flex-col gap-2">
        <Label>Ασφαλιστική εταιρεία</Label>
        <Select value={carrierId} onValueChange={(v) => setCarrierId(v ?? "")}>
          <SelectTrigger className="w-48">
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

      <div className="flex flex-col gap-2">
        <Label>Κλάδος</Label>
        <Select value={lineId} onValueChange={(v) => setLineId(v ?? "")}>
          <SelectTrigger className="w-48">
            <SelectValue>
              {(value: string) => insuranceLines.find((l) => l.id === value)?.name_el ?? "Επίλεξε κλάδο"}
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

      <div className="flex flex-col gap-2">
        <Label htmlFor={`percent_new_${agreementId}`}>Ποσοστό (%)</Label>
        <Input
          id={`percent_new_${agreementId}`}
          name="default_commission_percent"
          type="number"
          step="0.01"
          required
          {...field("default_commission_percent")}
          className="w-28"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`from_new_${agreementId}`}>Ισχύει από</Label>
        <Input
          id={`from_new_${agreementId}`}
          name="valid_from"
          type="date"
          {...field("valid_from")}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`to_new_${agreementId}`}>Ισχύει έως</Label>
        <Input
          id={`to_new_${agreementId}`}
          name="valid_to"
          type="date"
          {...field("valid_to")}
          className="w-40"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary">
        Προσθήκη γραμμής
      </Button>
    </form>
  );
}

function AgreementCard({
  agreement,
  carriers,
  insuranceLines,
}: {
  agreement: Agreement;
  carriers: Carrier[];
  insuranceLines: InsuranceLine[];
}) {
  const [pending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const updateAction = updateCommissionAgreement.bind(null, agreement.id);
  const { field } = useFormValues({
    name: agreement.name,
    notes: agreement.notes ?? "",
  });

  return (
    <Card className={agreement.is_active ? undefined : "opacity-60"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {agreement.name}
          <Badge variant={agreement.is_active ? "default" : "outline"}>
            {agreement.is_active ? "Ενεργή" : "Ανενεργή"}
          </Badge>
        </CardTitle>
        <CardAction className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsEditing((v) => !v)}>
            {isEditing ? "Κλείσιμο" : "Επεξεργασία"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await toggleCommissionAgreementActive(agreement.id, !agreement.is_active);
                if (result?.error) toast.error(result.error);
              })
            }
          >
            {agreement.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isEditing ? (
          <form
            action={async (formData) => {
              const result = await updateAction(formData);
              if (result?.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Η σύμβαση ενημερώθηκε.");
              setIsEditing(false);
            }}
            className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`name_${agreement.id}`}>Όνομα σύμβασης</Label>
              <Input id={`name_${agreement.id}`} name="name" required {...field("name")} className="w-56" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`notes_${agreement.id}`}>Σημειώσεις</Label>
              <Textarea id={`notes_${agreement.id}`} name="notes" rows={2} {...field("notes")} className="w-72" />
            </div>
            <Button type="submit" size="sm">
              Αποθήκευση
            </Button>
          </form>
        ) : (
          agreement.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{agreement.notes}</p>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ασφαλιστική εταιρεία</TableHead>
                <TableHead>Κλάδος</TableHead>
                <TableHead>Ποσοστό</TableHead>
                <TableHead>Ισχύει από</TableHead>
                <TableHead>Ισχύει έως</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreement.carrier_commission_rates.length ? (
                agreement.carrier_commission_rates.map((rate) => (
                  <Fragment key={rate.id}>
                    <TableRow>
                      <TableCell>{one(rate.carriers)?.name ?? "—"}</TableCell>
                      <TableCell>{one(rate.insurance_lines)?.name_el ?? "—"}</TableCell>
                      <TableCell>{rate.default_commission_percent}%</TableCell>
                      <TableCell>{formatDate(rate.valid_from)}</TableCell>
                      <TableCell>{rate.valid_to ? formatDate(rate.valid_to) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={rate.is_active ? "default" : "outline"}>
                          {rate.is_active ? "Ενεργή" : "Ακυρωμένη"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingRateId(editingRateId === rate.id ? null : rate.id)}
                          >
                            {editingRateId === rate.id ? "Κλείσιμο" : "Επεξεργασία"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              startTransition(() => toggleCarrierCommissionRateActive(rate.id, !rate.is_active))
                            }
                          >
                            {rate.is_active ? "Ακύρωση" : "Επαναφορά"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {editingRateId === rate.id && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <EditRateLineForm rate={rate} onDone={() => setEditingRateId(null)} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Δεν υπάρχουν γραμμές σε αυτή τη σύμβαση.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <AddRateLineForm agreementId={agreement.id} carriers={carriers} insuranceLines={insuranceLines} />
      </CardContent>
    </Card>
  );
}

function NewAgreementForm({ brokerOfficeId, brokerOfficeName }: { brokerOfficeId: string; brokerOfficeName: string }) {
  const [showForm, setShowForm] = useState(false);
  const createAction = createCommissionAgreement.bind(null, brokerOfficeId);

  if (!showForm) {
    return (
      <Button size="sm" onClick={() => setShowForm(true)}>
        Δημιουργία σύμβασης
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        const result = await createAction(formData);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Η σύμβαση δημιουργήθηκε.");
        setShowForm(false);
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`new_name_${brokerOfficeId}`}>Όνομα σύμβασης</Label>
        <Input
          id={`new_name_${brokerOfficeId}`}
          name="name"
          required
          defaultValue={`Σύμβαση ${brokerOfficeName}`}
          className="w-56"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`new_notes_${brokerOfficeId}`}>Σημειώσεις</Label>
        <Textarea id={`new_notes_${brokerOfficeId}`} name="notes" rows={2} className="w-72" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Δημιουργία
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
          Άκυρο
        </Button>
      </div>
    </form>
  );
}

export function CommissionAgreementsTab({
  brokerOffices,
  carriers,
  insuranceLines,
}: {
  brokerOffices: BrokerOfficeWithAgreements[];
  carriers: Carrier[];
  insuranceLines: InsuranceLine[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">
        Μία ενεργή σύμβαση ανά συνεργαζόμενο γραφείο, με όλες τις εταιρείες και τους κλάδους μαζί.
      </p>

      {brokerOffices.length ? (
        brokerOffices.map((office) => {
          const activeAgreement = office.commission_agreements.find((a) => a.is_active);
          const inactiveAgreements = office.commission_agreements.filter((a) => !a.is_active);

          return (
            <div key={office.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">{office.name}</h3>
                {office.is_direct && <Badge variant="outline">Απευθείας συμβάσεις</Badge>}
                {!office.is_active && <Badge variant="outline">Ανενεργό γραφείο</Badge>}
              </div>

              {activeAgreement ? (
                <AgreementCard agreement={activeAgreement} carriers={carriers} insuranceLines={insuranceLines} />
              ) : (
                <NewAgreementForm brokerOfficeId={office.id} brokerOfficeName={office.name} />
              )}

              {inactiveAgreements.length > 0 && (
                <div className="flex flex-col gap-3 pl-4">
                  <p className="text-xs text-muted-foreground">Παλαιότερες συμβάσεις</p>
                  {inactiveAgreements.map((agreement) => (
                    <AgreementCard
                      key={agreement.id}
                      agreement={agreement}
                      carriers={carriers}
                      insuranceLines={insuranceLines}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">Δεν υπάρχουν συνεργαζόμενα γραφεία.</p>
      )}
    </div>
  );
}
