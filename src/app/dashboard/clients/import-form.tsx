"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bulkImportClients, type ImportClientRow, type ImportSummary } from "./actions";

const KNOWN_FIELDS = [
  "client_type",
  "first_name",
  "last_name",
  "company_name",
  "afm",
  "phone_mobile",
  "email",
  "address_city",
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.trim().length > 0)) rows.push(row);
  }
  return rows;
}

export function ImportForm() {
  const [rows, setRows] = useState<ImportClientRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSummary(null);

    const text = await file.text();
    const table = parseCsv(text);
    if (table.length < 2) {
      setRows([]);
      return;
    }
    const headers = table[0].map((h) => h.trim().toLowerCase());
    const parsed: ImportClientRow[] = table.slice(1).map((cols) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if ((KNOWN_FIELDS as readonly string[]).includes(h)) {
          obj[h] = (cols[idx] ?? "").trim();
        }
      });
      return obj as ImportClientRow;
    });
    setRows(parsed);
  }

  function onImport() {
    startTransition(async () => {
      const result = await bulkImportClients(rows);
      setSummary(result);
    });
  }

  function rowLabel(r: ImportClientRow) {
    return r.company_name || `${r.last_name ?? ""} ${r.first_name ?? ""}`.trim() || "—";
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="file" accept=".csv,text/csv" onChange={onFileChange} className="text-sm" />

      {rows.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {fileName}: {rows.length} γραμμές έτοιμες για εισαγωγή.
          </p>
          <div className="max-h-64 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Όνομα/Επωνυμία</TableHead>
                  <TableHead>ΑΦΜ</TableHead>
                  <TableHead>Τηλέφωνο</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 20).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{rowLabel(r)}</TableCell>
                    <TableCell>{r.afm || "—"}</TableCell>
                    <TableCell>{r.phone_mobile || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button type="button" onClick={onImport} disabled={pending} className="w-fit">
            {pending ? "Εισαγωγή..." : `Εισαγωγή ${rows.length} πελατών`}
          </Button>
        </>
      )}

      {summary && (
        <div className="rounded-md border p-4 text-sm">
          <p>
            Δημιουργήθηκαν: <span className="font-medium">{summary.created}</span> · Παραλείφθηκαν
            (διπλότυπο ΑΦΜ): <span className="font-medium">{summary.skipped}</span> · Σφάλματα:{" "}
            <span className="font-medium">{summary.errors.length}</span>
          </p>
          {summary.errors.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-destructive">
              {summary.errors.map((e, i) => (
                <li key={i}>
                  Γραμμή {e.row}: {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
