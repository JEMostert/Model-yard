import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBackgroundImageSet,
  createPictureData,
  getCoverCropRect,
  isSupportedBackgroundImage,
  type BackgroundImageVariant,
} from "./background-image";

describe("background image helpers", () => {
  let originalCreateImageBitmap: typeof globalThis.createImageBitmap;
  let createObjectUrl: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrl: ReturnType<typeof vi.spyOn>;
  let drawImage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalCreateImageBitmap = globalThis.createImageBitmap;
    drawImage = vi.fn();
    globalThis.createImageBitmap = vi.fn(async () => ({
      width: 1672,
      height: 941,
      close: vi.fn(),
    })) as unknown as typeof createImageBitmap;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      callback,
      type,
    ) {
      callback(new Blob(["encoded"], { type }));
    });
    createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob) => `blob:${(blob as Blob).type}`);
    revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.createImageBitmap = originalCreateImageBitmap;
    vi.restoreAllMocks();
  });

  it("left-anchors landscape crops so overflow falls off the right side", () => {
    expect(
      getCoverCropRect({
        sourceWidth: 3000,
        sourceHeight: 1000,
        targetWidth: 1000,
        targetHeight: 1000,
        anchor: "left-center",
      }),
    ).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 1000 });
  });

  it("center-crops by default for cover-style output", () => {
    expect(
      getCoverCropRect({
        sourceWidth: 3000,
        sourceHeight: 1000,
        targetWidth: 1000,
        targetHeight: 1000,
      }),
    ).toEqual({ sx: 1000, sy: 0, sw: 1000, sh: 1000 });
  });

  it("creates picture data with AVIF and WebP sources before a JPEG fallback", () => {
    const variants = [
      variant("jpeg", "image/jpeg", "blob:bg-jpg"),
      variant("webp", "image/webp", "blob:bg-webp"),
      variant("avif", "image/avif", "blob:bg-avif"),
    ];

    expect(createPictureData(variants)).toEqual({
      sources: [
        { srcSet: "blob:bg-avif", type: "image/avif" },
        { srcSet: "blob:bg-webp", type: "image/webp" },
      ],
      fallbackSrc: "blob:bg-jpg",
      fallbackType: "image/jpeg",
      width: 1920,
      height: 1080,
    });
  });

  it("accepts PNG and JPEG upload inputs", () => {
    expect(isSupportedBackgroundImage(new File([], "bg.png", { type: "image/png" }))).toBe(
      true,
    );
    expect(
      isSupportedBackgroundImage(new File([], "bg.jpg", { type: "image/jpeg" })),
    ).toBe(true);
    expect(
      isSupportedBackgroundImage(new File([], "bg.gif", { type: "image/gif" })),
    ).toBe(false);
  });

  it("converts the current background PNG into picture-ready variants", async () => {
    const bytes = readFileSync("public/backgrounds/midnight-garden.png");
    const file = new File([bytes], "midnight-garden.png", { type: "image/png" });

    const imageSet = await createBackgroundImageSet(file, {
      width: 1920,
      height: 1080,
      anchor: "left-center",
    });

    expect(globalThis.createImageBitmap).toHaveBeenCalledWith(file);
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0.25,
      1672,
      940.5,
      0,
      0,
      1920,
      1080,
    );
    expect(imageSet.variants.map((variant) => variant.fileName)).toEqual([
      "midnight-garden-1920.avif",
      "midnight-garden-1920.webp",
      "midnight-garden-1920.jpg",
    ]);
    expect(imageSet.picture).toEqual({
      sources: [
        { srcSet: "blob:image/avif", type: "image/avif" },
        { srcSet: "blob:image/webp", type: "image/webp" },
      ],
      fallbackSrc: "blob:image/jpeg",
      fallbackType: "image/jpeg",
      width: 1920,
      height: 1080,
    });

    imageSet.revokeObjectUrls();

    expect(createObjectUrl).toHaveBeenCalledTimes(3);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(3);
  });
});

function variant(
  format: BackgroundImageVariant["format"],
  type: string,
  objectUrl: string,
): BackgroundImageVariant {
  return {
    format,
    width: 1920,
    height: 1080,
    blob: new Blob([], { type }),
    fileName: `bg.${format}`,
    objectUrl,
    type,
  };
}
