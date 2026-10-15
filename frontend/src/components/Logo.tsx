import { useState } from "react";
import { brand } from "@/lib/brand";

interface LogoProps {
  variant?: "blue" | "white";
  size?: number;
}

/**
 * KPMG logo. Renders the official mark supplied in /public:
 *   variant="blue"  -> /kpmg-logo.png        (navy, for light backgrounds)
 *   variant="white" -> /kpmg-logo-white.png  (white, for the navy sidebar/auth panels)
 *
 * Sized by height; width follows brand.logo.aspect so the mark keeps its
 * proportions. If the asset is missing we render a neutral placeholder block
 * rather than a text wordmark — a fake "KPMG" in Arial reads as a broken logo.
 */
export function Logo({ variant = "blue", size = 32 }: LogoProps) {
  const [failed, setFailed] = useState(false);
  const src = variant === "white" ? brand.logo.pathWhite : brand.logo.path;

  if (failed) {
    return (
      <span
        aria-label="KPMG logo asset missing"
        role="img"
        style={{
          display: "inline-block",
          width: size * brand.logo.aspect * 0.55,
          height: size,
          borderRadius: 2,
          background: variant === "white" ? "#FFFFFF" : brand.colors.primary,
          opacity: 0.25,
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt="KPMG"
      onError={() => {
        console.warn(`[Logo] missing asset ${src} — add it to frontend/public/`);
        setFailed(true);
      }}
      style={{
        height: size,
        width: "auto",
        maxWidth: size * brand.logo.aspect,
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}