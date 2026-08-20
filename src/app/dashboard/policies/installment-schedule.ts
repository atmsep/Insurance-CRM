// Pure schedule math, kept out of movements-actions.ts because a
// "use server" module may only export async functions.

// How many δόσεις a term produces for each payment frequency, given the
// term's length: one per period that fits in the term (a 6-month policy on
// semiannual frequency is 1 δόση, a 12-month one is 2). Always at least 1.
//
// This deliberately reads the frequency against the ACTUAL term rather
// than assuming a year, so it agrees with the new-policy form either way:
// that form defaults Λήξη to start + the frequency's own period (a
// "τριμηνιαία" policy defaults to a 3-month term → exactly 1 δόση, the
// pre-existing behavior), while a user who overrides Λήξη to a full year
// on the same frequency gets the 4 δόσεις they clearly meant.
const FREQUENCY_PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
  single_premium: 0, // whole term in one δόση
};

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp end-of-month drift (31 Jan + 1m → 28/29 Feb, not 2/3 Mar).
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function buildInstallmentSchedule(
  startDate: string,
  endDate: string,
  premiumGross: number,
  paymentFrequency: string | null | undefined,
): { installmentNumber: number; dueDate: string; amount: number }[] {
  const periodMonths = FREQUENCY_PERIOD_MONTHS[paymentFrequency ?? ""] ?? 0;
  let count = 1;
  if (periodMonths > 0) {
    const start = new Date(`${startDate}T12:00:00Z`);
    const end = new Date(`${endDate}T12:00:00Z`);
    const termMonths =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
    count = Math.max(1, Math.round(termMonths / periodMonths));
  }
  // Split to 2dp with the rounding remainder on the LAST δόση, so the sum
  // always equals the gross exactly.
  const base = Math.floor((premiumGross / count) * 100) / 100;
  const schedule = [];
  let allocated = 0;
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? Math.round((premiumGross - allocated) * 100) / 100 : base;
    allocated = Math.round((allocated + amount) * 100) / 100;
    schedule.push({
      installmentNumber: i + 1,
      dueDate: i === 0 ? startDate : addMonths(startDate, i * periodMonths),
      amount,
    });
  }
  return schedule;
}
