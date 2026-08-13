"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormValues } from "@/hooks/use-form-values";

const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: "Άγαμος/η",
  married: "Έγγαμος/η",
  divorced: "Διαζευγμένος/η",
  widowed: "Χήρος/α",
  cohabiting: "Σε συμβίωση",
  other: "Άλλο",
};

type Client = {
  marketing_opt_in: boolean;
  gdpr_consent_at: string | null;
  income: number | null;
  marital_status: string | null;
  nationality: string | null;
  language: string | null;
  notes: string | null;
};

function ViewField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

export function ProfileTab({
  client,
  updateAction,
}: {
  client: Client;
  updateAction: (formData: FormData) => Promise<{ error: string } | undefined>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(client.marketing_opt_in);

  const { field, values, setValue } = useFormValues({
    income: client.income != null ? String(client.income) : "",
    marital_status: client.marital_status ?? "",
    nationality: client.nationality ?? "",
    language: client.language ?? "",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Προφίλ</CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMarketingOptIn(client.marketing_opt_in);
              setIsEditing((v) => !v);
            }}
          >
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
            <input type="hidden" name="prior_gdpr_consent_at" value={client.gdpr_consent_at ?? ""} />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="marketing_opt_in"
                name="marketing_opt_in"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="marketing_opt_in" className="font-normal">
                Αποδοχή προωθητικών ενεργειών (GDPR)
              </Label>
            </div>
            {client.gdpr_consent_at && (
              <p className="text-xs text-muted-foreground">
                Συναίνεση από: {formatDate(client.gdpr_consent_at)}
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="income">Εισόδημα (€)</Label>
                <Input id="income" name="income" type="number" step="0.01" {...field("income")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="marital_status">Οικογενειακή κατάσταση</Label>
                <select
                  id="marital_status"
                  name="marital_status"
                  className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                  value={values.marital_status ?? ""}
                  onChange={(e) => setValue("marital_status", e.target.value)}
                >
                  <option value="">—</option>
                  {Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nationality">Εθνικότητα</Label>
                <Input id="nationality" name="nationality" {...field("nationality")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="language">Γλώσσα</Label>
                <Input id="language" name="language" {...field("language")} />
              </div>
            </div>
            <Button type="submit" disabled={isSaving} className="w-fit">
              {isSaving ? "Αποθήκευση..." : "Αποθήκευση"}
            </Button>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ViewField
              label="Αποδοχή προωθητικών ενεργειών (GDPR)"
              value={client.marketing_opt_in ? "Ναι" : "Όχι"}
            />
            <ViewField
              label="Συναίνεση από"
              value={client.gdpr_consent_at ? formatDate(client.gdpr_consent_at) : undefined}
            />
            <ViewField label="Εισόδημα" value={client.income != null ? `${client.income.toFixed(2)} €` : undefined} />
            <ViewField
              label="Οικογενειακή κατάσταση"
              value={client.marital_status ? MARITAL_STATUS_LABELS[client.marital_status] : undefined}
            />
            <ViewField label="Εθνικότητα" value={client.nationality} />
            <ViewField label="Γλώσσα" value={client.language} />
            <div className="col-span-full flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Σημειώσεις (από την καρτέλα Στοιχεία)</span>
              <span className="text-sm whitespace-pre-wrap">{client.notes || "—"}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
