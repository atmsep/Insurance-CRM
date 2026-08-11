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

type Option = { id: string; label: string };

export function AdvancedPolicySearchSheet({
  form,
  agentId,
  brokerOfficeId,
  startFrom,
  startTo,
  endFrom,
  endTo,
  premiumFrom,
  premiumTo,
  agents,
  brokerOffices,
}: {
  form: string;
  agentId?: string;
  brokerOfficeId?: string;
  startFrom?: string;
  startTo?: string;
  endFrom?: string;
  endTo?: string;
  premiumFrom?: string;
  premiumTo?: string;
  agents?: Option[];
  brokerOffices?: Option[];
}) {
  const activeCount = [
    agentId,
    brokerOfficeId,
    startFrom,
    startTo,
    endFrom,
    endTo,
    premiumFrom,
    premiumTo,
  ].filter(Boolean).length;

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
          <SheetDescription>Πρόσθετα κριτήρια αναζήτησης συμβολαίων.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          {agents && (
            <div className="flex flex-col gap-2">
              <Label>Συνεργάτης</Label>
              <FilterSelect
                form={form}
                name="agent"
                defaultValue={agentId ?? ""}
                allLabel="Όλοι οι συνεργάτες"
                options={agents.map((a) => ({ id: a.id, label: a.label }))}
                className="w-full"
              />
            </div>
          )}
          {brokerOffices && (
            <div className="flex flex-col gap-2">
              <Label>Συνεργαζόμενο γραφείο</Label>
              <FilterSelect
                form={form}
                name="broker_office"
                defaultValue={brokerOfficeId ?? ""}
                allLabel="Όλα τα γραφεία"
                options={brokerOffices.map((b) => ({ id: b.id, label: b.label }))}
                className="w-full"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>Ημερομηνία έναρξης</Label>
            <div className="flex items-center gap-2">
              <Input aria-label="Από" form={form} name="start_from" type="date" defaultValue={startFrom ?? ""} />
              <span className="text-sm text-muted-foreground">έως</span>
              <Input aria-label="Έως" form={form} name="start_to" type="date" defaultValue={startTo ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Ημερομηνία λήξης</Label>
            <div className="flex items-center gap-2">
              <Input aria-label="Από" form={form} name="end_from" type="date" defaultValue={endFrom ?? ""} />
              <span className="text-sm text-muted-foreground">έως</span>
              <Input aria-label="Έως" form={form} name="end_to" type="date" defaultValue={endTo ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Μικτό ασφάλιστρο (€)</Label>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Από"
                form={form}
                name="premium_from"
                type="number"
                step="0.01"
                defaultValue={premiumFrom ?? ""}
              />
              <span className="text-sm text-muted-foreground">έως</span>
              <Input
                aria-label="Έως"
                form={form}
                name="premium_to"
                type="number"
                step="0.01"
                defaultValue={premiumTo ?? ""}
              />
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
