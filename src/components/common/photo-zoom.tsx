"use client";

import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { useLowPower } from "@/hooks/use-low-power";
import { useLocale } from "@/i18n/locale-provider";

export interface PhotoZoomItem {
  src: string;
  alt?: string;
  caption?: string;
  date?: string;
  width?: number | null;
  height?: number | null;
}

export interface PhotoZoomRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PhotoZoomState {
  item: PhotoZoomItem;
  sourceEl: HTMLElement | null;
  initialRect: PhotoZoomRect | null;
}

const DRAG_THRESHOLD_PX = 6;
const FLIP_DURATION_MS = 450;
const REDUCED_DURATION_MS = 180;

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const emptySubscribe = () => () => {};

function measureElementRect(el: HTMLElement | null | undefined): PhotoZoomRect | null {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function usePhotoZoom() {
  const [zoomState, setZoomState] = useState<PhotoZoomState | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const openZoom = useCallback(
    (item: PhotoZoomItem, sourceEl?: HTMLElement | null) => {
      const initialRect = measureElementRect(sourceEl);
      setZoomState({
        item,
        sourceEl: sourceEl ?? null,
        initialRect,
      });
    },
    [],
  );

  const closeZoom = useCallback(() => {
    setZoomState(null);
  }, []);

  const onTriggerPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const isDragClick = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!start) return false;
    return Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD_PX;
  }, []);

  const onTriggerClick = useCallback(
    (item: PhotoZoomItem, e: ReactMouseEvent<HTMLElement>) => {
      if (isDragClick(e)) return;
      openZoom(item, e.currentTarget);
    },
    [isDragClick, openZoom],
  );

  return {
    zoomState,
    isOpen: zoomState !== null,
    openZoom,
    closeZoom,
    onTriggerPointerDown,
    onTriggerClick,
    isDragClick,
  };
}

function computeFittedBox(
  aspect: number,
  hasMeta: boolean,
): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 640, height: 480 };
  const safeAspect = Number.isFinite(aspect) && aspect > 0.1 ? aspect : 4 / 3;
  const maxW = Math.max(200, window.innerWidth * 0.9);
  const reserveForMeta = hasMeta ? 72 : 0;
  const maxH = Math.max(180, window.innerHeight * 0.85 - reserveForMeta);
  if (maxW / maxH > safeAspect) {
    const height = maxH;
    return { width: Math.round(height * safeAspect), height: Math.round(height) };
  }
  const width = maxW;
  return { width: Math.round(width), height: Math.round(width / safeAspect) };
}

