"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, CalendarDays, RotateCcw, Search } from "lucide-react";

import { getAdminAuditLogs, type GetAdminAuditLogsParams } from "@/app/actions/audit";
import { AuditActivityFeed, type AuditActivityItem } from "@/components/admin/audit-activity-feed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-provider";

type LogFilters = Required<Pick<GetAdminAuditLogsParams, "query" | "action" | "from" | "to">>;

const EMPTY_FILTERS: LogFilters = { query: "", action: "ALL", from: "", to: "" };

export function AdminLogsView() {
  const { t } = useLocale();
  const [filters, setFilters] = useState<LogFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [logs, setLogs] = useState<AuditActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const loadLogs = useCallback(async (nextFilters: LogFilters, nextCursor: string | null = null, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(false);
    try {
      const result = await getAdminAuditLogs({ ...nextFilters, cursor: nextCursor });
      setLogs((current) => append
        ? [...current, ...(result.logs as AuditActivityItem[])]
        : result.logs as AuditActivityItem[]);
      setCursor(result.nextCursor);
    } catch {
      setError(true);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadLogs(EMPTY_FILTERS), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadLogs]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFilters = { ...filters, query: query.trim(), from, to };
    setFilters(nextFilters);
    void loadLogs(nextFilters);
  };

  const clearFilters = () => {
    setQuery("");
    setFrom("");
    setTo("");
    setFilters(EMPTY_FILTERS);
    void loadLogs(EMPTY_FILTERS);
  };

  return (
    <div className="space-y-8 min-w-0" data-testid="admin-logs-page">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-teal-500 text-xs font-semibold uppercase tracking-wider">
            <Activity className="size-4 shrink-0" aria-hidden="true" />
            <span>{t("adminLogs.eyebrow")}</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {t("adminLogs.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("adminLogs.description")}</p>
        </div>
      </header>

      <form
        onSubmit={applyFilters}
        className="glass grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-border/60 p-4 shadow-layered sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(14rem,1.6fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] xl:items-end"
        data-testid="admin-logs-filters"
      >
        <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">
          <span>{t("adminLogs.userSearch")}</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("adminLogs.userSearchPlaceholder")}
              className="h-11 ps-10 text-sm"
              data-testid="admin-logs-user-search"
            />
          </span>
        </label>
        <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">
          <span>{t("adminLogs.from")}</span>
          <span className="relative block">
            <CalendarDays className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-11 ps-10 text-sm" data-testid="admin-logs-from" />
          </span>
        </label>
        <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">
          <span>{t("adminLogs.to")}</span>
          <span className="relative block">
            <CalendarDays className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-11 ps-10 text-sm" data-testid="admin-logs-to" />
          </span>
        </label>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end xl:col-span-1">
          <Button type="submit" className="min-h-11 gap-2 rounded-xl" data-testid="admin-logs-apply">
            <Search className="size-4" aria-hidden="true" />
            {t("adminLogs.apply")}
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters} className="min-h-11 gap-2 rounded-xl" data-testid="admin-logs-clear">
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("adminLogs.clear")}
          </Button>
        </div>
      </form>

      <section className="glass min-h-[32rem] overflow-hidden rounded-2xl border border-border/60 shadow-layered" aria-label={t("adminLogs.results")}>
        <AuditActivityFeed
          logs={logs}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          hasMore={Boolean(cursor)}
          action={filters.action}
          showActor
          emptyLabel={t("adminLogs.empty")}
          errorLabel={t("adminLogs.error")}
          loadingLabel={t("adminLogs.loading")}
          onActionChange={(action) => {
            const nextFilters = { ...filters, action };
            setFilters(nextFilters);
            void loadLogs(nextFilters);
          }}
          onLoadMore={() => void loadLogs(filters, cursor, true)}
          onRetry={() => void loadLogs(filters)}
        />
      </section>
    </div>
  );
}
