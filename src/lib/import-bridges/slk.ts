import "server-only";
import type { Sheet } from "./parse";

// SYLK (Symbolic Link) — η μορφή που βγάζουν παλιά ελληνικά ασφαλιστικά
// προγράμματα (π.χ. "W2W 3000"). Είναι ΚΕΙΜΕΝΟ, όχι Excel, αλλά τα αρχεία
// έρχονται συνήθως με κατάληξη .xls γιατί το Excel τα ανοίγει κανονικά.
// Ούτε το exceljs ούτε ο CSV parser μπορούν να τα διαβάσουν, γι' αυτό
// υπάρχει ξεχωριστός αναγνώστης εδώ.
//
// Μορφή: μία εγγραφή ανά γραμμή, πεδία χωρισμένα με «;».
//   ID;PW2W 3000        η υπογραφή του αρχείου
//   P;P<μορφή>          ορισμός μορφής (0,1,2... με τη σειρά εμφάνισης)
//   B;Y<γρ>;X<στ>       διαστάσεις
//   F;P1;...;Y2;X14     θέση + μορφή του επόμενου κελιού
//   C;K"κείμενο"        η τιμή του κελιού

const SYLK_SIGNATURE = "ID;P";
const MAX_ROWS = 20000;

/** Αναγνωρίζει SYLK από τα πρώτα bytes — όχι από την κατάληξη. */
export function isSlk(bytes: Uint8Array): boolean {
  if (bytes.length < SYLK_SIGNATURE.length) return false;
  for (let i = 0; i < SYLK_SIGNATURE.length; i++) {
    if (bytes[i] !== SYLK_SIGNATURE.charCodeAt(i)) return false;
  }
  return true;
}

/** Αναγνωρίζει παλιό δυαδικό .xls (OLE2) — αυτό όντως δεν υποστηρίζεται. */
export function isLegacyBinaryXls(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1
  );
}

// Windows-1253 (ελληνικά). Γράφεται με το χέρι ώστε να μην εξαρτιόμαστε από
// το αν το Node του Vercel έχει πλήρες ICU για το TextDecoder("windows-1253").
const CP1253_HIGH: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
  0x89: "‰", 0x8b: "‹", 0x91: "‘", 0x92: "’", 0x93: "“",
  0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x99: "™", 0x9b: "›",
  0xa0: " ", 0xa1: "΅", 0xa2: "Ά", 0xa3: "£", 0xa4: "¤",
  0xa5: "¥", 0xa6: "¦", 0xa7: "§", 0xa8: "¨", 0xa9: "©", 0xab: "«", 0xac: "¬",
  0xad: "­", 0xae: "®", 0xaf: "―", 0xb0: "°", 0xb1: "±", 0xb2: "²",
  0xb3: "³", 0xb4: "΄", 0xb5: "µ", 0xb6: "¶", 0xb7: "·", 0xb8: "Έ",
  0xb9: "Ή", 0xba: "Ί", 0xbb: "»", 0xbc: "Ό", 0xbd: "½",
  0xbe: "Ύ", 0xbf: "Ώ",
};

function decodeCp1253(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    if (b < 0x80) out += String.fromCharCode(b);
    else if (CP1253_HIGH[b] !== undefined) out += CP1253_HIGH[b];
    // 0xC0..0xFF αντιστοιχούν γραμμικά στο ελληνικό μπλοκ U+0390..U+03CF.
    else if (b >= 0xc0) out += String.fromCharCode(0x0390 + (b - 0xc0));
    else out += "";
  }
  return out;
}

// Τα περισσότερα τέτοια αρχεία είναι Windows-1253, αλλά νεότερες εκδόσεις
// βγάζουν UTF-8. Αν το περιεχόμενο είναι έγκυρο UTF-8 ΚΑΙ έχει πολυ-byte
// χαρακτήρα, το εμπιστευόμαστε· αλλιώς πάμε σε 1253.
function decodeText(bytes: Uint8Array): string {
  let hasMultibyte = false;
  for (const b of bytes) if (b >= 0x80) { hasMultibyte = true; break; }
  if (!hasMultibyte) return decodeCp1253(bytes);
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return utf8.replace(/^﻿/, "");
  } catch {
    return decodeCp1253(bytes);
  }
}

