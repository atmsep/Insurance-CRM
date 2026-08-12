"use client";

import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  createBrokerOffice,
  toggleBrokerOfficeActive,
  createCarrierCommissionRate,
  updateCarrierCommissionRate,
  toggleCarrierCommissionRateActive,
} from "./actions";
import { useFormValues } from "@/hooks/use-form-values";

type BrokerOffice = {
  id: string;
  name: string;
  is_direct: boolean;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

type Carrier = { id: string; name: string };
type InsuranceLine = { id: string; name_el: string };

type Rate = {
  id: string;
  default_commission_percent: number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  broker_offices: { name: string } | { name: string }[] | null;
  carriers: { name: string } | { name: string }[] | null;
  insurance_lines: { name_el: string } | { name_el: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

function EditRateForm({ rate, onDone }: { rate: Rate; onDone: () => void }) {
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
        toast.success("Η σύμβαση ενημερώθηκε.");
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

export function BrokerOfficesTab({
  brokerOffices,
  carriers,
  insuranceLines,
  rates,
}: {
  brokerOffices: BrokerOffice[];
  carriers: Carrier[];
  insuranceLines: InsuranceLine[];
  rates: Rate[];
}) {
  const [pending, startTransition] = useTransition();
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [rateBrokerId, setRateBrokerId] = useState("");
  const [rateCarrierId, setRateCarrierId] = useState("");
  const [rateLineId, setRateLineId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const { field, setValues } = useFormValues({
    default_commission_percent: "",
    valid_from: today,
    valid_to: "",
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <h3 className="text-sm font-medium text-muted-foreground">Συνεργαζόμενα γραφεία</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Όνομα</TableHead>
                <TableHead>Τηλέφωνο</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {brokerOffices.length ? (
                brokerOffices.map((office) => (
                  <TableRow key={office.id}>
                    <TableCell>
                      {office.name}
                      {office.is_direct && (
                        <Badge variant="outline" className="ml-2">
                          Απευθείας συμβάσεις
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{office.phone ?? "—"}</TableCell>
                    <TableCell>{office.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={office.is_active ? "default" : "outline"}>
                        {office.is_active ? "Ενεργό" : "Ανενεργό"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!office.is_direct && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            startTransition(() =>
                              toggleBrokerOfficeActive(office.id, !office.is_active),
                            )
                          }
                        >
                          {office.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Δεν υπάρχουν συνεργαζόμενα γραφεία.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <form action={createBrokerOffice} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="broker_name">Όνομα</Label>
            <Input id="broker_name" name="name" required className="w-56" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="broker_phone">Τηλέφωνο</Label>
            <Input id="broker_phone" name="phone" className="w-40" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="broker_email">Email</Label>
            <Input id="broker_email" name="email" type="email" className="w-56" />
          </div>
          <Button type="submit">Προσθήκη γραφείου</Button>
        </form>
      </div>

      <div className="flex flex-col gap-6">
        <h3 className="text-sm font-medium text-muted-foreground">
          Συμβάσεις προμηθειών ανά κλάδο
        </h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Γραφείο</TableHead>
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
              {rates.length ? (
                rates.map((rate) => (
                  <Fragment key={rate.id}>
                    <TableRow>
                      <TableCell>{one(rate.broker_offices)?.name ?? "—"}</TableCell>
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
                            onClick={() =>
                              setEditingRateId(editingRateId === rate.id ? null : rate.id)
                            }
                          >
                            {editingRateId === rate.id ? "Κλείσιμο" : "Επεξεργασία"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              startTransition(() =>
                                toggleCarrierCommissionRateActive(rate.id, !rate.is_active),
                              )
                            }
                          >
                            {rate.is_active ? "Ακύρωση" : "Επαναφορά"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {editingRateId === rate.id && (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <EditRateForm rate={rate} onDone={() => setEditingRateId(null)} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Δεν υπάρχουν συμβάσεις προμηθειών.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <form
          action={async (formData) => {
            const result = await createCarrierCommissionRate(formData);
            if (result?.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Η σύμβαση προστέθηκε.");
            setRateBrokerId("");
            setRateCarrierId("");
            setRateLineId("");
            setValues({ default_commission_percent: "", valid_from: today, valid_to: "" });
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label>Γραφείο</Label>
            <Select value={rateBrokerId} onValueChange={(v) => setRateBrokerId(v ?? "")}>
              <SelectTrigger className="w-48">
                <SelectValue>
                  {(value: string) =>
                    brokerOffices.find((b) => b.id === value)?.name ?? "Επίλεξε γραφείο"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {brokerOffices.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="broker_office_id" value={rateBrokerId} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Ασφαλιστική εταιρεία</Label>
            <Select value={rateCarrierId} onValueChange={(v) => setRateCarrierId(v ?? "")}>
              <SelectTrigger className="w-48">
                <SelectValue>
                  {(value: string) =>
                    carriers.find((c) => c.id === value)?.name ?? "Επίλεξε εταιρεία"
                  }
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
            <input type="hidden" name="carrier_id" value={rateCarrierId} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Κλάδος</Label>
            <Select value={rateLineId} onValueChange={(v) => setRateLineId(v ?? "")}>
              <SelectTrigger className="w-48">
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
            <input type="hidden" name="insurance_line_id" value={rateLineId} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="default_commission_percent">Ποσοστό (%)</Label>
            <Input
              id="default_commission_percent"
              name="default_commission_percent"
              type="number"
              step="0.01"
              required
              {...field("default_commission_percent")}
              className="w-28"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="valid_from">Ισχύει από</Label>
            <Input id="valid_from" name="valid_from" type="date" {...field("valid_from")} className="w-40" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="valid_to">Ισχύει έως</Label>
            <Input id="valid_to" name="valid_to" type="date" {...field("valid_to")} className="w-40" />
          </div>
          <Button type="submit">Προσθήκη σύμβασης</Button>
        </form>
      </div>
    </div>
  );
}
