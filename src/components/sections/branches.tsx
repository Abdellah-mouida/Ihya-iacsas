"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin } from "lucide-react";
import { SectionHeading } from "@/components/common/section-heading";
import type { MapBranch } from "@/components/common/morocco-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const visibleGroups = useMemo(() => MOROCCAN_REGIONS.flatMap((region) => {
    const members = visibleBranches.filter((branch) => branch.regionId === region.id);
    return members.length ? [{ region, branches: members }] : [];
  }), [visibleBranches]);

  return (
    <section id="branches" className="relative z-0 overflow-hidden py-24 sm:py-32">
      <div className="relative z-10 mx-auto max-w-6xl px-5">
        <SectionHeading kicker={t("branches.kicker")} title={t("branches.title")} desc={t("branches.desc")} />

        {branches.length === 0 ? (
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-dashed border-border/60 bg-card/30 p-8 text-center text-muted-foreground">
            <MapPin className="mx-auto mb-3 size-8 text-brass" />
            <p>{t("branches.empty")}</p>
          </div>
        ) : (
          <div className="mt-10 grid items-start gap-8 lg:mt-14 lg:grid-cols-2 lg:gap-12">
            <div className="min-w-0">
              <MoroccoMap branches={mapBranches} activeId={activeId} onActivate={setActiveId} focusRegionId={regionId === "all" ? null : regionId} />
              <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <MapPin className="size-4 shrink-0 text-brass" />{t("branches.mapHint")}
              </p>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2" aria-label={t("branches.regionFilter")}>
                <Button type="button" data-region-id="all" variant={regionId === "all" ? "default" : "outline"} aria-pressed={regionId === "all"} onClick={() => setRegionId("all")} className="h-9 shrink-0 rounded-full px-4">
                  {t("branches.allRegions")} <span className="ms-2 rounded-full bg-background/50 px-2 py-0.5 text-xs">{branches.length}</span>
                </Button>
                {MOROCCAN_REGIONS.filter((region) => regionCounts.has(region.id)).map((region) => (
                  <Button key={region.id} type="button" data-region-id={region.id} variant={regionId === region.id ? "default" : "outline"} aria-pressed={regionId === region.id} onClick={() => setRegionId(region.id)} className="h-9 shrink-0 rounded-full px-4">
                    {region.name[isAr ? "ar" : "en"]}<span className="ms-2 rounded-full bg-background/50 px-2 py-0.5 text-xs">{regionCounts.get(region.id)}</span>
                  </Button>
                ))}
              </div>

              <label className="relative block">
                <span className="sr-only">{t("branches.search")}</span>
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={t("branches.searchPlaceholder")} className="h-11 rounded-xl ps-10" />
              </label>

              {visibleBranches.length ? (
                <div className="space-y-5" aria-label={t("branches.branchList")}>
                  {visibleGroups.map(({ region: groupRegion, branches: groupBranches }) => (
                    <section key={groupRegion.id} aria-labelledby={`branch-region-${groupRegion.id}`} className="space-y-2">
                      <h3 id={`branch-region-${groupRegion.id}`} className="font-heading text-sm font-semibold text-muted-foreground">
                        {groupRegion.name[isAr ? "ar" : "en"]}
                      </h3>
                      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {groupBranches.map((branch) => {
                          const index = visibleBranches.findIndex((item) => item.id === branch.id);
                          const active = activeId === branch.id;
                          return (
                            <li key={branch.id} data-branch-region={branch.regionId}>
                              <button
                                type="button"
                                onMouseEnter={() => setActiveId(branch.id)}
                                onMouseLeave={() => setActiveId(null)}
                                onFocus={() => setActiveId(branch.id)}
                                onBlur={() => setActiveId(null)}
                                onClick={() => setActiveId(active ? null : branch.id)}
                                aria-pressed={active}
                                className={cn(
                                  "glass flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  active ? "glass-strong border-brass/40" : "border-border/60 hover:border-brass/30",
                                )}
                              >
                                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", active ? "bg-brass-gradient text-night" : "bg-[var(--main)]/10 text-[var(--main)]")}>
                                  <MapPin className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-heading text-base font-semibold text-foreground">{isAr ? branch.nameAr : branch.nameEn || branch.nameAr}</span>
                                  <span className="block truncate text-sm text-muted-foreground">{branch.nameEn && (isAr ? branch.nameEn : branch.nameAr)}</span>
                                </span>
                                <span className="ms-auto text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
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
