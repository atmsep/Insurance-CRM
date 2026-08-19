import { getAgencyProfileCached } from "@/lib/cached-queries/lookups";

// Print-only (see globals.css .print-only) — logo top-left, generation
// timestamp top-right, centered title below, matching the layout of the
// old Profia printouts this is meant to replace. Renders even with no
// logo configured (just skips the <img>), so it never blocks printing on
// Ρυθμίσεις → Στοιχεία Γραφείου being filled in first.
export async function ReportPrintHeader({ title }: { title: string }) {
  const profile = await getAgencyProfileCached();
  const generatedAt = new Date().toLocaleString("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="print-only mb-4">
      <div className="flex items-start justify-between">
        <div>
          {profile.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt={profile.name ?? ""} className="h-12 w-auto object-contain" />
          )}
        </div>
        <span className="text-sm text-muted-foreground">{generatedAt}</span>
      </div>
      <h1 className="mt-2 text-center text-lg font-semibold">{title}</h1>
    </div>
  );
}
