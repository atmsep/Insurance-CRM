import { getAgencyProfileCached } from "@/lib/cached-queries/lookups";

// Invisible on screen (.print-only, see globals.css) — only renders into
// window.print() output, at the top of whichever client/policy page
// includes it. Nothing to show until Ρυθμίσεις → Στοιχεία Γραφείου has at
// least one field filled in, so this stays silent rather than printing an
// empty box.
export async function PrintLetterhead() {
  const profile = await getAgencyProfileCached();
  if (!profile.name && !profile.address && !profile.phone && !profile.email && !profile.logoUrl) {
    return null;
  }

  return (
    <div className="print-only mb-4 flex items-center gap-4 border-b pb-4">
      {profile.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.logoUrl} alt={profile.name ?? ""} className="h-14 w-auto object-contain" />
      )}
      <div className="text-sm">
        {profile.name && <p className="font-semibold">{profile.name}</p>}
        {profile.address && <p>{profile.address}</p>}
        {(profile.phone || profile.email) && (
          <p>{[profile.phone, profile.email].filter(Boolean).join(" · ")}</p>
        )}
      </div>
    </div>
  );
}
