"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { mergeClients, anonymizeClient, searchClients } from "../../actions";

// Admin-only extras on the client header: GDPR export, merge-into, and
// anonymize. Kept in a kebab menu so the everyday header stays clean.
export function ClientAdminMenu({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced in the change handler rather than an effect — the search is
  // a reaction to typing, not to rendered state.
  function onQueryChange(next: string) {
    setQuery(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (next.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const found = await searchClients(next, clientId);
      setResults(found);
    }, 300);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="icon" aria-label="Περισσότερες ενέργειες">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              window.open(`/dashboard/clients/${clientId}/export`, "_blank");
            }}
          >
            Εξαγωγή δεδομένων (GDPR)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMergeOpen(true)}>Συγχώνευση σε άλλον πελάτη…</DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => {
              if (
                !window.confirm(
                  `Οριστική ανωνυμοποίηση του/της «${clientName}»; Τα προσωπικά στοιχεία σβήνονται και δεν επανέρχονται.`,
                )
              ) {
                return;
              }
              startTransition(async () => {
                const result = await anonymizeClient(clientId);
                if ("error" in result) toast.error(result.error);
                else toast.success(result.success);
              });
            }}
          >
            Ανωνυμοποίηση (GDPR)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Συγχώνευση διπλοεγγραφής</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Όλα τα στοιχεία του/της «{clientName}» (συμβόλαια, έγγραφα, αιτήματα, ιστορικό) θα μεταφερθούν στον
            πελάτη που θα επιλέξεις, και αυτή η καρτέλα θα απενεργοποιηθεί.
          </p>
          <Input
            placeholder="Αναζήτηση πελάτη-στόχου (όνομα, ΑΦΜ, τηλέφωνο)..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {results.map((r) => (
              <Button
                key={r.id}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                className="justify-start"
                onClick={() => {
                  if (!window.confirm(`Συγχώνευση του/της «${clientName}» στον/στην «${r.label}»; Δεν αναιρείται.`)) {
                    return;
                  }
                  startTransition(async () => {
                    const result = await mergeClients(clientId, r.id);
                    if ("error" in result) {
                      toast.error(result.error);
                    } else {
                      toast.success(result.success);
                      setMergeOpen(false);
                      router.push(`/dashboard/clients/${r.id}`);
                    }
                  });
                }}
              >
                {r.label}
              </Button>
            ))}
            {query.trim().length >= 2 && results.length === 0 && (
              <p className="text-sm text-muted-foreground">Κανένα αποτέλεσμα.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
