import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { MultiSelect } from "@/components/ui/multi-select";
import { POLICY_MOVEMENT_KIND_LABELS } from "../../../policies/movement-labels";

type Option = { id: string; label: string };

// Persistent left-side criteria panel, matching Profia's own "Κριτήρια
// αναζήτησης" layout (a fixed column, not a slide-over sheet like
// AdvancedPolicySearchSheet on the Policies list) — everything targets
// the one shared `form` id, same convention as every other list-page
// filter form in this app.
export function ProductionFiltersPanel({
  form,
  agents,
  carriers,
  insuranceLines,
  agentIds,
  carrierId,
  lineId,
  kinds,
  issueFrom,
  issueTo,
  startFrom,
  startTo,
}: {
  form: string;
  agents: Option[];
  carriers: Option[];
  insuranceLines: Option[];
  agentIds?: string[];
  carrierId?: string;
  lineId?: string;
  kinds?: string[];
  issueFrom?: string;
  issueTo?: string;
  startFrom?: string;
  startTo?: string;
}) {
  const kindOptions = Object.entries(POLICY_MOVEMENT_KIND_LABELS).map(([id, label]) => ({ id, label }));

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Κριτήρια αναζήτησης</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Συνεργάτης</Label>
          <MultiSelect
            form={form}
            name="agent"
            defaultValue={agentIds}
            allLabel="Όλοι οι συνεργάτες"
            options={agents}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Εταιρεία</Label>
          <FilterSelect
            form={form}
            name="carrier"
            defaultValue={carrierId ?? ""}
            allLabel="Όλες οι εταιρείες"
            options={carriers}
            className="h-9 w-full text-sm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Κλάδος</Label>
          <FilterSelect
            form={form}
            name="line"
            defaultValue={lineId ?? ""}
            allLabel="Όλοι οι κλάδοι"
            options={insuranceLines}
            className="h-9 w-full text-sm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Είδος</Label>
          <MultiSelect form={form} name="kind" defaultValue={kinds} allLabel="Όλα τα είδη" options={kindOptions} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Ημ.Έκδοσης</Label>
          <div className="flex items-center gap-2">
            <Input aria-label="Από" form={form} name="issue_from" type="date" defaultValue={issueFrom ?? ""} />
            <span className="text-sm text-muted-foreground">έως</span>
            <Input aria-label="Έως" form={form} name="issue_to" type="date" defaultValue={issueTo ?? ""} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Ημ.Έναρξης</Label>
          <div className="flex items-center gap-2">
            <Input aria-label="Από" form={form} name="start_from" type="date" defaultValue={startFrom ?? ""} />
            <span className="text-sm text-muted-foreground">έως</span>
            <Input aria-label="Έως" form={form} name="start_to" type="date" defaultValue={startTo ?? ""} />
          </div>
        </div>
        <Button type="submit" form={form} variant="secondary" size="sm">
          Εφαρμογή φίλτρων
        </Button>
      </CardContent>
    </Card>
  );
}
