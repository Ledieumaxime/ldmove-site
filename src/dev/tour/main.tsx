import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans/opsz.css";
import "@fontsource-variable/dm-sans/opsz-italic.css";
import "@fontsource-variable/playfair-display/wght.css";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@/index.css";
import { installMocks } from "./mocks";

// The mocks must be in place before anything reads the session.
installMocks();
const { default: TourSlides } = await import("./TourSlides");

createRoot(document.getElementById("root")!).render(<TourSlides />);
