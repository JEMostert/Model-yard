import type { BackgroundPictureData } from "@/lib/background-image";

export const midnightGardenBackground: BackgroundPictureData = {
  sources: [
    {
      srcSet: "/backgrounds/generated/midnight-garden-portrait-1080.avif",
      type: "image/avif",
      media: "(max-aspect-ratio: 4 / 5)",
    },
    {
      srcSet: "/backgrounds/generated/midnight-garden-portrait-1080.webp",
      type: "image/webp",
      media: "(max-aspect-ratio: 4 / 5)",
    },
    {
      srcSet: "/backgrounds/generated/midnight-garden-1920.avif",
      type: "image/avif",
    },
    {
      srcSet: "/backgrounds/generated/midnight-garden-1920.webp",
      type: "image/webp",
    },
  ],
  fallbackSrc: "/backgrounds/generated/midnight-garden-1920.jpg",
  fallbackType: "image/jpeg",
  width: 1920,
  height: 1080,
};
