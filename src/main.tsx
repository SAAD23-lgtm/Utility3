import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const CHUNK_RECOVERY_KEY = "utility3-chunk-recovery";

function recoverFromStaleDeployment(message: string) {
  const staleChunk =
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Expected a JavaScript-or-Wasm module script") ||
    message.includes("Importing a module script failed");
  if (!staleChunk || sessionStorage.getItem(CHUNK_RECOVERY_KEY)) return;

  sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");
  const url = new URL(window.location.href);
  url.searchParams.set("deployment", Date.now().toString());
  window.location.replace(url.toString());
}

window.addEventListener("error", (event) => {
  const script = event.target instanceof HTMLScriptElement ? event.target.src : "";
  recoverFromStaleDeployment(`${event.message || ""} ${script}`);
}, true);

window.addEventListener("unhandledrejection", (event) => {
  recoverFromStaleDeployment(String(event.reason?.message || event.reason || ""));
});

window.addEventListener("load", () => {
  sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
});

createRoot(document.getElementById("root")!).render(<App />);
