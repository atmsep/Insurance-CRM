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
