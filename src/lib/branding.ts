import { assetUrl } from "./asset-url";

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

export function applyBrandingCss(theme: {
  primaryColor?: string;
  sidebarColor?: string;
  accentColor?: string;
  buttonColor?: string;
  logoUrl?: string;
}) {
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
  if (theme.logoUrl) document.querySelector("link[rel='icon']")?.setAttribute("href", assetUrl(theme.logoUrl));
  window.dispatchEvent(new CustomEvent("brandingUpdated"));
}

export function resetBrandingCss() {
  const el = document.documentElement;
  ["--theme-primary", "--theme-sidebar", "--theme-accent", "--theme-button",
   "--primary", "--ring", "--sidebar", "--accent", "--sidebar-primary", "--sidebar-ring"]
    .forEach((v) => el.style.removeProperty(v));
}
