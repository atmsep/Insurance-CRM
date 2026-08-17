import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type GroupedRow = {
  outer_key: string;
  inner_key: string;
  row_count: number;
  premium_gross_sum: number;
  premium_net_sum: number;
  commission_sum: number;
};

function euro(n: number) {
  return `${n.toFixed(2)} €`;
}

// Flat rendering with a bold outer-group header row (repeated whenever
// outer_key changes — rows already arrive sorted by outer_key, inner_key
// from the RPC) plus a bold grand total row. No real collapse/expand —
// a deliberate v1 simplification (see the plan), not a limitation of the
// data: the RPC always returns every group, so a later collapsible
// version only needs client-side UI state, no data changes.
export function GroupedTable({
  rows,
  outerLabel,
  innerLabel,
}: {
  rows: GroupedRow[];
  outerLabel: string;
  innerLabel: string;
}) {
  const grandTotal = rows.reduce(
    (acc, r) => ({
      row_count: acc.row_count + r.row_count,
      premium_gross_sum: acc.premium_gross_sum + r.premium_gross_sum,
      premium_net_sum: acc.premium_net_sum + r.premium_net_sum,
      commission_sum: acc.commission_sum + r.commission_sum,
    }),
    { row_count: 0, premium_gross_sum: 0, premium_net_sum: 0, commission_sum: 0 },
  );

  let lastOuterKey: string | null = null;

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{outerLabel}</TableHead>
            <TableHead>{innerLabel}</TableHead>
            <TableHead className="text-right">Σύνολα</TableHead>
            <TableHead className="text-right">Μικτά</TableHead>
            <TableHead className="text-right">Καθαρά</TableHead>
            <TableHead className="text-right">Εξ.Προμήθεια</TableHead>
            <TableHead className="text-right">Διαφορά</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, i) => {
              const showOuterHeader = row.outer_key !== lastOuterKey;
              lastOuterKey = row.outer_key;
              const diff = row.premium_gross_sum - row.commission_sum;
              return (
                <Fragment key={`${row.outer_key}-${row.inner_key}-${i}`}>
                  {showOuterHeader && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={7} className="font-semibold">
                        {outerLabel}: {row.outer_key}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell />
                    <TableCell>{row.inner_key}</TableCell>
                    <TableCell className="text-right">{row.row_count}</TableCell>
                    <TableCell className="text-right">{euro(row.premium_gross_sum)}</TableCell>
                    <TableCell className="text-right">{euro(row.premium_net_sum)}</TableCell>
                    <TableCell className="text-right">{euro(row.commission_sum)}</TableCell>
                    <TableCell className="text-right">{euro(diff)}</TableCell>
                  </TableRow>
                </Fragment>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Δεν βρέθηκαν δεδομένα.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {rows.length ? (
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell colSpan={2}>Σύνολο</TableCell>
              <TableCell className="text-right">{grandTotal.row_count}</TableCell>
              <TableCell className="text-right">{euro(grandTotal.premium_gross_sum)}</TableCell>
              <TableCell className="text-right">{euro(grandTotal.premium_net_sum)}</TableCell>
              <TableCell className="text-right">{euro(grandTotal.commission_sum)}</TableCell>
              <TableCell className="text-right">
                {euro(grandTotal.premium_gross_sum - grandTotal.commission_sum)}
              </TableCell>
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
