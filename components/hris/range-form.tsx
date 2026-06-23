import { manilaBusinessDay } from "@/lib/date";

/**
 * Resolve a [from, to] date range from query params, defaulting to the current
 * month-to-date. Shared by the late, timesheet and payroll reports.
 */
export function defaultRange(sp: { from?: string; to?: string }): {
  from: string;
  to: string;
} {
  const today = manilaBusinessDay();
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  return { from: sp.from ?? firstOfMonth, to: sp.to ?? today };
}

/** A server-rendered GET form with from/to date inputs. */
export function HrRangeForm({ from, to }: { from: string; to: string }) {
  return (
    <form className="flex flex-wrap items-end gap-3" method="get">
      <div className="grid gap-1.5">
        <label className="text-xs text-muted-foreground">From</label>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs text-muted-foreground">To</label>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        />
      </div>
      <button
        type="submit"
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Apply
      </button>
    </form>
  );
}
