export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropImageOptions {
  rotation?: number;
  maxDimensions?: { width: number; height: number };
  fileName?: string;
  mimeType?: string;
  quality?: number;
}

export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

export function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

export function rotateSize(
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number } {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
  options: CropImageOptions = {},
): Promise<{ file: File; blobUrl: string; width: number; height: number }> {
  const {
    rotation = 0,
    maxDimensions,
    fileName = "cropped-image.webp",
    mimeType = "image/webp",
    quality = 0.9,
  } = options;

  const image = await createImage(imageSrc);
  const rotCanvas = document.createElement("canvas");
  const rotCtx = rotCanvas.getContext("2d");
  if (!rotCtx) {
    throw new Error("Unable to create canvas context");
  }

  const rotRad = getRadianAngle(rotation);
  const bBox = rotateSize(image.naturalWidth, image.naturalHeight, rotation);

  rotCanvas.width = bBox.width;
  rotCanvas.height = bBox.height;

  rotCtx.translate(bBox.width / 2, bBox.height / 2);
  rotCtx.rotate(rotRad);
  rotCtx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
  rotCtx.drawImage(image, 0, 0);

  const cropCanvas = document.createElement("canvas");
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) {
    throw new Error("Unable to create crop canvas context");
  }

  let targetWidth = Math.max(1, Math.round(pixelCrop.width));
  let targetHeight = Math.max(1, Math.round(pixelCrop.height));

  if (maxDimensions) {
    const { width: maxWidth, height: maxHeight } = maxDimensions;
    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.max(1, Math.round(targetWidth * ratio));
      targetHeight = Math.max(1, Math.round(targetHeight * ratio));
    }
  }

  cropCanvas.width = targetWidth;
  cropCanvas.height = targetHeight;

  cropCtx.imageSmoothingQuality = "high";
  cropCtx.drawImage(
    rotCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return new Promise((resolve, reject) => {
    cropCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas blob creation failed"));
          return;
        }
        const file = new File([blob], fileName, {
          type: blob.type || mimeType,
          lastModified: Date.now(),
        });
        const blobUrl = URL.createObjectURL(blob);
        resolve({ file, blobUrl, width: targetWidth, height: targetHeight });
      },
      mimeType,
      quality,
    );
  });
}
