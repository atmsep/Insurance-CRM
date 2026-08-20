"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BRIDGE_KIND_LABELS,
  BRIDGE_KIND_DESCRIPTIONS,
  TRANSFORMS,
  fieldsFor,
  type BridgeKind,
} from "@/lib/import-bridges/fields";
import type { FieldMapping } from "@/lib/import-bridges/map";
import {
  saveBridge,
  toggleBridgeActive,
  deleteBridge,
  analyzeSample,
  saveBridgeMappings,
  type BridgeActionState,
  type AnalyzeResult,
} from "./bridge-actions";

export type Bridge = {
  id: string;
  name: string;
  kind: BridgeKind;
  carrier_id: string | null;
  broker_office_id: string | null;
  file_format: string;
  sheet_name: string | null;
  header_row: number;
  csv_delimiter: string | null;
  date_format: string;
  decimal_separator: string;
  is_active: boolean;
  notes: string | null;
  field_count: number;
  last_run_at: string | null;
};

type Option = { id: string; name: string };

const KINDS = Object.keys(BRIDGE_KIND_LABELS) as BridgeKind[];

function ownerValue(b: Bridge) {
  return b.carrier_id ? `carrier:${b.carrier_id}` : b.broker_office_id ? `broker:${b.broker_office_id}` : "";
}