// Χωρίζει μια εγγραφή σε πεδία. Στο SYLK ένα «;» μέσα σε τιμή γράφεται
// διπλό, οπότε δεν αρκεί απλό split.
function splitRecord(line: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ";") {
      if (line[i + 1] === ";") { cur += ";"; i++; continue; }
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += line[i];
  }
  parts.push(cur);
  return parts;
}

const DATE_FORMAT_RE = /^[mdy\/.\- ]+$/i;

/** Σειριακός Excel -> ISO (1900 date system, με το γνωστό κενό της 29/2/1900). */
function serialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  return d.toISOString().slice(0, 10);
}

export function parseSlk(buffer: ArrayBuffer, opts: { headerRow: number }): Sheet {
  const text = decodeText(new Uint8Array(buffer));

  const formats: string[] = [];
  const dateFormatIndexes = new Set<number>();
  const grid: string[][] = [];

  let x = 1;
  let y = 1;
  let formatIndex = 0;

  for (const line of text.split(/\r?\n/)) {
    const parts = splitRecord(line);
    const type = parts[0];

    if (type === "P") {
      const body = parts[1] ?? "";
      // P;P<μορφή> = μορφή αριθμού· P;F<γραμματοσειρά> = γραμματοσειρά
      // (ξεχωριστή λίστα, δεν μετράει στην αρίθμηση των μορφών).
      if (body.startsWith("P")) {
        const fmt = body.slice(1);
        formats.push(fmt);
        if (DATE_FORMAT_RE.test(fmt)) dateFormatIndexes.add(formats.length - 1);
      }
      continue;
    }

    if (type !== "F" && type !== "C") continue;

    let value: string | null = null;
    let hasValue = false;
    let movedPosition = false;
    let declaredFormat: number | null = null;

    for (const field of parts.slice(1)) {
      const tag = field[0];
      const rest = field.slice(1);
      if (tag === "X") { x = parseInt(rest, 10); movedPosition = true; }
      else if (tag === "Y") { y = parseInt(rest, 10); movedPosition = true; }
      else if (tag === "P") {
        const i = parseInt(rest, 10);
        if (!Number.isNaN(i)) declaredFormat = i;
      } else if (tag === "K") {
        hasValue = true;
        value = rest.startsWith('"') && rest.endsWith('"') ? rest.slice(1, -1) : rest;
      }
    }

    if (type === "F") {
      // Μια εγγραφή F χωρίς P σημαίνει προεπιλεγμένη μορφή — ΔΕΝ κληρονομεί
      // τη μορφή του προηγούμενου κελιού (αλλιώς μια στήλη ημερομηνιών θα
      // «έβαφε» τις επόμενες αριθμητικές στήλες).
      formatIndex = declaredFormat ?? 0;
      if (movedPosition) continue;
    } else if (declaredFormat !== null) {
      formatIndex = declaredFormat;
    }

    if (!hasValue || value === null) continue;
    if (y > MAX_ROWS + opts.headerRow) continue;

    let cell = value;
    const numeric = Number(cell);
    if (
      dateFormatIndexes.has(formatIndex) &&
      cell !== "" &&
      Number.isFinite(numeric) &&
      numeric > 20000 &&
      numeric < 80000
    ) {
      cell = serialToIso(numeric);
    }

    if (!grid[y - 1]) grid[y - 1] = [];
    grid[y - 1][x - 1] = cell;
    // Διαδοχικές εγγραφές C χωρίς X συνεχίζουν στην επόμενη στήλη.
    x += 1;
  }

  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) grid[i] = [];
    for (let j = 0; j < grid[i].length; j++) if (grid[i][j] === undefined) grid[i][j] = "";
  }

  const headerIndex = Math.max(0, opts.headerRow - 1);
  const headers = (grid[headerIndex] ?? []).map((h, i) => h || `Στήλη ${i + 1}`);
  const rows: string[][] = [];
  let blankRowsSkipped = 0;
  for (const r of grid.slice(headerIndex + 1)) {
    if (r.every((c) => !c)) { blankRowsSkipped++; continue; }
    rows.push(headers.map((_, i) => r[i] ?? ""));
  }

  return { headers, rows, sheetNames: [], blankRowsSkipped };
}
