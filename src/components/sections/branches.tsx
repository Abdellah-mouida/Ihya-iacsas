"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin } from "lucide-react";
import { SectionHeading } from "@/components/common/section-heading";
import type { MapBranch } from "@/components/common/morocco-map";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocale } from "@/i18n/locale-provider";
import { MOROCCAN_PROVINCES, MOROCCAN_REGIONS, normalizeMoroccanCityValue } from "@/data/morocco";
import type { PublicBranch } from "@/lib/branches/types";
import { cn } from "@/lib/utils";

function MapSkeleton() {
  return <div className="mx-auto aspect-[1000/1065] w-full max-w-[26rem] animate-pulse rounded-3xl bg-muted/40 motion-reduce:animate-none" aria-hidden="true" />;
}

const MoroccoMap = dynamic(
  () => import("@/components/common/morocco-map").then((module) => module.MoroccoMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

export function Branches({ branches }: { branches: PublicBranch[] }) {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [regionId, setRegionId] = useState("all");

  const regionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const branch of branches) counts.set(branch.regionId, (counts.get(branch.regionId) ?? 0) + 1);
    return counts;
  }, [branches]);

  const visibleBranches = useMemo(() => {
    const query = normalizeMoroccanCityValue(searchText);
    return branches.filter((branch) => {
      if (regionId !== "all" && branch.regionId !== regionId) return false;
      const region = MOROCCAN_REGIONS.find((item) => item.id === branch.regionId);
      const regionName = region ? region.name[isAr ? "ar" : "en"] : branch.regionId;
      const province = branch.provinceId ? MOROCCAN_PROVINCES.find((item) => item.id === branch.provinceId) : null;
      const provinceName = province ? province.name[isAr ? "ar" : "en"] : branch.provinceId ?? "";
      const name = isAr ? branch.nameAr : branch.nameEn || branch.nameAr;
      return !query || normalizeMoroccanCityValue(`${name} ${branch.nameAr} ${branch.nameEn ?? ""} ${regionName} ${provinceName}`).includes(query);
    });
  }, [branches, isAr, regionId, searchText]);

  const mapBranches: MapBranch[] = useMemo(() => visibleBranches.map((branch) => {
    const region = MOROCCAN_REGIONS.find((item) => item.id === branch.regionId);
    return {
      ...branch,
      name: isAr ? branch.nameAr : branch.nameEn || branch.nameAr,
      regionName: region ? region.name[isAr ? "ar" : "en"] : branch.regionId,
    };
  }), [isAr, visibleBranches]);



  return (
    <section id="branches" className="relative z-0 overflow-visible py-24 sm:py-32">
      <div className="relative z-10 mx-auto max-w-6xl px-5">
        <SectionHeading kicker={t("branches.kicker")} title={t("branches.title")} desc={t("branches.desc")} />

        {branches.length === 0 ? (
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-dashed border-border/60 bg-card/30 p-8 text-center text-muted-foreground">
            <MapPin className="mx-auto mb-3 size-8 text-brass" />
            <p>{t("branches.empty")}</p>
          </div>
        ) : (
          <div className="mt-10 space-y-8 lg:mt-14 lg:space-y-10">
            <div className="mx-auto w-full max-w-[26rem] min-w-0">
              <MoroccoMap branches={mapBranches} activeId={activeId} onActivate={setActiveId} focusRegionId={regionId === "all" ? null : regionId} />
              <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <MapPin className="size-4 shrink-0 text-brass" />{t("branches.mapHint")}
              </p>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <Select value={regionId} onValueChange={(value) => { setRegionId(value); setActiveId(null); }}>
                  <SelectTrigger aria-label={t("branches.regionFilter")} data-testid="branch-region-filter" className="h-10 min-w-0 rounded-xl bg-card/60">
                    <SelectValue placeholder={t("branches.regionFilter")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("branches.allRegions")} ({branches.length})</SelectItem>
                    {MOROCCAN_REGIONS.filter((region) => regionCounts.has(region.id)).map((region) => (
                      <SelectItem key={region.id} value={region.id} data-region-id={region.id}>
                        {region.name[isAr ? "ar" : "en"]} ({regionCounts.get(region.id)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label className="relative block min-w-0">
                  <span className="sr-only">{t("branches.search")}</span>
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={searchText} onChange={(event) => { setSearchText(event.target.value); setActiveId(null); }} placeholder={t("branches.searchPlaceholder")} className="h-10 min-w-0 rounded-xl ps-10" />
                </label>
              </div>

              {visibleBranches.length ? (
                <ul className="flex flex-wrap items-center gap-2" aria-label={t("branches.branchList")} data-testid="branches-list">
                  {visibleBranches.map((branch) => {
                    const active = activeId === branch.id;
                    const currentName = isAr ? branch.nameAr : branch.nameEn || branch.nameAr;
                    return (
                      <li key={branch.id} data-branch-region={branch.regionId} data-testid="branch-inline-item" className="min-w-0 max-w-full">
                        <button
                          type="button"
                          onMouseEnter={() => setActiveId(branch.id)}
                          onMouseLeave={() => setActiveId(null)}
                          onFocus={() => setActiveId(branch.id)}
                          onBlur={() => setActiveId(null)}
                          onClick={() => setActiveId(active ? null : branch.id)}
                          aria-pressed={active}
                          className={cn(
                            "glass inline-flex min-h-9 max-w-full flex-wrap items-center rounded-xl border px-3 py-1.5 text-start transition-[background-color,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "glass-strong border-brass/40" : "border-border/60 hover:border-brass/30",
                          )}
                        >
                          <span data-testid="branch-chip-name" className="whitespace-nowrap font-heading text-sm font-semibold text-foreground"><bdi>{currentName}</bdi></span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">{t("branches.noResults")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
