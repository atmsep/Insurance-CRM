"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CLIENT_TYPE_LABELS } from "../client-labels";

type Agent = { id: string; full_name: string };

export function AdvancedSearchSheet({
  form,
  city,
  email,
  region,
  postalCode,
  agentId,
  clientType,
  dobFrom,
  dobTo,
  agents,
}: {
  form: string;
  city?: string;
  email?: string;
  region?: string;
  postalCode?: string;
  agentId?: string;
  clientType?: string;
  dobFrom?: string;
  dobTo?: string;
  agents?: Agent[];
}) {
  const activeCount = [city, email, region, postalCode, agentId, clientType, dobFrom, dobTo].filter(
    Boolean,
  ).length;

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline">
            Φίλτρα
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {activeCount}
              </Badge>
            )}
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Προχωρημένη αναζήτηση</SheetTitle>
          <SheetDescription>Πρόσθετα κριτήρια αναζήτησης πελατών.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="adv-city">Πόλη</Label>
            <Input id="adv-city" form={form} name="city" defaultValue={city ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adv-region">Νομός</Label>
            <Input id="adv-region" form={form} name="region" defaultValue={region ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adv-postal-code">ΤΚ</Label>
            <Input id="adv-postal-code" form={form} name="postal_code" defaultValue={postalCode ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adv-email">Email</Label>
            <Input id="adv-email" form={form} name="email" type="email" defaultValue={email ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Τύπος πελάτη</Label>
            <FilterSelect
              form={form}
              name="client_type"
              defaultValue={clientType ?? ""}
              allLabel="Όλοι οι τύποι"
              options={Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => ({ id: value, label }))}
              className="w-full"
            />
          </div>
          {agents && (
            <div className="flex flex-col gap-2">
              <Label>Συνεργάτης</Label>
              <FilterSelect
                form={form}
                name="agent"
                defaultValue={agentId ?? ""}
                allLabel="Όλοι οι συνεργάτες"
                options={agents.map((a) => ({ id: a.id, label: a.full_name }))}
                className="w-full"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>Ημερομηνία γέννησης</Label>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Από"
                form={form}
                name="dob_from"
                type="date"
                defaultValue={dobFrom ?? ""}
              />
              <span className="text-sm text-muted-foreground">έως</span>
              <Input aria-label="Έως" form={form} name="dob_to" type="date" defaultValue={dobTo ?? ""} />
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button type="submit" form={form}>
            Εφαρμογή φίλτρων
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
