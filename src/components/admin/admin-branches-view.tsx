"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
import { MoroccoMap } from "@/components/common/morocco-map";
import { MOROCCAN_CITIES, MOROCCAN_REGIONS, normalizeMoroccanCityValue } from "@/data/morocco";
import { createBranch, deleteBranch, getAdminBranches, setBranchActive, updateBranch } from "@/app/actions/branches";
import { parseBranchInput } from "@/lib/branches/validation";
import { confidenceLevel, inferRegionFromCoordinate, type RegionInference } from "@/lib/branches/region-inference";
import type { PublicBranch } from "@/lib/branches/types";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";

const blankDraft = () => ({
  kind: "CITY" as "CITY" | "CUSTOM",
  geoId: "",
  nameAr: "",
  nameEn: "",
  regionId: MOROCCAN_CITIES[0].regionId,
  provinceId: "",
  latitude: MOROCCAN_CITIES[0].latitude,
  longitude: MOROCCAN_CITIES[0].longitude,
  active: true,
  sortOrder: 0,
});

type BranchDraft = ReturnType<typeof blankDraft>;
type BranchRow = PublicBranch & { active: boolean; sortOrder: number; createdAt: Date };

function localizedName(branch: Pick<PublicBranch, "nameAr" | "nameEn">, locale: string) {
  return locale === "ar" ? branch.nameAr : branch.nameEn || branch.nameAr;
}

