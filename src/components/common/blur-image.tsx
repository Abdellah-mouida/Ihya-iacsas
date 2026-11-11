"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type BlurImageProps = Omit<ImageProps, "src" | "alt" | "width" | "height" | "fill" | "onLoad" | "onError" | "placeholder" | "blurDataURL"> & {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  blurDataUrl?: string | null;
  fill?: boolean;
};

export function BlurImage({
  src,
  alt,
  width,
  height,
  blurDataUrl,
  fill = false,
  className,
  sizes,
  priority,
  loading,
  draggable,
  ...imageProps
}: BlurImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [hiddenPlaceholderSource, setHiddenPlaceholderSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const loaded = loadedSource === src;
  const failed = failedSource === src;
  const placeholderVisible = hiddenPlaceholderSource !== src;

  const finishDecode = useCallback(async (skipFade = false) => {
    const image = imageRef.current;
    if (!image || failed) return;
    try {
      if (typeof image.decode === "function") await image.decode();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setLoadedSource(src);
      if (reduced || skipFade) {
        setHiddenPlaceholderSource(src);
      } else {
        window.setTimeout(() => setHiddenPlaceholderSource(src), 300);
      }
    } catch {
      setFailedSource(src);
      setLoadedSource(null);
    }
  }, [failed, src]);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) void finishDecode(true);
  }, [finishDecode, src]);

  const reservedWidth = width ?? 1280;
  const reservedHeight = height ?? 960;
  const imageClassName = `${className ?? ""} transition-opacity duration-300 motion-reduce:transition-none ${!blurDataUrl || loaded ? "opacity-100" : "opacity-0"}`;

  return (
    <span
      className={fill ? "absolute inset-0 block overflow-hidden" : "relative block w-full overflow-hidden"}
      style={fill ? undefined : { aspectRatio: `${reservedWidth} / ${reservedHeight}` }}
      data-testid="blur-image"
    >
      {blurDataUrl && placeholderVisible && !failed ? (
        <span
          aria-hidden="true"
          data-testid="blur-placeholder"
          className={`pointer-events-none absolute inset-0 z-[1] bg-cover bg-center transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-0" : "opacity-100"}`}
          style={{ backgroundImage: `url("${blurDataUrl}")` }}
        />
      ) : null}
      <Image
        {...imageProps}
        ref={imageRef}
        src={src}
        alt={alt}
        {...(fill ? { fill: true } : { width: reservedWidth, height: reservedHeight })}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : loading ?? "lazy"}
        draggable={draggable}
        className={imageClassName}
        onLoad={() => void finishDecode()}
        onError={() => { setFailedSource(src); setLoadedSource(null); setHiddenPlaceholderSource(src); }}
      />
      {failed ? <span aria-hidden="true" data-testid="blur-image-fallback" className="absolute inset-0 bg-muted/60" /> : null}
    </span>
  );
}
