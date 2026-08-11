import * as React from "react";
import { cn } from "@/lib/utils";

export interface ResponsiveTableColumn<TRow> {
  key: string;
  header: string;
  cell: (row: TRow) => React.ReactNode;
}

export interface ResponsiveTableCardField<TRow> {
  label: string;
  value: (row: TRow) => React.ReactNode;
}

export interface ResponsiveTableProps<TRow> {
  rows: TRow[];
  rowKey: (row: TRow) => string;
  columns: ResponsiveTableColumn<TRow>[];
  card: {
    title: (row: TRow) => React.ReactNode;
    badge?: (row: TRow) => React.ReactNode;
    fields: ResponsiveTableCardField<TRow>[];
    actions?: (row: TRow) => React.ReactNode;
  };
  /** Body-cell padding; default matches the ops tables ("py-3"). */
  tdClassName?: string;
  /** Extra classes for body rows (e.g. "hover:bg-secondary/30"). */
  rowClassName?: string;
}

export function ResponsiveTable<TRow>({
  rows,
  rowKey,
  columns,
  card,
  tdClassName = "py-3",
  rowClassName,
}: ResponsiveTableProps<TRow>) {
  const lastCol = columns.length - 1;

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  className={cn("pb-2 font-medium", i < lastCol && "pr-4")}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn("border-b border-border/70 last:border-0", rowClassName)}
              >
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={cn(tdClassName, i < lastCol && "pr-4")}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div data-testid="responsive-table-cards" className="space-y-3 md:hidden">
        {rows.map((row) => {
          const badge = card.badge?.(row);
          return (
            <div
              key={rowKey(row)}
              className="rounded-lg border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-sm font-medium">
                  {card.title(row)}
                </div>
                {badge}
              </div>
              {card.fields.length > 0 && (
                <dl className="mt-3 space-y-1.5">
                  {card.fields.map((field) => (
                    <div
                      key={field.label}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <dt className="shrink-0 text-xs text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="text-right">{field.value(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {card.actions && (
                <div className="mt-3 grid gap-2">{card.actions(row)}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
