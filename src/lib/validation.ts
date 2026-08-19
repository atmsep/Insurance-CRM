// Greek ΑΦΜ (tax ID) checksum validation: 9 digits, last digit is a mod-11
// check digit over the first 8, weighted by descending powers of 2.
export function isValidAfm(afm: string): boolean {
  if (!/^\d{9}$/.test(afm)) return false;

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += Number(afm[i]) * 2 ** (8 - i);
  }
  const checkDigit = (sum % 11) % 10;
  return checkDigit === Number(afm[8]);
}

export function isValidAmka(amka: string): boolean {
  return /^\d{11}$/.test(amka);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Standard IBAN mod-97 check (ISO 13616) over the rearranged
// letters-to-digits form; accepts any country, spaces tolerated. Greek
// IBANs are additionally pinned to their fixed 27-char length.
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  if (iban.startsWith("GR") && iban.length !== 27) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

// Bare-digits normal form for storage — see normalizeGreekPhone (phone.ts)
// for the matching read-side logic. Falls back to the raw input when
// normalization would destroy it (too short to be a real number).
export function normalizePhoneForStorage(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return raw.trim();
  if (digits.startsWith("0030")) return digits.slice(4);
  if (digits.startsWith("30") && digits.length === 12) return digits.slice(2);
  return digits;
}
