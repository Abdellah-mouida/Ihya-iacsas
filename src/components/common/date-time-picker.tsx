"use client";

import * as React from "react";
import { format } from "date-fns";
import { arMA, enUS } from "react-day-picker/locale";
import { Calendar as CalendarIcon, Clock, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface DateTimePickerProps {
  initialDate?: string | Date | null;
  initialTime?: string | null;
  dateName?: string;
  timeName?: string;
  required?: boolean;
  locale?: string;
  className?: string;
}

function parseInitialDate(input?: string | Date | null): Date | undefined {
  if (!input) return undefined;
  if (input instanceof Date) return isNaN(input.getTime()) ? undefined : input;
  const match = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
    return isNaN(date.getTime()) ? undefined : date;
  }
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDateString(date?: Date): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const COMMON_TIME_PRESETS = [
  { time: "10:00", labelAr: "10:00 صباحاً", labelEn: "10:00 AM" },
  { time: "15:00", labelAr: "03:00 عصراً", labelEn: "03:00 PM" },
  { time: "18:00", labelAr: "06:00 مساءً", labelEn: "06:00 PM" },
  { time: "18:00 - 21:00", labelAr: "06:00 - 09:00 م", labelEn: "6:00 - 9:00 PM" },
  { time: "20:00", labelAr: "08:00 مساءً", labelEn: "08:00 PM" },
  { time: "21:30", labelAr: "09:30 بعد العشاء", labelEn: "09:30 PM" },
];

export function DateTimePicker({
  initialDate,
  initialTime = "18:00",
  dateName = "date",
  timeName = "time",
  required = true,
  locale = "ar",
  className,
}: DateTimePickerProps) {
  const isAr = locale !== "en";
  const [date, setDate] = React.useState<Date | undefined>(() =>
    parseInitialDate(initialDate)
  );
  const [time, setTime] = React.useState<string>(initialTime || "18:00");
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const formattedDateValue = formatDateString(date);

  const displayDateText = React.useMemo(() => {
    if (!date) {
      return isAr ? "اختر تاريخ الفعالية" : "Select event date";
    }
    try {
      return new Intl.DateTimeFormat(isAr ? "ar-MA" : "en-US", {
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Africa/Casablanca",
      }).format(date);
    } catch {
      return format(date, "PPP");
    }
  }, [date, isAr]);

  const setDatePreset = (daysAhead: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    setDate(target);
  };

  const calendarContent = (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex items-center gap-1.5 px-2 pt-1 border-b border-border/50 pb-2">
        <Sparkles className="size-3.5 text-brass" />
        <span className="text-xs font-semibold text-muted-foreground font-heading">
          {isAr ? "اختيارات سريعة:" : "Quick select:"}
        </span>
        <button
          type="button"
          onClick={() => setDatePreset(0)}
          className="text-xs px-2 py-0.5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors text-foreground font-medium"
        >
          {isAr ? "اليوم" : "Today"}
        </button>
        <button
          type="button"
          onClick={() => setDatePreset(1)}
          className="text-xs px-2 py-0.5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors text-foreground font-medium"
        >
          {isAr ? "غداً" : "Tomorrow"}
        </button>
        <button
          type="button"
          onClick={() => {
            const nextFri = new Date();
            const daysToFri = (5 - nextFri.getDay() + 7) % 7 || 7;
            nextFri.setDate(nextFri.getDate() + daysToFri);
            setDate(nextFri);
          }}
          className="text-xs px-2 py-0.5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors text-foreground font-medium"
        >
          {isAr ? "الجمعة القادمة" : "Next Friday"}
        </button>
      </div>
      <Calendar
        mode="single"
        selected={date}
        onSelect={(d) => d && setDate(d)}
        locale={isAr ? arMA : enUS}
        dir={isAr ? "rtl" : "ltr"}
        className="rounded-xl border border-border/40 shadow-xs"
      />
    </div>
  );

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", className)}>
      {/* Hidden form inputs for Server Action FormData submission */}
      <input
        type="hidden"
        name={dateName}
        value={formattedDateValue}
        required={required}
      />
      <input
        type="hidden"
        name={timeName}
        value={time}
        required={required}
      />

      {/* Date Picker Button & Popover/Sheet */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <CalendarIcon className="size-3.5 text-primary" />
          <span>{isAr ? "تاريخ الفعالية" : "Event Date"}</span>
          {required && <span className="text-destructive">*</span>}
        </label>

        {isMobile ? (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                data-testid="date-picker-trigger"
                className={cn(
                  "w-full h-11 justify-start text-start font-normal rounded-xl border-border/80 bg-background/50 hover:bg-muted/50 px-3",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground me-2" />
                <span className="truncate">{displayDateText}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl pt-6 pb-8">
              <SheetHeader className="mb-3 text-start">
                <SheetTitle className="font-heading text-lg">
                  {isAr ? "اختر تاريخ الفعالية" : "Select Event Date"}
                </SheetTitle>
              </SheetHeader>
              <div className="flex justify-center">{calendarContent}</div>
            </SheetContent>
          </Sheet>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                data-testid="date-picker-trigger"
                className={cn(
                  "w-full h-11 justify-start text-start font-normal rounded-xl border-border/80 bg-background/50 hover:bg-muted/50 px-3",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground me-2" />
                <span className="truncate">{displayDateText}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-2 rounded-2xl"
              align={isAr ? "end" : "start"}
            >
              {calendarContent}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Time Picker Button & Popover */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Clock className="size-3.5 text-primary" />
          <span>{isAr ? "وقت الفعالية (الرباط / الدار البيضاء)" : "Event Time (Casablanca)"}</span>
          {required && <span className="text-destructive">*</span>}
        </label>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              data-testid="time-picker-trigger"
              className={cn(
                "w-full h-11 justify-start text-start font-normal rounded-xl border-border/80 bg-background/50 hover:bg-muted/50 px-3",
                !time && "text-muted-foreground"
              )}
            >
              <Clock className="size-4 shrink-0 text-muted-foreground me-2" />
              <span className="font-mono text-sm">{time || "18:00"}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-3 rounded-2xl flex flex-col gap-3"
            align={isAr ? "end" : "start"}
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold font-heading text-muted-foreground">
                {isAr ? "كتابة الوقت أو الفترة:" : "Custom Time / Range:"}
              </span>
              <input
                type="text"
                data-testid="time-picker-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="18:00 - 21:00"
                dir="ltr"
                className="w-full h-9 px-3 rounded-lg border border-border/80 bg-background text-sm font-mono text-center outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {isAr ? "أوقات شائعة:" : "Common Presets:"}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {COMMON_TIME_PRESETS.map((p) => (
                  <button
                    key={p.time}
                    type="button"
                    onClick={() => setTime(p.time)}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-start flex items-center justify-between",
                      time === p.time
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted/50 hover:bg-primary/10 hover:text-primary text-foreground"
                    )}
                  >
                    <span>{isAr ? p.labelAr : p.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
