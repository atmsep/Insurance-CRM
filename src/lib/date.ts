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
