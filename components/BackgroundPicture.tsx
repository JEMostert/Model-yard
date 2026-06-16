import type { BackgroundPictureData } from "@/lib/background-image";
import { cn } from "@/lib/utils";

export function BackgroundPicture({
  image,
  alt = "",
  pictureClassName,
  className,
}: {
  image: BackgroundPictureData;
  alt?: string;
  pictureClassName?: string;
  className?: string;
}) {
  return (
    <picture className={pictureClassName}>
      {image.sources.map((source) => (
        <source
          key={`${source.media ?? "default"}-${source.type}`}
          srcSet={source.srcSet}
          type={source.type}
          media={source.media}
        />
      ))}
      <img
        src={image.fallbackSrc}
        alt={alt}
        width={image.width}
        height={image.height}
        decoding="async"
        fetchPriority="low"
        className={cn("h-full w-full object-cover", className)}
        draggable={false}
      />
    </picture>
  );
}
