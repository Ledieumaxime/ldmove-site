import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
// Fonts are served from our own domain: loading them from Google sent every
// visitor's IP address to Google without consent (GDPR).
import "@fontsource-variable/dm-sans/opsz.css";
import "@fontsource-variable/dm-sans/opsz-italic.css";
import "@fontsource-variable/playfair-display/wght.css";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "./index.css";

// Inside the iPhone and Android apps the screen never zooms. iOS zooms in
// on its own when a field under 16px gets focus (the logger's set fields
// are 14px), and Capacitor then disables the pinch that would undo it, so
// the client was left stuck zoomed in mid-session. In a browser the site
// keeps its zoom, for visitors who need to enlarge the page.
if (Capacitor.isNativePlatform()) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    );
}

createRoot(document.getElementById("root")!).render(<App />);
