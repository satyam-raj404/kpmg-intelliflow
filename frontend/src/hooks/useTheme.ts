import { useState, useEffect } from "react";

export type AppTheme    = "light" | "dark";
export type FontSize    = "sm" | "md" | "lg";
export type ContrastMode = "normal" | "high";

function applyTheme(theme: AppTheme) {
  document.documentElement.removeAttribute("data-theme");
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
}

function applyFontSize(size: FontSize) {
  document.documentElement.setAttribute("data-font-size", size);
}

function applyContrast(mode: ContrastMode) {
  document.documentElement.removeAttribute("data-contrast");
  if (mode === "high") document.documentElement.setAttribute("data-contrast", "high");
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try { return (localStorage.getItem("is_theme") as AppTheme) ?? "light"; } catch { return "light"; }
  });
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    try { return (localStorage.getItem("is_font_size") as FontSize) ?? "md"; } catch { return "md"; }
  });
  const [contrast, setContrastState] = useState<ContrastMode>(() => {
    try { return (localStorage.getItem("is_contrast") as ContrastMode) ?? "normal"; } catch { return "normal"; }
  });

  useEffect(() => { applyTheme(theme);    localStorage.setItem("is_theme",     theme);    }, [theme]);
  useEffect(() => { applyFontSize(fontSize); localStorage.setItem("is_font_size", fontSize); }, [fontSize]);
  useEffect(() => { applyContrast(contrast); localStorage.setItem("is_contrast",  contrast); }, [contrast]);

  // Apply on mount
  useEffect(() => { applyTheme(theme); applyFontSize(fontSize); applyContrast(contrast); }, []);

  function setTheme(t: AppTheme)      { setThemeState(t); }
  function setFontSize(s: FontSize)   { setFontSizeState(s); }
  function setContrast(c: ContrastMode) { setContrastState(c); }
  function toggle()                   { setThemeState(t => t === "light" ? "dark" : "light"); }
  function toggleContrast()           { setContrastState(c => c === "normal" ? "high" : "normal"); }

  return { theme, setTheme, toggle, fontSize, setFontSize, contrast, setContrast, toggleContrast };
}
