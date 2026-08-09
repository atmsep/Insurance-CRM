// Reduces a Greek phone number to its bare 10-digit form regardless of how
// it was written (+30, 0030, spaces/dashes, or already bare), so numbers
// from different sources (Caller ID hardware, manually-typed client
// records) can be compared reliably.
export function normalizeGreekPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0030")) digits = digits.slice(4);
  else if (digits.startsWith("30") && digits.length === 12) digits = digits.slice(2);
  return digits;
}
