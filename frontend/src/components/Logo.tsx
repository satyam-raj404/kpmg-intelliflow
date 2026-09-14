import { useState } from "react";
import { brand } from "@/lib/brand";

interface LogoProps {
  variant?: "blue" | "white";
  size?: number;
}

/**
 * KPMG Logo. Tries /kpmg-logo.svg first; falls back to a styled wordmark.
 */
export function Logo({ variant = "blue", size = 32 }: LogoProps) {
  const [failed, setFailed] = useState(false);
  const color = variant === "white" ? "#FFFFFF" : brand.colors.primary;

  if (failed) {
    return (
      <span
        aria-label="KPMG"
        style={{
          fontFamily: brand.fonts.heading,
          color,
          fontWeight: 700,
          fontStyle: "italic",
          letterSpacing: "0.04em",
          fontSize: size * 0.7,
          lineHeight: 1,
        }}
      >
        {brand.logo.text}
      </span>
    );
  }

  return (
    <img
      src={brand.logo.path}
      alt="KPMG"
      onError={() => setFailed(true)}
      style={{ height: size, width: "auto" }}
    />
  );
}
