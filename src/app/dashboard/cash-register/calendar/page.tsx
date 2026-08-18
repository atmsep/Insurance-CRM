import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { WEEKDAY_LABELS, MONTH_LABELS, pad } from "@/lib/calendar-labels";

export default async function CashRegisterCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; agent_id?: string }>;
}) {
  const { month, agent_id } = await searchParams;
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  const scopeAgentId = isAdmin ? agent_id || null : agencyUser.id;

  const today = new Date();
  const [year, monthIndex] = month
    ? month.split("-").map(Number)
    : [today.getFullYear(), today.getMonth() + 1];

  const firstOfMonth = new Date(year, monthIndex - 1, 1);
  const lastOfMonth = new Date(year, monthIndex, 0);
  const daysInMonth = lastOfMonth.getDate();
  // getDay(): 0=Sunday..6=Saturday. Convert to Monday-first index 0..6.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const rangeStart = `${year}-${pad(monthIndex)}-01`;
  const rangeEnd = `${year}-${pad(monthIndex)}-${pad(daysInMonth)}`;

  const admin = createAdminClient();
  let dayQuery = admin
    .from("installment_payments")
    .select("paid_date, amount")
    .gte("paid_date", rangeStart)
    .lte("paid_date", rangeEnd)
    .eq("is_reversed", false);
  if (scopeAgentId) dayQuery = dayQuery.eq("paid_by", scopeAgentId);

  const [{ data: rows }, { data: agents }] = await Promise.all([
    dayQuery,
    isAdmin
      ? admin.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  const summaryByDay = new Map<number, { total: number; count: number }>();
  for (const row of rows ?? []) {
    const day = Number(row.paid_date.slice(8, 10));
    const entry = summaryByDay.get(day) ?? { total: 0, count: 0 };
    entry.total += row.amount;
    entry.count += 1;
    summaryByDay.set(day, entry);
  }

  const prevMonth = new Date(year, monthIndex - 2, 1);
  const nextMonth = new Date(year, monthIndex, 1);
  const agentQS = scopeAgentId && isAdmin ? `&agent_id=${scopeAgentId}` : "";
  const prevHref = `/dashboard/cash-register/calendar?month=${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}${agentQS}`;
  const nextHref = `/dashboard/cash-register/calendar?month=${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}${agentQS}`;

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = year === today.getFullYear() && monthIndex === today.getMonth() + 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Ταμείο — {MONTH_LABELS[monthIndex - 1]} {year}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={prevHref}>←</Link>} />
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/cash-register">Λίστα</Link>} />
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={nextHref}>→</Link>} />
        </div>
      </div>

      {isAdmin && (
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="month" value={`${year}-${pad(monthIndex)}`} />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="agent_id">
              Συνεργάτης
            </label>
            <select
              id="agent_id"
              name="agent_id"
              defaultValue={agent_id ?? ""}
              className="h-8 rounded-md border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Όλοι</option>
              {(agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Εφαρμογή
          </Button>
        </form>
      )}

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted px-2 py-1.5 text-center font-medium">
            {label}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="min-h-20 bg-muted/30 p-1.5" />;
          const summary = summaryByDay.get(day);
          const isToday = isCurrentMonth && day === today.getDate();
          const date = `${year}-${pad(monthIndex)}-${pad(day)}`;
          return (
            <Link
              key={idx}
              href={`/dashboard/cash-register?date=${date}${agentQS}`}
              className="flex min-h-20 flex-col gap-1 bg-background p-1.5 hover:bg-muted/50"
            >
              <p className={`text-right ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>{day}</p>
              {summary && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold">{summary.total.toFixed(2)} €</p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    {summary.count} {summary.count === 1 ? "είσπραξη" : "εισπράξεις"}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