export function AdminBranchesView({ focusBranchId }: { focusBranchId?: string }) {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [regionId, setRegionId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BranchDraft>(blankDraft);
  const [cityQuery, setCityQuery] = useState("");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coordinatesConfirmed, setCoordinatesConfirmed] = useState(true);
  const [customRegionSelected, setCustomRegionSelected] = useState(false);
  const [regionInference, setRegionInference] = useState<RegionInference | null>(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<{
    id: string;
    type: "name" | "geoId" | "distance";
    nameAr: string;
    nameEn: string | null;
    distanceKm?: number;
  } | null>(null);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const filteredCities = useMemo(() => {
    const query = normalizeMoroccanCityValue(cityQuery);
    if (!query) return MOROCCAN_CITIES.slice(0, 12);
    return MOROCCAN_CITIES.filter((city) =>
      [city.id, city.nameAr, city.nameEn, city.nameFr].some((value) => normalizeMoroccanCityValue(value).includes(query)),
    ).slice(0, 15);
  }, [cityQuery]);

  const regionName = (id: string) => {
    const region = MOROCCAN_REGIONS.find((item) => item.id === id);
    return region ? region.name[isAr ? "ar" : "en"] : id;
  };
  const loadBranches = async (nextPage = page) => {
    setLoading(true);
    const result = await getAdminBranches({ search, regionId, page: nextPage });
    if (result.success && "branches" in result) {
      setBranches(result.branches as BranchRow[]);
      setTotal(result.total ?? 0);
      setPageCount(result.pageCount ?? 0);
      setPage(nextPage);
    } else {
      notify.error(t("adminBranches.loadError"));
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    getAdminBranches(focusBranchId ? { branchId: focusBranchId } : { search, regionId, page }).then((result) => {
      if (!active) return;
      if (result.success && "branches" in result) {
        setBranches(result.branches as BranchRow[]);
        setTotal(result.total ?? 0);
        setPageCount(result.pageCount ?? 0);
        if (focusBranchId) {
          requestAnimationFrame(() => document.getElementById(`branch-${focusBranchId}`)?.scrollIntoView({ block: "center" }));
        }
      } else {
        notify.error(t("adminBranches.loadError"));
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [search, regionId, page, t, focusBranchId]);

  const chooseCity = (id: string) => {
    const city = MOROCCAN_CITIES.find((item) => item.id === id);
    if (!city) return;
    setDraft((value) => ({
      ...value,
      kind: "CITY",
      geoId: city.id,
      nameAr: city.nameAr,
      nameEn: city.nameEn,
      regionId: city.regionId,
      provinceId: "",
      latitude: city.latitude,
      longitude: city.longitude,
    }));
    setRegionInference(null);
    setCityQuery((isAr ? city.nameAr : city.nameEn));
    setCityPickerOpen(false);
  };

  const openNew = () => {
    const initial = blankDraft();
    setDraft(initial);
    setCityQuery(isAr ? initial.nameAr : initial.nameEn);
    setEditingId(null);
    setError("");
    setConflict(null);
    idempotencyRef.current = null;
    setCoordinatesConfirmed(true);
    setCustomRegionSelected(false);
    setRegionInference(null);
    setEditorOpen(true);
  };

  const openEdit = (branch: BranchRow) => {
    setDraft({
      kind: branch.kind === "CITY" ? "CITY" : "CUSTOM",
      geoId: branch.kind === "CITY" ? branch.geoId ?? "" : "",
      nameAr: branch.nameAr,
      nameEn: branch.nameEn ?? "",
      regionId: branch.regionId,
      provinceId: "",
      latitude: branch.latitude,
      longitude: branch.longitude,
      active: branch.active,
      sortOrder: branch.sortOrder,
    });
    const city = branch.kind === "CITY" && branch.geoId ? MOROCCAN_CITIES.find((item) => item.id === branch.geoId) : null;
    setCityQuery(city ? (isAr ? city.nameAr : city.nameEn) : "");
    setEditingId(branch.id);
    setCoordinatesConfirmed(true);
    setCustomRegionSelected(branch.kind !== "CITY");
    setRegionInference(inferRegionFromCoordinate(branch.latitude, branch.longitude));
    setError("");
    setConflict(null);
    setEditorOpen(true);
  };

  const setMode = (kind: BranchDraft["kind"]) => {
    setError("");
    if (kind === "CITY") {
      const current = draft.geoId && MOROCCAN_CITIES.some((city) => city.id === draft.geoId)
        ? draft.geoId
        : MOROCCAN_CITIES[0].id;
      chooseCity(current);
    } else {
      const inference = inferRegionFromCoordinate(draft.latitude, draft.longitude);
      setRegionInference(inference);
      setDraft((value) => ({ ...value, kind, geoId: "", provinceId: "", regionId: inference?.regionId ?? value.regionId }));
      setCustomRegionSelected(false);
      setCoordinatesConfirmed(false);
    }
  };

  const updateCoordinates = (latitude: number, longitude: number, confirmPin = false) => {
    const inference = inferRegionFromCoordinate(latitude, longitude);
    setRegionInference(inference);
    if (confirmPin) setCoordinatesConfirmed(true);
    setDraft((value) => {
      let regionId = value.regionId;
      if (value.kind === "CUSTOM" && !customRegionSelected && inference) {
        regionId = inference.regionId;
      }
      return { ...value, latitude, longitude, regionId };
    });
  };

  const setMapPin = (latitude: number, longitude: number) => updateCoordinates(latitude, longitude, true);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!coordinatesConfirmed) {
      setError(t("adminBranches.pinRequired"));
      return;
    }
    const parsed = parseBranchInput({ ...draft, id: editingId ?? undefined });
    if (!parsed.success) {
      setError(t("adminBranches.validationError"));
      return;
    }
    setSaving(true);
    setError("");
    setConflict(null);
    let result;
    if (editingId) {
      result = await updateBranch(editingId, parsed.data);
    } else {
      const fingerprint = JSON.stringify(parsed.data);
      const idempotencyKey = idempotencyRef.current?.fingerprint === fingerprint
        ? idempotencyRef.current.key
        : crypto.randomUUID();
      idempotencyRef.current = { fingerprint, key: idempotencyKey };
      result = await createBranch({ ...parsed.data, idempotencyKey });
    }
    setSaving(false);
    if (!result.success) {
      if ("conflict" in result && result.conflict) {
        setConflict(result.conflict);
        const name = localizedName(result.conflict, locale);
        if (result.conflict.type === "name") setError(t("adminBranches.duplicateName", { name }));
        else if (result.conflict.type === "geoId") setError(t("adminBranches.duplicatePlace", { name }));
        else setError(t("adminBranches.tooClose", { name, distance: (result.conflict.distanceKm ?? 0).toFixed(1) }));
        return;
      }
      setError(t("adminBranches.saveError"));
      return;
    }
    notify.success(t(editingId ? "adminBranches.updated" : "adminBranches.created"));
    setEditorOpen(false);
    await loadBranches(page);
  };

  const toggleActive = async (branch: BranchRow) => {
    const result = await setBranchActive(branch.id, !branch.active);
    if (!result.success) {
      notify.error(t("adminBranches.saveError"));
      return;
    }
    notify.success(t("adminBranches.updated"));
    await loadBranches(page);
  };

  const removeBranch = async (branch: BranchRow) => {
    const ok = await confirm({
      title: t("adminBranches.deleteTitle"),
      description: t("adminBranches.deleteDescription"),
      confirmText: t("adminBranches.delete"),
      cancelText: t("adminBranches.cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    const result = await deleteBranch(branch.id);
    if (!result.success) {
      notify.error(t("adminBranches.deleteError"));
      return;
    }
    notify.success(t("adminBranches.deleted"));
    await loadBranches(Math.min(page, Math.max(1, pageCount - (branches.length === 1 ? 1 : 0))));
  };

  return (
    <div className="min-w-0 space-y-8" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brass">
            <MapPin className="size-4 shrink-0" />
            <span>{t("adminBranches.eyebrow")}</span>
          </div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{t("adminBranches.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("adminBranches.description")}</p>
        </div>
        <Button onClick={openNew} className="h-10 shrink-0 rounded-xl bg-brass-gradient px-5 font-semibold text-night shadow-layered">
          <Plus className="me-2 size-4" />{t("adminBranches.add")}
        </Button>
      </div>

      <form
        className="glass flex flex-col gap-3 rounded-2xl border border-border/60 p-4 shadow-layered sm:flex-row sm:items-center"
        onSubmit={(event) => { event.preventDefault(); setLoading(true); setPage(1); setSearch(searchText.trim()); }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("adminBranches.search")}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={t("adminBranches.searchPlaceholder")} className="h-10 rounded-xl ps-10" />
        </label>
        <label className="w-full sm:w-64">
          <span className="sr-only">{t("adminBranches.regionFilter")}</span>
          <Select value={regionId} onValueChange={(value) => { setLoading(true); setPage(1); setRegionId(value); }}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={t("adminBranches.regionFilter")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminBranches.allRegions")}</SelectItem>
              {MOROCCAN_REGIONS.map((region) => <SelectItem key={region.id} value={region.id}>{region.name[isAr ? "ar" : "en"]}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <Button type="submit" variant="outline" className="h-10 rounded-xl px-4">{t("adminBranches.search")}</Button>
      </form>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{t("adminBranches.count", { count: total })}</span>
        {loading && <LoaderCircle className="size-4 animate-spin" aria-label={t("adminBranches.loading")} />}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">{Array.from({ length: 4 }, (_, index) => <div key={index} className="glass h-24 animate-pulse rounded-2xl" />)}</div>
      ) : branches.length === 0 ? (
        <div className="glass rounded-2xl border border-border/60 px-5 py-12 text-center shadow-layered">
          <MapPin className="mx-auto mb-3 size-10 text-brass" />
          <h2 className="font-heading text-lg font-bold text-foreground">{t("adminBranches.emptyTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("adminBranches.emptyDescription")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => (
            <article key={branch.id} id={`branch-${branch.id}`} data-branch-id={branch.id} className="glass flex min-w-0 flex-col gap-4 rounded-2xl border border-border/60 p-4 shadow-layered sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <h2 className="truncate font-heading text-lg font-bold text-foreground">{localizedName(branch, locale)}</h2>
                {branch.nameEn && <p className="truncate text-sm text-muted-foreground" dir={locale === "ar" ? "ltr" : "rtl"}>{locale === "ar" ? branch.nameEn : branch.nameAr}</p>}
                <p className="mt-1 text-sm text-muted-foreground">{regionName(branch.regionId)}</p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{branch.latitude.toFixed(5)}, {branch.longitude.toFixed(5)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Button type="button" variant="outline" onClick={() => void toggleActive(branch)} className={cn("h-9 rounded-xl px-3", branch.active ? "text-primary" : "text-muted-foreground")}>
                  {branch.active ? t("adminBranches.active") : t("adminBranches.hidden")}
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label={t("adminBranches.edit")} onClick={() => openEdit(branch)} className="size-9 rounded-xl"><Pencil className="size-4" /></Button>
                <Button type="button" variant="outline" size="icon" aria-label={t("adminBranches.delete")} onClick={() => void removeBranch(branch)} className="size-9 rounded-xl text-destructive"><Trash2 className="size-4" /></Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-4" aria-label={t("adminBranches.pagination")}>
          <Button type="button" variant="outline" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => Math.max(1, value - 1)); }} className="h-10 rounded-xl">
            {isAr ? <ChevronRight className="me-1 size-4" /> : <ChevronLeft className="me-1 size-4" />}{t("adminBranches.previous")}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">{t("adminBranches.page", { page, total: pageCount })}</span>
          <Button type="button" variant="outline" disabled={page >= pageCount || loading} onClick={() => { setLoading(true); setPage((value) => Math.min(pageCount, value + 1)); }} className="h-10 rounded-xl">
            {t("adminBranches.next")}{isAr ? <ChevronLeft className="ms-1 size-4" /> : <ChevronRight className="ms-1 size-4" />}
          </Button>
        </nav>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent fullScreenMobile showCloseButton className="h-dvh max-h-dvh max-w-none overflow-y-auto rounded-none p-0 sm:h-[min(92dvh,900px)] sm:max-w-6xl sm:rounded-2xl">
          <DialogHeader className="border-b border-border/60 p-5 pe-14 text-start sm:p-6">
            <DialogTitle className="font-heading text-xl font-bold">{t(editingId ? "adminBranches.editTitle" : "adminBranches.createTitle")}</DialogTitle>
            <DialogDescription>{t("adminBranches.editorDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("adminBranches.placeMode")}>
                  {(["CITY", "CUSTOM"] as const).map((kind) => (
                    <Button key={kind} type="button" variant={draft.kind === kind ? "default" : "outline"} onClick={() => setMode(kind)} className="h-10 flex-1 rounded-xl px-3">
                      {t(kind === "CITY" ? "adminBranches.city" : "adminBranches.custom")}
                    </Button>
                  ))}
                </div>

                {draft.kind === "CITY" && (
                  <div className="relative space-y-1.5">
                    <label htmlFor="branch-city-search" className="text-sm font-medium">{t("adminBranches.city")}</label>
                    <Input id="branch-city-search" value={cityQuery} onFocus={() => setCityPickerOpen(true)} onChange={(event) => { setCityQuery(event.target.value); setCityPickerOpen(true); }} autoComplete="off" className="h-11 rounded-xl" placeholder={t("adminBranches.citySearch")} />
                    {cityPickerOpen && (
                      <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-popover shadow-xl">
                        {filteredCities.map((city) => (
                          <button key={city.id} type="button" onClick={() => chooseCity(city.id)} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-start text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span>{(isAr ? city.nameAr : city.nameEn)}</span>
                            {draft.geoId === city.id && <Check className="size-4 text-primary" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {draft.kind === "CUSTOM" && (
                  <>
                    <label className="block space-y-1.5 text-sm font-medium">{t("adminBranches.region")}
                      <select value={draft.regionId} onChange={(event) => { setCustomRegionSelected(true); setDraft((value) => ({ ...value, regionId: event.target.value })); }} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {MOROCCAN_REGIONS.map((region) => <option key={region.id} value={region.id}>{region.name[isAr ? "ar" : "en"]}</option>)}
                      </select>
                    </label>
                    <p role="status" className="text-xs leading-relaxed text-muted-foreground">
                      {regionInference
                        ? t("adminBranches.regionSuggestion", {
                            region: regionName(regionInference.regionId),
                            confidence: t(`adminBranches.confidence.${confidenceLevel(regionInference.confidence)}`),
                          })
                        : t("adminBranches.regionSuggestionUnavailable")}
                    </p>
                    <label className="block space-y-1.5 text-sm font-medium">{t("adminBranches.nameAr")}<Input required minLength={2} maxLength={80} value={draft.nameAr} onChange={(event) => setDraft((value) => ({ ...value, nameAr: event.target.value }))} dir="rtl" className="h-11 rounded-xl" /></label>
                    <label className="block space-y-1.5 text-sm font-medium">{t("adminBranches.nameEn")}<Input maxLength={80} value={draft.nameEn} onChange={(event) => setDraft((value) => ({ ...value, nameEn: event.target.value }))} dir="ltr" className="h-11 rounded-xl" /></label>
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5 text-sm font-medium">{t("adminBranches.latitude")}<Input type="number" step="any" value={draft.latitude} onChange={(event) => updateCoordinates(Number(event.target.value), draft.longitude)} className="h-11 rounded-xl" dir="ltr" /></label>
                  <label className="block space-y-1.5 text-sm font-medium">{t("adminBranches.longitude")}<Input type="number" step="any" value={draft.longitude} onChange={(event) => updateCoordinates(draft.latitude, Number(event.target.value))} className="h-11 rounded-xl" dir="ltr" /></label>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{draft.kind === "CITY" ? t("adminBranches.cityCoordinatesHint") : t("adminBranches.mapHint")}{!coordinatesConfirmed && <span className="ms-1 text-destructive">{t("adminBranches.pinRequired")}</span>}</p>
              </div>
              <div className="min-h-72 rounded-2xl border border-border/60 bg-background/40 p-3 sm:min-h-[26rem]">
                <MoroccoMap editor editorInteractive={draft.kind === "CUSTOM"} pin={{ latitude: draft.latitude, longitude: draft.longitude }} onPinChange={setMapPin} />
              </div>
            </div>
            {error && <p role="alert" className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 text-sm text-destructive sm:px-6">{error}{conflict && <Link className="font-semibold underline underline-offset-2" href={`/admin/branches?branch=${encodeURIComponent(conflict.id)}#branch-${encodeURIComponent(conflict.id)}`}>{t("adminBranches.openExisting")}</Link>}</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-border/60 p-4 sm:flex-row sm:justify-end sm:p-5">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={saving} className="h-11 rounded-xl sm:min-w-28">{t("adminBranches.cancel")}</Button>
              <Button type="submit" disabled={saving} className="h-11 rounded-xl bg-brass-gradient px-6 font-semibold text-night sm:min-w-36">{saving ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <Check className="me-2 size-4" />}{t("adminBranches.save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </div>
  );
}