function PhotoZoomModal({
  zoomState,
  onClose,
}: {
  zoomState: PhotoZoomState;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const lowPower = useLowPower();
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const simpleFade = reducedMotion || lowPower;

  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);

  const backdropRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const timer = window.setTimeout(() => {
      closeBtnRef.current?.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    const prevOverflow = html.style.overflow;
    const prevPaddingRight = html.style.paddingRight;

    html.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      html.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPaddingRight;
    };
  }, []);

  const finishClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const returnTarget = previousFocusRef.current;
    onClose();
    requestAnimationFrame(() => {
      if (returnTarget && returnTarget.isConnected) {
        returnTarget.focus({ preventScroll: true });
      }
    });
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);

    const frameEl = frameRef.current;
    const backdropEl = backdropRef.current;
    const duration = simpleFade ? REDUCED_DURATION_MS : FLIP_DURATION_MS;

    if (backdropEl) {
      backdropEl.style.transition = `opacity ${simpleFade ? REDUCED_DURATION_MS : 300}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      backdropEl.style.opacity = "0";
    }

    if (frameEl) {
      const targetRect =
        measureElementRect(zoomState.sourceEl) ?? zoomState.initialRect;
      const currentRect = frameEl.getBoundingClientRect();

      if (!simpleFade && targetRect && currentRect.width > 0 && currentRect.height > 0) {
        const dx =
          targetRect.left + targetRect.width / 2 - (currentRect.left + currentRect.width / 2);
        const dy =
          targetRect.top + targetRect.height / 2 - (currentRect.top + currentRect.height / 2);
        const scale = Math.max(
          0.08,
          Math.min(targetRect.width / currentRect.width, targetRect.height / currentRect.height),
        );
        frameEl.style.transition = `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${Math.round(FLIP_DURATION_MS * 0.7)}ms ease-in`;
        frameEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
        frameEl.style.opacity = "0";
      } else {
        frameEl.style.transition = `opacity ${duration}ms ease-out`;
        frameEl.style.opacity = "0";
      }
    }

    closeTimerRef.current = window.setTimeout(finishClose, duration);
  }, [finishClose, simpleFade, zoomState]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      } else if (e.key === "Tab") {
        e.preventDefault();
        closeBtnRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  useLayoutEffect(() => {
    if (closingRef.current) return;
    const frameEl = frameRef.current;
    const backdropEl = backdropRef.current;
    if (!frameEl || !backdropEl) return;

    backdropEl.style.transition = "none";
    backdropEl.style.opacity = "0";

    const targetRect = zoomState.initialRect ?? measureElementRect(zoomState.sourceEl);
    const destRect = frameEl.getBoundingClientRect();

    if (!simpleFade && targetRect && destRect.width > 0 && destRect.height > 0) {
      const dx = targetRect.left + targetRect.width / 2 - (destRect.left + destRect.width / 2);
      const dy = targetRect.top + targetRect.height / 2 - (destRect.top + destRect.height / 2);
      const scale = Math.max(
        0.08,
        Math.min(targetRect.width / destRect.width, targetRect.height / destRect.height),
      );
      frameEl.style.transition = "none";
      frameEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
      frameEl.style.opacity = "0.7";
    } else {
      frameEl.style.transition = "none";
      frameEl.style.transform = "translate3d(0, 0, 0) scale(1)";
      frameEl.style.opacity = "0";
    }

    void frameEl.offsetHeight;

    const raf = requestAnimationFrame(() => {
      if (closingRef.current) return;
      backdropEl.style.transition = `opacity ${simpleFade ? REDUCED_DURATION_MS : 320}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      backdropEl.style.opacity = "1";

      if (simpleFade) {
        frameEl.style.transition = `opacity ${REDUCED_DURATION_MS}ms ease-out`;
        frameEl.style.opacity = "1";
      } else {
        frameEl.style.transition = `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${Math.round(FLIP_DURATION_MS * 0.65)}ms ease-out`;
        frameEl.style.transform = "translate3d(0, 0, 0) scale(1)";
        frameEl.style.opacity = "1";
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [simpleFade, zoomState]);

  const { item } = zoomState;
  const hasMeta = Boolean(item.caption || item.date);
  const storedAspect =
    item.width && item.height && item.width > 0 && item.height > 0
      ? item.width / item.height
      : null;
  const aspect =
    naturalAspect ??
    storedAspect ??
    (zoomState.initialRect && zoomState.initialRect.height > 0
      ? zoomState.initialRect.width / zoomState.initialRect.height
      : 4 / 3);
  const fitted = computeFittedBox(aspect, hasMeta);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("gallery.zoomModalLabel")}
      data-testid="photo-zoom-dialog"
      data-closing={closing ? "true" : "false"}
      onClick={(e) => {
        e.stopPropagation();
        requestClose();
      }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4"
    >
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="absolute inset-0 bg-[color-mix(in_oklch,var(--night-deep)_88%,transparent)]"
      />

      <button
        ref={closeBtnRef}
        type="button"
        aria-label={t("gallery.close")}
        onClick={(e) => {
          e.stopPropagation();
          requestClose();
        }}
        className="absolute top-4 end-4 z-20 grid size-11 place-items-center rounded-full border border-border/60 bg-card/90 text-card-foreground shadow-lg transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <X className="size-5" aria-hidden="true" />
      </button>

      <figure className="relative z-10 flex max-h-[90vh] max-w-[92vw] flex-col items-center">
        <div
          ref={frameRef}
          data-testid="photo-zoom-frame"
          style={{ width: fitted.width, height: fitted.height }}
          className="relative overflow-hidden rounded-2xl bg-card/10 shadow-2xl will-change-transform"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            alt={item.alt || item.caption || t("gallery.view")}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setNaturalAspect(img.naturalWidth / img.naturalHeight);
              }
            }}
            className="h-full w-full object-contain select-none"
            draggable={false}
          />
        </div>

        {hasMeta ? (
          <figcaption
            style={{ opacity: closing ? 0 : 1, transition: "opacity 220ms ease-out" }}
            className="mt-3 flex max-w-[min(90vw,42rem)] flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-border/60 bg-card/90 px-4 py-1.5 text-center text-sm text-card-foreground shadow-md"
          >
            {item.caption ? <span className="font-medium">{item.caption}</span> : null}
            {item.date ? (
              <time className="text-xs text-muted-foreground">{item.date}</time>
            ) : null}
          </figcaption>
        ) : null}
      </figure>
    </div>,
    document.body,
  );
}

export function PhotoZoom({
  zoomState,
  onClose,
}: {
  zoomState: PhotoZoomState | null;
  onClose: () => void;
}) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!isClient || !zoomState) return null;
  return <PhotoZoomModal key={zoomState.item.src} zoomState={zoomState} onClose={onClose} />;
}
