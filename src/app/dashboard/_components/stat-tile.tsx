import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export function StatTile({
  label,
  value,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "critical";
  href?: string;
}) {
  const toneClass =
    tone === "critical"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";

  const content = (
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="transition-colors hover:bg-muted/50">{content}</Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}
