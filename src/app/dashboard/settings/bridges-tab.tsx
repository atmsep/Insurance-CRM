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
import { DIMENSION_LABELS, DIMENSION_HINTS } from "@/lib/import-bridges/codes";
import {
  saveBridge,
  toggleBridgeActive,
  deleteBridge,
  analyzeSample,
  saveBridgeMappings,
  saveCodeMap,
  type BridgeActionState,
  type AnalyzeResult,
  type ResolvedCodeGroup,
  type CodeTargets,
} from "./bridge-actions";
import { runImport, type ImportRunResult } from "./import-run-actions";

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
            <option value="slk">SYLK (παλιά προγράμματα, .slk/.xls)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Η μορφή αναγνωρίζεται και αυτόματα από το ίδιο το αρχείο — αυτή η
            επιλογή είναι απλώς η προεπιλογή.
          </p>
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
        {format === "slk" ? (
          <div className="flex flex-col gap-2">
            <Label>Φύλλο εργασίας</Label>
            <p className="text-xs text-muted-foreground pt-2">
              Τα SYLK αρχεία έχουν πάντα ένα φύλλο.
            </p>
          </div>
        ) : format === "xlsx" ? (
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
  // Κρατάμε το δείγμα για να ξανατρέχει η ανάλυση χωρίς νέο ανέβασμα.
  const [sampleFile, setSampleFile] = useState<File | null>(null);
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
            const file = fd.get("file");
            if (file instanceof File) setSampleFile(file);
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
          <Input type="file" name="file" accept=".xlsx,.csv,.txt,.slk,.xls" required className="w-auto" />
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

          {result.settingsNotices.map((notice) => (
            <p
              key={notice}
              className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
            >
              {notice}
            </p>
          ))}

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
              disabled={pending || !sampleFile}
              onClick={() => {
                if (!sampleFile) return;
                // Ξανατρέχει την ανάλυση με τις ΤΡΕΧΟΥΣΕΣ επιλογές, χωρίς να
                // χρειάζεται αποθήκευση ή νέο ανέβασμα: έτσι φαίνονται αμέσως
                // και η προεπισκόπηση και οι κωδικοί που προκύπτουν.
                const fd = new FormData();
                fd.set("file", sampleFile);
                fd.set("mappings", JSON.stringify(Object.values(mappings)));
                startTransition(async () => {
                  const r = await analyzeSample(bridge.id, fd);
                  setResult(r);
                  if ("error" in r) toast.error(r.error);
                  else toast.success("Η προεπισκόπηση ενημερώθηκε.");
                });
              }}
            >
              Ανανέωση προεπισκόπησης
            </Button>
          </div>

          {result.codeGroups.length > 0 && (
            <CodeMaps
              bridgeId={bridge.id}
              groups={result.codeGroups}
              targets={result.codeTargets}
            />
          )}

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

// Οι κωδικοί του αρχείου (Εταιρία=113, Κλάδος=001) δεν σημαίνουν τίποτα
// μόνοι τους. Εδώ ο χρήστης τους αποδίδει μία φορά· κάθε επιλογή σώζεται
// αμέσως, ώστε να μη χαθεί η δουλειά αν κλείσει το παράθυρο στη μέση.
function CodeMaps({
  bridgeId,
  groups,
  targets,
}: {
  bridgeId: string;
  groups: ResolvedCodeGroup[];
  targets: CodeTargets;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of groups) for (const c of g.codes) init[`${g.dimension} ${c.code}`] = c.targetKey;
    return init;
  });
  const [saving, startSaving] = useTransition();

  const unresolved = groups.reduce(
    (n, g) => n + g.codes.filter((c) => !values[`${g.dimension} ${c.code}`]).length,
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">Αντιστοιχίσεις κωδικών</p>
        <p className="text-xs text-muted-foreground">
          {unresolved > 0
            ? `${unresolved} κωδικοί δεν έχουν αντιστοιχιστεί ακόμα. Οι γραμμές τους δεν θα περάσουν.`
            : "Όλοι οι κωδικοί του δείγματος έχουν αντιστοιχιστεί."}
        </p>
      </div>

      {groups.map((g) => (
        <div key={g.dimension} className="rounded-md border">
          <div className="border-b bg-muted/40 px-3 py-2">
            <p className="text-sm font-medium">
              {DIMENSION_LABELS[g.dimension]}{" "}
              <span className="font-normal text-muted-foreground">— στήλη «{g.sourceColumn}»</span>
            </p>
            <p className="text-xs text-muted-foreground">{DIMENSION_HINTS[g.dimension]}</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Κωδικός</TableHead>
                <TableHead>Γραμμές</TableHead>
                <TableHead>Παραδείγματα</TableHead>
                <TableHead>Αντιστοιχεί σε</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.codes.map((c) => {
                const key = `${g.dimension} ${c.code}`;
                const value = values[key] ?? "";
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{c.code}</TableCell>
                    <TableCell className="text-muted-foreground">{c.count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.samples.join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <select
                        value={value}
                        disabled={saving}
                        onChange={(e) => {
                          const next = e.target.value;
                          const previous = value;
                          setValues((p) => ({ ...p, [key]: next }));
                          startSaving(async () => {
                            const r = await saveCodeMap(bridgeId, g.dimension, c.code, next);
                            if ("error" in r) {
                              toast.error(r.error);
                              setValues((p) => ({ ...p, [key]: previous }));
                            }
                          });
                        }}
                        className={`h-8 w-full rounded-md border bg-transparent px-2 text-xs ${
                          value ? "border-input" : "border-amber-500"
                        }`}
                      >
                        <option value="">— δεν έχει αντιστοιχιστεί —</option>
                        {targets[g.dimension].map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                        <option value="ignore">Αγνόησέ τον</option>
                      </select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
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
  const [running, setRunning] = useState<Bridge | null>(null);
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
                      {b.kind === "production" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={b.field_count === 0}
                          onClick={() => setRunning(b)}
                        >
                          Εισαγωγή
                        </Button>
                      )}
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

      <Dialog open={running !== null} onOpenChange={(o) => { if (!o) setRunning(null); }}>
        <DialogContent className="max-h-[85vh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Εισαγωγή δεδομένων — {running?.name}</DialogTitle>
          </DialogHeader>
          {running && <ImportRunner bridge={running} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Η εκτέλεση ενός import γίνεται ΠΑΝΤΑ σε δύο βήματα: πρώτα δοκιμή που δεν
// γράφει τίποτα, μετά εφαρμογή. Το κουμπί εφαρμογής μένει κλειδωμένο μέχρι
// να τρέξει η δοκιμή, ώστε κανείς να μη γράψει χωρίς να έχει δει τι θα γίνει.
function ImportRunner({ bridge }: { bridge: Bridge }) {
  const [result, setResult] = useState<ImportRunResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [clientsFile, setClientsFile] = useState<File | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(apply: boolean) {
    if (!file) { toast.error("Επίλεξε αρχείο."); return; }
    const fd = new FormData();
    fd.set("file", file);
    if (clientsFile) fd.set("clients_file", clientsFile);
    fd.set("create_missing", createMissing ? "1" : "");
    fd.set("apply", apply ? "1" : "");
    startTransition(async () => {
      const r = await runImport(bridge.id, fd);
      setResult(r);
      if ("error" in r) toast.error(r.error);
      else if (apply) toast.success("Η εισαγωγή ολοκληρώθηκε.");
      else toast.success("Δοκιμή χωρίς εγγραφή — δες τι θα γίνει.");
    });
  }

  const ok = result && !("error" in result) ? result : null;
  const canApply = Boolean(ok && !ok.applied && ok.unknownCodes.length === 0 && ok.counts.ready > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="run-file" className="w-44">Αρχείο παραγωγής</Label>
            <Input
              id="run-file"
              type="file"
              accept=".xlsx,.csv,.txt,.slk,.xls"
              className="w-auto"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="run-clients" className="w-44">Πελατολόγιο (προαιρετικό)</Label>
            <Input
              id="run-clients"
              type="file"
              accept=".xlsx,.csv,.txt,.slk,.xls"
              className="w-auto"
              onChange={(e) => { setClientsFile(e.target.files?.[0] ?? null); setResult(null); }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Χρειάζεται μόνο όταν το αρχείο παραγωγής γράφει κωδικό πελάτη αντί για όνομα. Τα
            στοιχεία που έχει ήδη η καρτέλα δεν αλλάζουν ποτέ — ό,τι διαφέρει γράφεται στις σημειώσεις.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createMissing}
              onChange={(e) => { setCreateMissing(e.target.checked); setResult(null); }}
            />
            Δημιουργία νέων συμβολαίων και πελατών όταν δεν βρεθεί αντιστοιχία
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={pending || !file} onClick={() => run(false)}>
            {pending ? "Έλεγχος..." : "Δοκιμή χωρίς εγγραφή"}
          </Button>
          <Button type="button" size="sm" disabled={pending || !canApply} onClick={() => run(true)}>
            Εφαρμογή
          </Button>
        </div>
      </div>

      {result && "error" in result && (
        <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">{result.error}</p>
      )}

      {ok && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={ok.applied ? "success" : "outline"}>
              {ok.applied ? "Εφαρμόστηκε" : "Δοκιμή"}
            </Badge>
            <Badge variant="outline">{ok.totalRows} γραμμές</Badge>
            <Badge variant="outline">{ok.counts.ready} έτοιμες</Badge>
            {ok.counts.blocked > 0 && <Badge variant="destructive">{ok.counts.blocked} μπλοκαρισμένες</Badge>}
            {ok.counts.ignored > 0 && <Badge variant="outline">{ok.counts.ignored} αγνοήθηκαν</Badge>}
          </div>

          {ok.unknownCodes.length > 0 && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">
                {ok.unknownCodes.length} κωδικοί δεν έχουν αντιστοιχιστεί — η εισαγωγή δεν μπορεί να προχωρήσει.
              </p>
              <p className="mt-1 text-xs">
                Άνοιξε τη «Χαρτογράφηση» της γέφυρας, ανέβασε το ίδιο αρχείο και απόδωσέ τους. Αποθηκεύονται
                και δεν θα ξαναρωτηθούν.
              </p>
              <ul className="mt-2 list-inside list-disc text-xs">
                {ok.unknownCodes.slice(0, 20).map((u) => (
                  <li key={`${u.dimension}-${u.code}`}>
                    {DIMENSION_LABELS[u.dimension]}: «{u.code}» — {u.count} γραμμές
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="Βρέθηκαν" value={ok.matched} />
            <Stat label="Δεν βρέθηκαν" value={ok.unmatched} />
            <Stat label="Κινήσεις" value={ok.movementsCreated} />
            <Stat label="Ανανεώσεις" value={ok.policiesRenewed} />
            <Stat label="Ακυρώσεις" value={ok.policiesCancelled} />
            <Stat label="Νέα συμβόλαια" value={ok.policiesCreated} />
            <Stat label="Νέοι πελάτες" value={ok.clientsCreated} />
            <Stat label="Σημειώσεις πελατών" value={ok.clientNoteLines} />
          </div>

          {ok.issues.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Γραμμή</TableHead>
                    <TableHead>Τι συνέβη</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ok.issues.slice(0, 50).map((x, i) => (
                    <TableRow key={`${x.rowNumber}-${i}`}>
                      <TableCell className="text-muted-foreground">{x.rowNumber}</TableCell>
                      <TableCell className={x.severity === "error" ? "text-destructive text-xs" : "text-amber-600 text-xs"}>
                        {x.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
