"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useEffect, useRef, useState, type TransitionEvent } from "react";
import { ImageIcon, ImageOff } from "lucide-react";

import styles from "./smooth-image.module.css";
import { cn } from "@/lib/utils";

type SmoothImageProps = Omit<ImageProps, "fill" | "width" | "height" | "onLoad" | "onError" | "placeholder" | "blurDataURL"> & {
  width?: number | null;
  height?: number | null;
  fill?: boolean;
  containerClassName?: string;
  fadeDurationMs?: number;
  revealImmediately?: boolean;
  "data-testid"?: string;
  onError?: ImageProps["onError"];
};

function getSourceKey(src: ImageProps["src"]) {
  if (typeof src === "string") return src;
  return "src" in src ? src.src : src.default.src;
}

export function SmoothImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className,
  containerClassName,
  sizes,
  priority,
  loading,
  draggable,
  fadeDurationMs = 550,
  revealImmediately = false,
  "data-testid": imageTestId = "smooth-image",
  onError,
  ...imageProps
}: SmoothImageProps) {
  const sourceKey = getSourceKey(src);
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [removedSkeletonSource, setRemovedSkeletonSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [fadeMs, setFadeMs] = useState(fadeDurationMs);
  const loaded = loadedSource === sourceKey;
  const failed = failedSource === sourceKey;
  const skeletonVisible = removedSkeletonSource !== sourceKey;
  const reservedWidth = width ?? 1280;
  const reservedHeight = height ?? 960;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (preference.matches && imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
        setRemovedSkeletonSource(sourceKey);
      }
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [sourceKey]);

  const finishDecode = useCallback(async (cached = false) => {
    const image = imageRef.current;
    if (!image) return;
    try {
      if (typeof image.decode === "function") await image.decode();
      const shouldSkipSweep = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setFadeMs(cached ? Math.min(fadeDurationMs, 250) : fadeDurationMs);
      setLoadedSource(sourceKey);
      if (shouldSkipSweep) setRemovedSkeletonSource(sourceKey);
    } catch {
      if (image.naturalWidth > 0) {
        setFadeMs(cached ? Math.min(fadeDurationMs, 250) : fadeDurationMs);
        setLoadedSource(sourceKey);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setRemovedSkeletonSource(sourceKey);
      } else {
        setFailedSource(sourceKey);
      }
    }
  }, [fadeDurationMs, sourceKey]);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) void finishDecode(true);
  }, [finishDecode]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLImageElement>) => {
    if (event.propertyName === "opacity" && loaded && !failed) setRemovedSkeletonSource(sourceKey);
  };

  return (
    <span
      className={cn(styles.frame, fill ? styles.fill : styles.intrinsic, containerClassName)}
      style={fill ? undefined : { aspectRatio: `${reservedWidth} / ${reservedHeight}` }}
      data-testid="smooth-image-frame"
      data-image-state={failed ? "error" : loaded ? "loaded" : "loading"}
    >
      {skeletonVisible && !revealImmediately && (
        <span
          aria-hidden="true"
          data-testid="smooth-image-skeleton"
          className={cn(styles.skeleton, loaded && !failed && styles.skeletonLeaving, failed && styles.errorTile)}
          style={{ transitionDuration: `${fadeMs}ms` }}
        >
          <span className={styles.icon}>{failed ? <ImageOff strokeWidth={1.5} /> : <ImageIcon strokeWidth={1.5} />}</span>
          {!failed && <span className={styles.sweep} />}
        </span>
      )}
      <Image
        {...imageProps}
        ref={imageRef}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : loading ?? "lazy"}
        draggable={draggable}
        className={cn(styles.image, className, (loaded || revealImmediately) && !failed ? styles.imageLoaded : styles.imageWaiting)}
        style={{ ...imageProps.style, transitionDuration: revealImmediately ? "0ms" : `${fadeMs}ms` }}
        onLoad={() => void finishDecode(false)}
        onError={(event) => { setFailedSource(sourceKey); onError?.(event); }}
        onTransitionEnd={handleTransitionEnd}
        data-testid={imageTestId}
      />
    </span>
  );
}
