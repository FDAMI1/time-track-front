import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(() => {
      console.log("SW registered");
    }).catch(() => {});
  });
}

let deferredPrompt: any = null;

window.addEventListener("beforeinstallprompt", (e: Event) => {
  e.preventDefault();
  deferredPrompt = e;

  const btn = document.createElement("button");
  btn.id = "pwa-install-btn";
  btn.textContent = "Install App";
  btn.setAttribute("data-testid", "button-install-pwa");
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "80px",
    right: "16px",
    zIndex: "9999",
    padding: "10px 18px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37,99,235,0.4)",
  });

  btn.addEventListener("click", () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      btn.remove();
    });
  });

  document.body.appendChild(btn);
});

window.addEventListener("appinstalled", () => {
  document.getElementById("pwa-install-btn")?.remove();
  deferredPrompt = null;
});
