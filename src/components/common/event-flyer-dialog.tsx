"use client";

import { Download, ExternalLink, Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface EventFlyerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  posterUrl: string;
  title: string;
  dateStr?: string;
  locationStr?: string;
}

export function EventFlyerDialog({
  isOpen,
  onOpenChange,
  posterUrl,
  title,
  dateStr,
  locationStr,
}: EventFlyerDialogProps) {
  const { t, locale } = useLocale();
  const [isZoomed, setIsZoomed] = useState(false);

  // Reset zoom on open/close
  useEffect(() => {
    if (!isOpen) {
      setIsZoomed(false);
    }
  }, [isOpen]);

  const handleDownload = async () => {
    try {
      const response = await fetch(posterUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ihyaa-flyer-${title.slice(0, 30).replace(/\s+/g, "_")}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      window.open(posterUrl, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="event-flyer-modal"
        className="max-w-3xl overflow-hidden border-border/60 bg-background/95 p-0 backdrop-blur-2xl sm:rounded-3xl"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/40 px-5 py-3.5 sm:px-6">
          <div className="flex flex-col text-start">
            <DialogTitle className="font-heading text-base font-semibold sm:text-lg">
              {title}
            </DialogTitle>
            {(dateStr || locationStr) && (
              <DialogDescription className="text-xs text-muted-foreground">
                {[dateStr, locationStr].filter(Boolean).join(" • ")}
              </DialogDescription>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsZoomed((z) => !z)}
              data-testid="flyer-zoom-btn"
              title={isZoomed ? (locale === "ar" ? "تصغير" : "Reset zoom") : (locale === "ar" ? "تكبير" : "Zoom in")}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brass/10 hover:text-brass"
            >
              <Maximize2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              data-testid="flyer-download-btn"
              title={locale === "ar" ? "تحميل الملصق" : "Download poster"}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brass/10 hover:text-brass"
            >
              <Download className="size-4" />
            </button>
            <a
              href={posterUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="flyer-external-btn"
              title={locale === "ar" ? "فتح في نافذة جديدة" : "Open in new tab"}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brass/10 hover:text-brass"
            >
              <ExternalLink className="size-4" />
            </a>
            <DialogClose
              data-testid="flyer-close-btn"
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Scrollable image canvas */}
        <div
          className={cn(
            "relative flex max-h-[75vh] w-full items-center justify-center overflow-auto p-4 transition-all duration-300",
            isZoomed ? "cursor-zoom-out" : "cursor-zoom-in",
          )}
          onClick={() => setIsZoomed((z) => !z)}
        >
          <div
            className={cn(
              "relative transition-transform duration-300 ease-out",
              isZoomed ? "scale-125 sm:scale-150" : "scale-100",
            )}
          >
            <Image
              src={posterUrl}
              alt={title}
              width={768}
              height={960}
              priority
              className="max-h-[68vh] w-auto rounded-2xl object-contain shadow-2xl ring-1 ring-border/50"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
