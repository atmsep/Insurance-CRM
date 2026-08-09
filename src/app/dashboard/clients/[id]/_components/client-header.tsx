import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { toggleClientActive } from "../../actions";

const CLIENT_TYPE_LABELS: Record<string, string> = {
  individual: "Φυσικό πρόσωπο",
  legal_entity: "Νομικό πρόσωπο",
};

export function ClientHeader({
  clientId,
  name,
  clientType,
  afm,
  isActive,
}: {
  clientId: string;
  name: string;
  clientType: string;
  afm: string | null;
  isActive: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {CLIENT_TYPE_LABELS[clientType]} · ΑΦΜ {afm ?? "—"}{" "}
          <Badge variant={isActive ? "success" : "outline"} className="ml-2">
            {isActive ? "Ενεργός" : "Ανενεργός"}
          </Badge>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <PrintButton />
        <form action={toggleClientActive.bind(null, clientId, !isActive)}>
          <Button type="submit" variant="outline">
            {isActive ? "Απενεργοποίηση" : "Ενεργοποίηση"}
          </Button>
        </form>
        <Button
          nativeButton={false}
          render={<Link href={`/dashboard/policies/new?client_id=${clientId}`}>Νέο συμβόλαιο</Link>}
        />
      </div>
    </div>
  );
}
