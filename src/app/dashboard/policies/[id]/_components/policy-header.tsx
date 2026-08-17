import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/print-button";
import { StatusSelect } from "../../status-select";
import { SendEmailButton } from "../../send-email-button";
import type { PolicyStatus } from "@/lib/database.types";

type EmailTemplate = { id: string; name: string; subject: string; body: string };

export function PolicyHeader({
  policyId,
  policyNumber,
  status,
  statusAutoManaged,
  clientId,
  clientName,
  lineName,
  carrierName,
  riskLabel,
  renewalNumber,
  clientEmail,
  emailTemplates,
  emailMergeFields,
}: {
  policyId: string;
  policyNumber: string;
  status: PolicyStatus;
  statusAutoManaged: boolean;
  clientId: string | undefined;
  clientName: string;
  lineName: string | undefined;
  carrierName: string | undefined;
  riskLabel: string | null;
  renewalNumber: number;
  clientEmail: string | null;
  emailTemplates: EmailTemplate[];
  emailMergeFields: Record<string, string>;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">
          {policyNumber}
          {renewalNumber > 1 && (
            <Badge variant="outline" className="ml-2 align-middle">
              Ανανέωση #{renewalNumber}
            </Badge>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/dashboard/clients/${clientId}`} className="hover:underline">
            {clientName}
          </Link>{" "}
          · {lineName} · {carrierName}
          {riskLabel && <> · {riskLabel}</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {status === "active" && (
          <SendEmailButton
            policyId={policyId}
            clientEmail={clientEmail}
            templates={emailTemplates}
            mergeFields={emailMergeFields}
          />
        )}
        <PrintButton />
        {status !== "cancelled" && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/policies/new?renew_from=${policyId}`}>Ανανέωση</Link>}
          />
        )}
        <StatusSelect policyId={policyId} status={status} statusAutoManaged={statusAutoManaged} />
      </div>
    </div>
  );
}
