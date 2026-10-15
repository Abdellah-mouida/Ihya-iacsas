"use client";

import React, { useState, useCallback, useTransition } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { getCroppedImg, PixelCrop } from "@/lib/crop-image";
import { useLocale } from "@/i18n/locale-provider";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Crop as CropIcon,
  Loader2,
  Check,
  X,
} from "lucide-react";

export interface AspectPreset {
  id: string;
  labelAr: string;
  labelEn: string;
  aspect?: number;
}

export interface ImageCropperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  cropShape?: "rect" | "round";
  aspect?: number;
  presets?: AspectPreset[];
  maxDimensions?: { width: number; height: number };
  onCropComplete: (result: { file: File; blobUrl: string; width: number; height: number }) => void;
  onCancel?: () => void;
  titleAr?: string;
  titleEn?: string;
}

export function ImageCropperDialog({
  open,
  onOpenChange,
  imageSrc,
  cropShape = "rect",
  aspect: initialAspect = 4 / 5,
  presets,
  maxDimensions,
  onCropComplete,
  onCancel,
  titleAr = "اقتصاص وتعديل الصورة",
  titleEn = "Crop & Adjust Image",
}: ImageCropperDialogProps) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [currentAspect, setCurrentAspect] = useState<number | undefined>(initialAspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [isProcessing, startTransition] = useTransition();

  const handleCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCurrentAspect(initialAspect);
  }, [initialAspect]);

  const handleConfirm = useCallback(() => {
    if (!imageSrc || !croppedAreaPixels) return;

    startTransition(async () => {
      try {
        const result = await getCroppedImg(imageSrc, croppedAreaPixels, {
          rotation,
          maxDimensions,
          mimeType: "image/webp",
          fileName: `cropped-${Date.now()}.webp`,
          quality: 0.9,
        });

        onCropComplete(result);
        onOpenChange(false);
      } catch (err) {
        console.error("Error cropping image:", err);
      }
    });
  }, [imageSrc, croppedAreaPixels, rotation, maxDimensions, onCropComplete, onOpenChange]);

  const handleDialogClose = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
      onCancel?.();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent
        data-testid="image-cropper-dialog"
        className="sm:max-w-xl max-h-[95vh] flex flex-col p-4 sm:p-6 overflow-hidden border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl"
      >
        <DialogHeader className="space-y-1 text-start">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CropIcon className="size-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              {isAr ? titleAr : titleEn}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {isAr
              ? "اسحب لتحديد الموضع، واستخدم شريط التكبير والتدوير لضبط الصورة"
              : "Drag to reposition, use zoom and rotation to adjust the image"}
          </DialogDescription>
        </DialogHeader>

        {/* Cropper Viewport Container */}
        <div
          data-testid="cropper-viewport-container"
          className="relative w-full h-64 sm:h-80 my-2 rounded-2xl overflow-hidden bg-black/90 border border-border/50 shadow-inner"
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={currentAspect}
              cropShape={cropShape}
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              classes={{
                containerClassName: "size-full relative",
                mediaClassName: "max-h-full max-w-full",
              }}
            />
          )}
        </div>

        {/* Preset Selectors if provided */}
        {presets && presets.length > 1 && (
          <div
            data-testid="cropper-presets-container"
            className="flex items-center justify-center flex-wrap gap-1.5 py-1"
          >
            {presets.map((p) => {
              const isSelected =
                (p.aspect === undefined && currentAspect === undefined) ||
                (p.aspect !== undefined && currentAspect === p.aspect);
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`cropper-preset-${p.id}`}
                  onClick={() => setCurrentAspect(p.aspect)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isAr ? p.labelAr : p.labelEn}
                </button>
              );
            })}
          </div>
        )}

        {/* Controls Bar: Zoom & Rotation */}
        <div className="space-y-3 py-2 px-1">
          <div className="flex items-center gap-3">
            <ZoomOut className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              aria-label={isAr ? "شريط التكبير" : "Zoom slider"}
              data-testid="cropper-zoom-slider"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
            />
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs font-mono font-medium text-muted-foreground min-w-[2.5rem] text-end">
              {zoom.toFixed(1)}x
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="cropper-rotate-btn"
                onClick={handleRotate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted text-xs font-medium text-foreground transition-all"
              >
                <RotateCw className="size-3.5 text-primary" />
                <span>{isAr ? "تدوير 90°" : "Rotate 90°"}</span>
              </button>

              <button
                type="button"
                data-testid="cropper-reset-btn"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
              >
                <RefreshCw className="size-3.5" />
                <span>{isAr ? "إعادة ضبط" : "Reset"}</span>
              </button>
            </div>

            {rotation > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                {rotation}°
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2 border-t border-border/60">
          <button
            type="button"
            data-testid="cropper-cancel-btn"
            onClick={() => handleDialogClose(false)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
            <span>{isAr ? "إلغاء" : "Cancel"}</span>
          </button>

          <button
            type="button"
            data-testid="cropper-confirm-btn"
            disabled={isProcessing || !croppedAreaPixels}
            onClick={handleConfirm}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            <span>{isAr ? "تطبيق الاقتصاص" : "Apply Crop"}</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
