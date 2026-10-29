import { useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/asset-url";

interface RemoteImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  // Shown when there is no image or it fails to load.
  fallback: ReactNode;
}

// An image stored on Cloudinary (or an older server path), with a loading
// placeholder and a fallback for a missing or broken file.
export function RemoteImage({ src, fallback, className, alt = "", ...rest }: RemoteImageProps) {
  const url = assetUrl(src);
  // The result belongs to one url, so a new url starts out loading again.
  const [result, setResult] = useState<{ url: string; status: "loaded" | "error" } | null>(null);
  const status = result?.url === url ? result.status : "loading";

  if (!url || status === "error") return <>{fallback}</>;
  return (
    <img
      {...rest}
      src={url}
      alt={alt}
      className={cn(className, status === "loading" && "animate-pulse bg-muted rounded")}
      onLoad={() => setResult({ url, status: "loaded" })}
      onError={() => setResult({ url, status: "error" })}
    />
  );
}
