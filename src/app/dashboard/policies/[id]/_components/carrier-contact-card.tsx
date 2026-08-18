import { Phone, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// Numbers/email an agent needs mid-call with a client — kept separate from
// the carrier's general contact_phone/contact_email (that's the agency's own
// commercial contact at the carrier, not what you'd hand a client).
export function CarrierContactCard({
  carrierName,
  assistancePhone,
  claimsPhone,
  claimsEmail,
}: {
  carrierName: string;
  assistancePhone: string | null;
  claimsPhone: string | null;
  claimsEmail: string | null;
}) {
  if (!assistancePhone && !claimsPhone && !claimsEmail) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{carrierName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {assistancePhone && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Φροντίδα ατυχήματος</span>
            <a href={telHref(assistancePhone)} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
              <Phone className="size-3.5 shrink-0" /> {assistancePhone}
            </a>
          </div>
        )}
        {claimsPhone && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Κλάδος ζημιών — τηλέφωνο</span>
            <a href={telHref(claimsPhone)} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
              <Phone className="size-3.5 shrink-0" /> {claimsPhone}
            </a>
          </div>
        )}
        {claimsEmail && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Κλάδος ζημιών — email</span>
            <a
              href={`mailto:${claimsEmail}`}
              className="flex items-center gap-1.5 text-sm font-medium break-all hover:underline"
            >
              <Mail className="size-3.5 shrink-0" /> {claimsEmail}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
