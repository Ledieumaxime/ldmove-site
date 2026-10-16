import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Fonts are served from our own domain: loading them from Google sent every
// visitor's IP address to Google without consent (GDPR).
import "@fontsource-variable/dm-sans/opsz.css";
import "@fontsource-variable/dm-sans/opsz-italic.css";
import "@fontsource-variable/playfair-display/wght.css";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
