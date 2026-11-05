import { useEffect, useState } from "react";
import { assetUrl } from "./asset-url";

const DEFAULT_FAVICON = "/logo.png";
const THEME_KEY = "app_theme";

export interface Branding {
  appName?: string;
  logoText?: string;
  logoType?: "text" | "image";
  logoUrl?: string;
  primaryColor?: string;
  sidebarColor?: string;
  accentColor?: string;
  buttonColor?: string;
}

// The browser tab shows the organization's logo, or the platform icon without one.
function setFavicon(url: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

export function getBranding(): Branding {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// The signed-in organization's branding, kept current when it changes.
export function useBranding(): Branding {
  const [branding, setBranding] = useState(getBranding);
  useEffect(() => {
    const handler = () => setBranding(getBranding());
    window.addEventListener("brandingUpdated", handler);
    return () => window.removeEventListener("brandingUpdated", handler);
  }, []);
  return branding;
}

// Stores and applies one organization's branding; an empty one clears the last organization's.
export function saveBranding(theme: Branding) {
  if (Object.keys(theme).length) {
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    applyBrandingCss(theme);
  } else {
    localStorage.removeItem(THEME_KEY);
    resetBrandingCss();
  }
}

function hexToHsl(hex: string): string {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return "217 91% 35%";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBrandingCss(theme: Branding) {
  const el = document.documentElement;
  const btn = theme.buttonColor || theme.primaryColor;
  if (theme.primaryColor) el.style.setProperty("--theme-primary", theme.primaryColor);
  if (theme.sidebarColor) {
    el.style.setProperty("--theme-sidebar", theme.sidebarColor);
    el.style.setProperty("--sidebar", hexToHsl(theme.sidebarColor));
  }
  if (theme.accentColor) {
    el.style.setProperty("--theme-accent", theme.accentColor);
    el.style.setProperty("--accent", hexToHsl(theme.accentColor));
  }
  if (btn) {
    el.style.setProperty("--theme-button", btn);
    el.style.setProperty("--primary", hexToHsl(btn));
    el.style.setProperty("--ring", hexToHsl(btn));
    el.style.setProperty("--sidebar-primary", hexToHsl(btn));
    el.style.setProperty("--sidebar-ring", hexToHsl(btn));
  }
  setFavicon(theme.logoType !== "text" && theme.logoUrl ? assetUrl(theme.logoUrl) : DEFAULT_FAVICON);
  window.dispatchEvent(new CustomEvent("brandingUpdated"));
}

export function resetBrandingCss() {
  const el = document.documentElement;
  ["--theme-primary", "--theme-sidebar", "--theme-accent", "--theme-button",
   "--primary", "--ring", "--sidebar", "--accent", "--sidebar-primary", "--sidebar-ring"]
    .forEach((v) => el.style.removeProperty(v));
  setFavicon(DEFAULT_FAVICON);
  window.dispatchEvent(new CustomEvent("brandingUpdated"));
}
