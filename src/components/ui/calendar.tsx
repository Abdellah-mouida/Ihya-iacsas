"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 select-none", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        month_caption: "flex justify-center items-center relative h-9 px-8",
        caption_label: "text-sm font-semibold font-heading text-foreground",
        nav: "flex items-center gap-1",
        button_previous: cn(
          "size-7 bg-transparent p-0 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors absolute left-1 top-1 z-10 rtl:left-auto rtl:right-1 cursor-pointer"
        ),
        button_next: cn(
          "size-7 bg-transparent p-0 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors absolute right-1 top-1 z-10 rtl:right-auto rtl:left-1 cursor-pointer"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-between",
        weekday:
          "text-muted-foreground/80 rounded-md w-9 font-medium text-[0.8rem] text-center",
        week: "flex w-full mt-2 justify-between",
        day: "size-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          "size-9 p-0 font-normal rounded-xl transition-all hover:bg-primary/10 hover:text-primary flex items-center justify-center font-sans cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        ),
        selected:
          "!bg-primary !text-primary-foreground hover:!bg-primary/90 focus:!bg-primary font-semibold shadow-xs !opacity-100",
        today: "border border-brass/50 font-bold text-foreground bg-brass/10",
        outside: "text-muted-foreground/40 opacity-40 aria-selected:opacity-30",
        disabled: "text-muted-foreground/30 opacity-30 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground/30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft
                className="size-4 rtl:rotate-180"
                {...chevronProps}
              />
            );
          }
          return (
            <ChevronRight
              className="size-4 rtl:rotate-180"
              {...chevronProps}
            />
          );
        },
      }}
      {...props}
    />
  );
}
