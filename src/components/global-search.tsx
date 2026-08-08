"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchClients } from "@/app/dashboard/clients/actions";
import { searchPolicies } from "@/app/dashboard/policies/actions";

type Result = { id: string; label: string };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [clients, setClients] = useState<Result[]>([]);
  const [policies, setPolicies] = useState<Result[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
    }

    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!text.trim()) return;
    const handle = setTimeout(async () => {
      const [foundClients, foundPolicies] = await Promise.all([
        searchClients(text),
        searchPolicies(text),
      ]);
      setClients(foundClients);
      setPolicies(foundPolicies);
    }, 250);
    return () => clearTimeout(handle);
  }, [text]);

  function close() {
    setOpen(false);
    setText("");
    setClients([]);
    setPolicies([]);
  }

  function go(path: string) {
    close();
    router.push(path);
  }

  const hasQuery = text.trim().length > 0;
  const hasResults = clients.length > 0 || policies.length > 0;

  return (
    <>
      <Button type="button" variant="ghost" size="sm" aria-label="Αναζήτηση" onClick={() => setOpen(true)}>
        <Search className="size-4" />
        <span className="hidden text-xs text-muted-foreground lg:inline">Ctrl+K</span>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={close} aria-hidden="true" />
          <div className="fixed inset-x-4 top-20 z-50 mx-auto max-w-lg rounded-lg border bg-popover p-3 shadow-lg">
            <div className="flex items-center gap-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Αναζήτηση πελάτη ή συμβολαίου..."
                className="border-none focus-visible:ring-0"
              />
              <Button type="button" variant="ghost" size="sm" aria-label="Κλείσιμο" onClick={close}>
                <X className="size-4" />
              </Button>
            </div>

            {hasQuery && (
              <div className="mt-3 max-h-96 overflow-y-auto">
                {clients.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Πελάτες</p>
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => go(`/dashboard/clients/${c.id}`)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
                {policies.length > 0 && (
                  <div>
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Συμβόλαια</p>
                    {policies.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => go(`/dashboard/policies/${p.id}`)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
                {!hasResults && (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Δεν βρέθηκαν αποτελέσματα.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
