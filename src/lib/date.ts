// UTC instant where the given Athens calendar day begins — for windowing
// timestamptz columns by "ημέρα" the way the office experiences it, instead
// of UTC midnight (which shifts the first 2-3 ώρες of every day into the
// previous one). Tries both possible offsets (EET/EEST) and keeps the one
// that actually lands on Athens midnight.
export function athensDayStartUtc(dateStr: string): string {
  for (const offset of ["+03:00", "+02:00"] as const) {
    const candidate = new Date(`${dateStr}T00:00:00${offset}`);
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Athens",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(candidate);
    if (hour === "00") return candidate.toISOString();
  }
  return new Date(`${dateStr}T00:00:00+02:00`).toISOString();
}

export function athensNextDayStartUtc(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return athensDayStartUtc(d.toISOString().slice(0, 10));
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  });
}
