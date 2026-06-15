export type BackgroundImageFormat = "avif" | "webp" | "jpeg";

export type BackgroundCropAnchor =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "left-center";

export type BackgroundImageVariant = {
  format: BackgroundImageFormat;
  width: number;
  height: number;
  blob: Blob;
  fileName: string;
  objectUrl: string;
  type: string;
};

export type BackgroundPictureSource = {
  srcSet: string;
  type: string;
  media?: string;
};

export type BackgroundPictureData = {
  sources: BackgroundPictureSource[];
  fallbackSrc: string;
  fallbackType: string;
  width: number;
  height: number;
};

export type BackgroundImageSet = {
  variants: BackgroundImageVariant[];
  picture: BackgroundPictureData;
  revokeObjectUrls: () => void;
};

type BackgroundImageFormatOptions = {
  format: BackgroundImageFormat;
  quality: number;
};

export type CreateBackgroundImageSetOptions = {
  baseName?: string;
  width?: number;
  height?: number;
  anchor?: BackgroundCropAnchor;
  formats?: BackgroundImageFormatOptions[];
};

type CropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

const defaultFormats: BackgroundImageFormatOptions[] = [
  { format: "avif", quality: 0.72 },
  { format: "webp", quality: 0.82 },
  { format: "jpeg", quality: 0.86 },
];

const mimeByFormat: Record<BackgroundImageFormat, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpeg: "image/jpeg",
};

export function getCoverCropRect({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  anchor = "center",
}: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  anchor?: BackgroundCropAnchor;
}): CropRect {
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
  } else {
    sh = sourceWidth / targetRatio;
  }

  const overflowX = sourceWidth - sw;
  const overflowY = sourceHeight - sh;
  const sx =
    anchor === "left" || anchor === "left-center"
      ? 0
      : anchor === "right"
        ? overflowX
        : overflowX / 2;
  const sy =
    anchor === "top"
      ? 0
      : anchor === "bottom"
        ? overflowY
        : overflowY / 2;

  return { sx, sy, sw, sh };
}

export async function createBackgroundImageSet(
  file: File,
  options: CreateBackgroundImageSetOptions = {},
): Promise<BackgroundImageSet> {
  if (!isSupportedBackgroundImage(file)) {
    throw new Error("Background image must be a PNG or JPEG file.");
  }

  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const baseName = sanitizeBaseName(options.baseName ?? stripExtension(file.name));
  const formats = options.formats ?? defaultFormats;
  const bitmap = await createImageBitmap(file);

  try {
    const crop = getCoverCropRect({
      sourceWidth: bitmap.width,
      sourceHeight: bitmap.height,
      targetWidth: width,
      targetHeight: height,
      anchor: options.anchor ?? "left-center",
    });
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create a canvas rendering context.");
    }

    context.drawImage(
      bitmap,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      width,
      height,
    );

    const variants = (
      await Promise.all(
        formats.map(async ({ format, quality }) => {
          const blob = await canvasToBlob(canvas, mimeByFormat[format], quality);

          if (blob.type !== mimeByFormat[format]) {
            return null;
          }

          return {
            format,
            width,
            height,
            blob,
            fileName: `${baseName}-${width}.${format === "jpeg" ? "jpg" : format}`,
            objectUrl: URL.createObjectURL(blob),
            type: blob.type,
          } satisfies BackgroundImageVariant;
        }),
      )
    ).filter((variant): variant is BackgroundImageVariant => variant !== null);

    if (variants.length === 0) {
      throw new Error("This browser could not encode the background image.");
    }

    return {
      variants,
      picture: createPictureData(variants),
      revokeObjectUrls: () => {
        variants.forEach((variant) => URL.revokeObjectURL(variant.objectUrl));
      },
    };
  } finally {
    bitmap.close();
  }
}

export function createPictureData(
  variants: BackgroundImageVariant[],
): BackgroundPictureData {
  const preferredFormats: BackgroundImageFormat[] = ["avif", "webp", "jpeg"];
  const sorted = [...variants].sort(
    (a, b) =>
      preferredFormats.indexOf(a.format) - preferredFormats.indexOf(b.format),
  );
  const fallback = sorted.find((variant) => variant.format === "jpeg") ?? sorted.at(-1);

  if (!fallback) {
    throw new Error("At least one image variant is required.");
  }

  return {
    sources: sorted
      .filter((variant) => variant !== fallback)
      .map((variant) => ({
        srcSet: variant.objectUrl,
        type: variant.type,
      })),
    fallbackSrc: fallback.objectUrl,
    fallbackType: fallback.type,
    width: fallback.width,
    height: fallback.height,
  };
}

export function isSupportedBackgroundImage(file: File): boolean {
  return file.type === "image/png" || file.type === "image/jpeg";
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Could not encode ${type}.`));
        }
      },
      type,
      quality,
    );
  });
}

function sanitizeBaseName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "background";
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