function BridgeForm({
  bridge,
  carriers,
  brokerOffices,
  onSaved,
}: {
  bridge: Bridge | null;
  carriers: Option[];
  brokerOffices: Option[];
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState<BridgeActionState, FormData>(
    saveBridge.bind(null, bridge?.id ?? null),
    undefined,
  );
  const [kind, setKind] = useState<BridgeKind>(bridge?.kind ?? "production");
  const [format, setFormat] = useState(bridge?.file_format ?? "xlsx");

  if (state && "success" in state) {
    // Το κλείσιμο γίνεται από τον γονέα ώστε να ξαναφορτώσει τη λίστα.
    queueMicrotask(onSaved);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="bridge-name">Ονομασία</Label>
        <Input
          id="bridge-name"
          name="name"
          required
          defaultValue={bridge?.name ?? ""}
          placeholder="π.χ. INTERASCO — Παραγωγή"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bridge-owner">Προέλευση</Label>
        <select
          id="bridge-owner"
          name="owner"
          required
          defaultValue={bridge ? ownerValue(bridge) : ""}
          className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">— Επίλεξε —</option>
          <optgroup label="Ασφαλιστικές εταιρείες">
            {carriers.map((c) => (
              <option key={c.id} value={`carrier:${c.id}`}>{c.name}</option>
            ))}
          </optgroup>
          <optgroup label="Συνεργαζόμενα γραφεία">
            {brokerOffices.map((b) => (
              <option key={b.id} value={`broker:${b.id}`}>{b.name}</option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bridge-kind">Είδος δεδομένων</Label>
        <select
          id="bridge-kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as BridgeKind)}
          className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>{BRIDGE_KIND_LABELS[k]}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{BRIDGE_KIND_DESCRIPTIONS[kind]}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bridge-format">Μορφή αρχείου</Label>
          <select
            id="bridge-format"
            name="file_format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV / TXT</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bridge-header-row">Γραμμή τίτλων</Label>
          <Input
            id="bridge-header-row"
            name="header_row"
            type="number"
            min={1}
            defaultValue={bridge?.header_row ?? 1}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {format === "xlsx" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="bridge-sheet">Φύλλο εργασίας</Label>
            <Input
              id="bridge-sheet"
              name="sheet_name"
              defaultValue={bridge?.sheet_name ?? ""}
              placeholder="κενό = πρώτο φύλλο"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="bridge-delim">Διαχωριστικό</Label>
            <Input
              id="bridge-delim"
              name="csv_delimiter"
              defaultValue={bridge?.csv_delimiter ?? ""}
              placeholder="κενό = αυτόματο"
              maxLength={1}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="bridge-date">Μορφή ημερομηνίας</Label>
          <select
            id="bridge-date"
            name="date_format"
            defaultValue={bridge?.date_format ?? "DD/MM/YYYY"}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="DD/MM/YYYY">31/12/2026</option>
            <option value="DD-MM-YYYY">31-12-2026</option>
            <option value="DD.MM.YYYY">31.12.2026</option>
            <option value="MM/DD/YYYY">12/31/2026</option>
            <option value="YYYY-MM-DD">2026-12-31</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bridge-decimal">Υποδιαστολή ποσών</Label>
        <select
          id="bridge-decimal"
          name="decimal_separator"
          defaultValue={bridge?.decimal_separator ?? ","}
          className="h-9 w-48 rounded-md border border-input bg-transparent px-2.5 text-sm"
        >
          <option value=",">Κόμμα — 1.245,80</option>
          <option value=".">Τελεία — 1,245.80</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bridge-notes">Σημειώσεις</Label>
        <Input id="bridge-notes" name="notes" defaultValue={bridge?.notes ?? ""} placeholder="προαιρετικό" />
      </div>

      {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Αποθήκευση..." : "Αποθήκευση"}
      </Button>
    </form>
  );
}

function MappingEditor({ bridge, onClose }: { bridge: Bridge; onClose: () => void }) {
  const targets = fieldsFor(bridge.kind);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [mappings, setMappings] = useState<Record<string, FieldMapping>>({});
  const [pending, startTransition] = useTransition();

  function setField(key: string, patch: Partial<FieldMapping>) {
    setMappings((prev) => {
      const base: FieldMapping = prev[key] ?? {
        targetField: key,
        sourceColumn: null,
        sourceIndex: null,
        transform: null,
        constantValue: null,
      };
      return { ...prev, [key]: { ...base, ...patch, targetField: key } };
    });
  }

  const headers = result && !("error" in result) ? result.headers : [];

  // Η προεπισκόπηση δείχνει μόνο ΧΑΡΤΟΓΡΑΦΗΜΕΝΑ πεδία: αλλιώς γεμίζει με
  // παύλες σε στήλες που δεν έρχονται από το αρχείο, ενώ κρύβει ακριβώς
  // αυτά που θέλεις να ελέγξεις (πινακίδα, ημερομηνίες, ποσά).
  const previewFields = targets.filter((t) => {
    const m = mappings[t.key];
    return Boolean(m && (m.sourceColumn || m.sourceIndex != null || m.constantValue));
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <p className="font-medium">Ανέβασε ένα δείγμα αρχείου</p>
        <p className="text-muted-foreground">
          Διαβάζεται μόνο για να δει τις στήλες και να προτείνει αντιστοιχίσεις — δεν αλλάζει κανένα δεδομένο.
        </p>
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await analyzeSample(bridge.id, fd);
              setResult(r);
              if (!("error" in r)) {
                const next: Record<string, FieldMapping> = {};
                for (const m of r.suggested) next[m.targetField] = m;
                setMappings(next);
                toast.success(`Βρέθηκαν ${r.headers.length} στήλες, ${r.totalRows} γραμμές.`);
              } else {
                toast.error(r.error);
              }
            });
          }}
        >
          <Input type="file" name="file" accept=".xlsx,.csv,.txt" required className="w-auto" />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? "Ανάλυση..." : "Ανάλυση δείγματος"}
          </Button>
        </form>
      </div>

      {result && "error" in result && (
        <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">{result.error}</p>
      )}

      {result && !("error" in result) && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge variant="outline">{result.totalRows} γραμμές</Badge>
            <Badge variant="outline">{result.headers.length} στήλες</Badge>
            {result.blankRowsSkipped > 0 && (
              <Badge variant="outline">{result.blankRowsSkipped} κενές παραλείφθηκαν</Badge>
            )}
            {result.rowsWithErrors > 0 && (
              <Badge variant="destructive">{result.rowsWithErrors} γραμμές με σφάλμα</Badge>
            )}
            {result.rowsWithWarnings > 0 && (
              <Badge variant="warning">{result.rowsWithWarnings} με προειδοποίηση</Badge>
            )}
            {result.sheetNames.length > 1 && (
              <span className="text-muted-foreground">Φύλλα: {result.sheetNames.join(", ")}</span>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Πεδίο CRM</TableHead>
                  <TableHead>Στήλη αρχείου</TableHead>
                  <TableHead>Μετασχηματισμός</TableHead>
                  <TableHead>Σταθερή τιμή</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((t) => {
                  const m = mappings[t.key];
                  const applicable = TRANSFORMS.filter((tr) => tr.appliesTo.includes(t.type));
                  return (
                    <TableRow key={t.key}>
                      <TableCell>
                        <div className="font-medium">
                          {t.label}
                          {t.required && <span className="ml-1 text-destructive">*</span>}
                        </div>
                        {t.hint && <p className="text-xs text-muted-foreground">{t.hint}</p>}
                      </TableCell>
                      <TableCell>
                        <select
                          value={m?.sourceColumn ?? ""}
                          onChange={(e) => setField(t.key, { sourceColumn: e.target.value || null })}
                          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                        >
                          <option value="">— καμία —</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          value={m?.transform ?? ""}
                          onChange={(e) => setField(t.key, { transform: e.target.value || null })}
                          disabled={applicable.length === 0}
                          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-40"
                        >
                          <option value="">—</option>
                          {applicable.map((tr) => (
                            <option key={tr.key} value={tr.key}>{tr.label}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={m?.constantValue ?? ""}
                          onChange={(e) => setField(t.key, { constantValue: e.target.value || null })}
                          placeholder="—"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveBridgeMappings(bridge.id, Object.values(mappings));
                  if ("error" in r) toast.error(r.error);
                  else { toast.success(r.success); onClose(); }
                })
              }
            >
              Αποθήκευση χαρτογράφησης
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                // Επαναϋπολογισμός προεπισκόπησης με τις τρέχουσες επιλογές
                // απαιτεί το αρχείο ξανά — απλούστερο να ξανα-ανεβάσει.
                void fd;
                toast.info("Ανέβασε ξανά το δείγμα για να δεις την προεπισκόπηση με τις νέες αντιστοιχίσεις.");
              }}
            >
              Ανανέωση προεπισκόπησης
            </Button>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Προεπισκόπηση (πρώτες {result.preview.length} γραμμές)</p>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    {previewFields.map((t) => (
                      <TableHead key={t.key}>{t.label}</TableHead>
                    ))}
                    <TableHead>Κατάσταση</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.preview.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                      {previewFields.map((t) => (
                        <TableCell key={t.key} className="whitespace-nowrap text-xs">
                          {row.values[t.key] === null || row.values[t.key] === undefined
                            ? "—"
                            : String(row.values[t.key])}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs">
                        {row.errors.length > 0 ? (
                          <span className="text-destructive">{row.errors.join(" · ")}</span>
                        ) : row.warnings.length > 0 ? (
                          <span className="text-amber-600">{row.warnings.join(" · ")}</span>
                        ) : (
                          <span className="text-muted-foreground">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function BridgesTab({
  bridges,
  carriers,
  brokerOffices,
}: {
  bridges: Bridge[];
  carriers: Option[];
  brokerOffices: Option[];
}) {
  const [editing, setEditing] = useState<Bridge | null>(null);
  const [creating, setCreating] = useState(false);
  const [mapping, setMapping] = useState<Bridge | null>(null);
  const [, startTransition] = useTransition();

  const ownerName = (b: Bridge) =>
    carriers.find((c) => c.id === b.carrier_id)?.name ??
    brokerOffices.find((o) => o.id === b.broker_office_id)?.name ??
    "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Γέφυρες</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Ρυθμίσεις εισαγωγής δεδομένων ανά ασφαλιστική εταιρεία ή συνεργαζόμενο γραφείο. Κάθε γέφυρα
            περιγράφει πώς διαβάζεται ένα αρχείο και ποια στήλη αντιστοιχεί σε ποιο πεδίο — νέα εταιρεία δεν
            χρειάζεται προγραμματισμό.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setCreating(true)}>
          Νέα γέφυρα
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ονομασία</TableHead>
                <TableHead>Προέλευση</TableHead>
                <TableHead>Είδος</TableHead>
                <TableHead>Μορφή</TableHead>
                <TableHead>Χαρτογράφηση</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bridges.length ? (
                bridges.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{ownerName(b)}</TableCell>
                    <TableCell>{BRIDGE_KIND_LABELS[b.kind]}</TableCell>
                    <TableCell className="uppercase text-xs text-muted-foreground">{b.file_format}</TableCell>
                    <TableCell>
                      {b.field_count > 0 ? (
                        <Badge variant="success">{b.field_count} πεδία</Badge>
                      ) : (
                        <Badge variant="warning">δεν έχει ρυθμιστεί</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.is_active ? "success" : "outline"}>
                        {b.is_active ? "Ενεργή" : "Ανενεργή"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setMapping(b)}>
                        Χαρτογράφηση
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(b)}>
                        Επεξεργασία
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => startTransition(() => toggleBridgeActive(b.id, !b.is_active))}
                      >
                        {b.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (!window.confirm(`Διαγραφή της γέφυρας «${b.name}»;`)) return;
                          startTransition(async () => {
                            const r = await deleteBridge(b.id);
                            if (r?.error) toast.error(r.error);
                            else toast.success("Η γέφυρα διαγράφηκε.");
                          });
                        }}
                      >
                        Διαγραφή
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Δεν έχει ρυθμιστεί καμία γέφυρα ακόμα.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={creating || editing !== null} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Επεξεργασία γέφυρας" : "Νέα γέφυρα"}</DialogTitle>
          </DialogHeader>
          <BridgeForm
            bridge={editing}
            carriers={carriers}
            brokerOffices={brokerOffices}
            onSaved={() => { setCreating(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={mapping !== null} onOpenChange={(o) => { if (!o) setMapping(null); }}>
        <DialogContent className="max-h-[85vh] w-full overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Χαρτογράφηση — {mapping?.name}</DialogTitle>
          </DialogHeader>
          {mapping && <MappingEditor bridge={mapping} onClose={() => setMapping(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
