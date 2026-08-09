import Link from "next/link";
import { Fragment } from "react";

export type Breadcrumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  if (items.length < 2) return null;

  return (
    <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
