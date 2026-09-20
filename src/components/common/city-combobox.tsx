"use client";

import { Check, ChevronsUpDown, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MOROCCAN_CITIES, type MoroccanCity } from "@/lib/moroccan-cities";
import { cn } from "@/lib/utils";

type CityComboboxProps = {
  value: string;
  onChange: (city: string) => void;
  locale?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  hasError?: boolean;
};

export function CityCombobox({
  value,
  onChange,
  locale = "ar",
  placeholder,
  searchPlaceholder,
  noResultsText,
  hasError = false,
}: CityComboboxProps) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
    }
  }, [open]);

  // Find currently selected city
  const selectedCity = useMemo(() => {
    if (!value) return null;
    const norm = value.trim().toLowerCase();
    return (
      MOROCCAN_CITIES.find(
        (c) =>
          c.id === norm ||
          c.nameAr.toLowerCase() === norm ||
          c.nameEn.toLowerCase() === norm,
      ) || null
    );
  }, [value]);

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOROCCAN_CITIES;
    return MOROCCAN_CITIES.filter(
      (c) =>
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [query]);

  const defaultPlaceholder = isAr ? "اختر مدينتك في المغرب..." : "Select your city in Morocco...";
  const defaultSearchPlaceholder = isAr ? "ابحث عن المدينة..." : "Search city...";
  const defaultNoResults = isAr ? "لم يتم العثور على المدينة" : "No city found";

  const displaySelected = selectedCity
    ? isAr
      ? selectedCity.nameAr
      : selectedCity.nameEn
    : value || defaultPlaceholder;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        id="b-city"
        data-testid="city-combobox-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border bg-background/50 px-3.5 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brass/60",
          hasError ? "border-destructive ring-1 ring-destructive" : "border-input hover:border-brass/50",
          selectedCity ? "text-foreground font-medium" : "text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <MapPin className="size-4 shrink-0 text-brass" />
          <span className="truncate">{displaySelected}</span>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>

      {/* Hidden input to keep form validity and data testing clean */}
      <input
        type="hidden"
        name="city"
        value={selectedCity ? (isAr ? selectedCity.nameAr : selectedCity.nameEn) : value}
        data-testid="city-hidden-input"
      />

      {/* Dropdown Menu */}
      {open && (
        <div
          data-testid="city-dropdown"
          className="absolute z-50 mt-1.5 max-h-72 w-full overflow-hidden rounded-2xl border border-border/80 bg-popover/95 p-1.5 shadow-layered backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
        >
          {/* Search box inside dropdown */}
          <div className="relative mb-1 flex items-center border-b border-border/50 px-2.5 pb-2 pt-1">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              data-testid="city-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder || defaultSearchPlaceholder}
              className="w-full bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>

          {/* Listbox of Moroccan Cities */}
          <ul
            role="listbox"
            className="max-h-52 overflow-y-auto py-1 text-sm focus:outline-none"
          >
            {filteredCities.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                {noResultsText || defaultNoResults}
              </li>
            ) : (
              filteredCities.map((city) => {
                const isSelected =
                  selectedCity?.id === city.id ||
                  value === city.nameAr ||
                  value === city.nameEn;

                return (
                  <li
                    key={city.id}
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`city-option-${city.id}`}
                    onClick={() => {
                      const chosenName = isAr ? city.nameAr : city.nameEn;
                      onChange(chosenName);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex cursor-pointer select-none items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:bg-brass/15 hover:text-foreground",
                      isSelected
                        ? "bg-brass/20 font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span>{isAr ? city.nameAr : city.nameEn}</span>
                      <span className="text-xs opacity-50">
                        ({isAr ? city.nameEn : city.nameAr})
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-brass" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}