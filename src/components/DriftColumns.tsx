"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import { SmoothImage } from "@/components/common/smooth-image";
import { distributeGalleryColumns, seededShuffle } from "@/lib/gallery-distribution";
import { cn } from "@/lib/utils";
import "./DriftColumns.css";

export interface DriftGalleryPhoto {
  id: string;
  src: string;
  thumbSrc: string;
  caption: string;
  dateLabel?: string;
  imageWidth: number | null;
  imageHeight: number | null;
}

interface DriftColumnsProps {
  photos: DriftGalleryPhoto[];
  shuffleSeed: number;
  lowPower: boolean;
  ariaLabel: string;
  onPhotoClick?: (photo: DriftGalleryPhoto, sourceElement: HTMLElement | null) => void;
  className?: string;
}

const COLUMN_DURATIONS_SECONDS = [44, 58, 48, 66, 52] as const;

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeColumnCount(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", cb, { passive: true });
  return () => window.removeEventListener("resize", cb);
}

function getColumnCountSnapshot(): number {
  if (typeof window === "undefined") return 0;
  const w = window.innerWidth;
  if (w >= 1280) return 5;
  if (w >= 1024) return 4;
  if (w >= 640) return 3;
  return 2;
}

export function DriftColumns({
  photos,
  shuffleSeed,
  lowPower,
  ariaLabel,
  onPhotoClick,
  className,
}: DriftColumnsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const [inView, setInView] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);

  const columnCount = useSyncExternalStore(
    subscribeColumnCount,
    getColumnCountSnapshot,
    () => 0,
  );
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  useEffect(() => {
    const updateVisibility = () => setTabHidden(document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hydrated = columnCount > 0;
  const staticMode = !hydrated || lowPower || reducedMotion;
  const paused = staticMode || !inView || tabHidden;

  const shuffledStaticPhotos = useMemo(
    () => seededShuffle(photos, shuffleSeed),
    [photos, shuffleSeed],
  );

  const columns = useMemo(
    () =>
      staticMode
        ? []
        : distributeGalleryColumns(photos, columnCount, shuffleSeed, {
            minRowsPerColumn: 6,
          }),
    [photos, columnCount, shuffleSeed, staticMode],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (photo: DriftGalleryPhoto, e: React.MouseEvent<HTMLElement>) => {
    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (start) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > 6) return;
    }
    onPhotoClick?.(photo, e.currentTarget);
  };

  const renderTile = (
    photo: DriftGalleryPhoto,
    tileId: string,
    isDuplicate: boolean,
  ) => {
    const image = (
      <SmoothImage
        src={photo.thumbSrc}
        alt={photo.caption}
        width={photo.imageWidth}
        height={photo.imageHeight}
        loading="lazy"
        sizes="(max-width: 639px) 48vw, (max-width: 1023px) 32vw, 22vw"
        className="object-cover"
        revealImmediately={isDuplicate}
      />
    );

    if (isDuplicate) {
      return (
        <div
          key={tileId}
          data-gallery-card="true"
          data-tile-id={tileId}
          data-photo-id={photo.id}
          onPointerDown={handlePointerDown}
          onClick={(e) => handleClick(photo, e)}
          className="drift-columns__tile"
        >
          {image}
        </div>
      );
    }

    return (
      <button
        key={tileId}
        type="button"
        data-gallery-card="true"
        data-tile-id={tileId}
        data-photo-id={photo.id}
        aria-label={photo.caption}
        onPointerDown={handlePointerDown}
        onClick={(e) => handleClick(photo, e)}
        className={cn(
          "drift-columns__tile",
          staticMode && "drift-columns__masonry-item",
        )}
      >
        {image}
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      data-rb="DriftColumns"
      data-paused={paused ? "true" : "false"}
      data-static={staticMode ? "true" : "false"}
      aria-label={ariaLabel}
      className={cn("drift-columns mx-auto w-full max-w-7xl px-3 sm:px-6", className)}
    >
      {staticMode ? (
        <div className="drift-columns__masonry" data-testid="gallery-static-masonry">
          {shuffledStaticPhotos.map((photo, idx) =>
            renderTile(photo, `static-${photo.id}-${idx}`, false),
          )}
        </div>
      ) : (
        <div className="drift-columns__viewport" data-testid="gallery-drifting-viewport">
          <div
            className="drift-columns__grid"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              ["--dc-gap" as string]: columnCount <= 2 ? "0.75rem" : "1rem",
            }}
          >
            {columns.map((colItems, colIdx) => {
              const direction = colIdx % 2 === 0 ? "up" : "down";
              const duration =
                COLUMN_DURATIONS_SECONDS[colIdx % COLUMN_DURATIONS_SECONDS.length];
              const trackStyle = {
                "--dc-anim": direction === "up" ? "drift-col-up" : "drift-col-down",
                "--dc-duration": `${duration}s`,
              } as CSSProperties;

              return (
                <div
                  key={`col-${colIdx}`}
                  className="drift-columns__col"
                  data-col-index={colIdx}
                  data-col-direction={direction}
                  data-col-duration={duration}
                >
                  <div className="drift-columns__track" style={trackStyle}>
                    <div className="drift-columns__half">
                      {colItems.map((photo, rowIdx) =>
                        renderTile(photo, `c${colIdx}-r${rowIdx}-${photo.id}`, false),
                      )}
                    </div>
                    <div className="drift-columns__half" aria-hidden="true">
                      {colItems.map((photo, rowIdx) =>
                        renderTile(
                          photo,
                          `c${colIdx}-dup-r${rowIdx}-${photo.id}`,
                          true,
                        ),
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DriftColumns;
