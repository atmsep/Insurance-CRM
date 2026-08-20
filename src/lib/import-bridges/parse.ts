import "server-only";
import ExcelJS from "exceljs";

// Διαβάζει ένα ανεβασμένο αρχείο σε πίνακα κελιών, ανεξάρτητα από μορφή.
// Δεν ξέρει τίποτα για ασφάλειες — μόνο «γραμμές και στήλες».

export type Sheet = {
  /** Οι τίτλοι στηλών όπως βρέθηκαν στη γραμμή τίτλων. */
  headers: string[];
  /** Οι γραμμές δεδομένων, ήδη ευθυγραμμισμένες με τους τίτλους. */
  rows: string[][];
  /** Ονόματα φύλλων (xlsx) ώστε το UI να προσφέρει επιλογή. */
  sheetNames: string[];
  /** Πόσες γραμμές παραλείφθηκαν επειδή ήταν εντελώς κενές. */
  blankRowsSkipped: number;
};

const MAX_ROWS = 20000;

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // Κρατάμε ISO — η μετατροπή σε ημερομηνία γίνεται στο mapping, όπου
    // ξέρουμε τη μορφή που δήλωσε η γέφυρα.
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    const v = value as { result?: unknown; text?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.result !== undefined) return cellToString(v.result);
    if (v.text !== undefined) return String(v.text);
    if (v.hyperlink) return String(v.hyperlink);
    return "";
  }
  return String(value).trim();
}

export async function parseXlsx(
  buffer: ArrayBuffer,
  opts: { sheetName?: string | null; headerRow: number },
): Promise<Sheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheetNames = wb.worksheets.map((w) => w.name);

  const ws = opts.sheetName
    ? (wb.getWorksheet(opts.sheetName) ?? wb.worksheets[0])
    : wb.worksheets[0];
  if (!ws) return { headers: [], rows: [], sheetNames, blankRowsSkipped: 0 };

  // ΚΡΙΣΙΜΟ: τοποθέτηση με βάση τον ΠΡΑΓΜΑΤΙΚΟ αριθμό γραμμής του φύλλου.
  // Το exceljs παραλείπει τις κενές γραμμές, οπότε αν τις μαζεύαμε
  // διαδοχικά, μια κενή γραμμή πριν τους τίτλους θα μετατόπιζε τα πάντα και
  // η «γραμμή τίτλων 3» θα έδειχνε σε δεδομένα (επιβεβαιωμένο με δοκιμή).
  const all: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS + opts.headerRow) return;
    const values = row.values as unknown[];
    // Το exceljs επιστρέφει 1-based πίνακα με κενό στη θέση 0.
    all[rowNumber - 1] = values.slice(1).map(cellToString);
  });
  for (let i = 0; i < all.length; i++) if (!all[i]) all[i] = [];

  return sliceHeaders(all, opts.headerRow, sheetNames);
}

// Απλός CSV parser με υποστήριξη εισαγωγικών — ίδια λογική με το υπάρχον
// import πελατών, εδώ σε μορφή που δέχεται και διαχωριστικό.
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { row.push(field.trim()); field = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(field.trim()); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

function detectDelimiter(sample: string): string {
  const candidates = [";", ",", "\t", "|"];
  const firstLines = sample.split(/\r?\n/).slice(0, 5).join("\n");
  let best = ";";
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLines.split(d).length - 1;
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return best;
}

export function parseCsv(
  text: string,
  opts: { delimiter?: string | null; headerRow: number },
): Sheet {
  // Αφαίρεση BOM — τα ελληνικά αρχεία το φέρνουν συχνά και χαλάει ο
  // πρώτος τίτλος στήλης.
  const clean = text.replace(/^﻿/, "");
  const delimiter = opts.delimiter || detectDelimiter(clean);
  const all = parseDelimited(clean, delimiter).slice(0, MAX_ROWS + opts.headerRow);
  return sliceHeaders(all, opts.headerRow, []);
}

function sliceHeaders(all: string[][], headerRow: number, sheetNames: string[]): Sheet {
  const headerIndex = Math.max(0, headerRow - 1);
  const headers = (all[headerIndex] ?? []).map((h, i) => h || `Στήλη ${i + 1}`);
  const body = all.slice(headerIndex + 1);
  let blankRowsSkipped = 0;
  const rows: string[][] = [];
  for (const r of body) {
    if (r.every((cell) => !cell)) { blankRowsSkipped++; continue; }
    // Ευθυγράμμιση με τους τίτλους ώστε ο δείκτης στήλης να είναι σταθερός.
    const aligned = headers.map((_, i) => r[i] ?? "");
    rows.push(aligned);
  }
  return { headers, rows, sheetNames, blankRowsSkipped };
}
