import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

/** The iPhone app's version and build, read from the Xcode project so the
 *  code always knows which version it was shipped as (src/lib/appVersion).
 *  Empty when the project cannot be read, which the app treats as unknown. */
function iosAppVersion() {
  try {
    const pbx = fs.readFileSync(
      path.resolve(__dirname, "ios/App/App.xcodeproj/project.pbxproj"),
      "utf8"
    );
    return {
      version: pbx.match(/MARKETING_VERSION = ([\d.]+);/)?.[1] ?? "",
      build: pbx.match(/CURRENT_PROJECT_VERSION = (\d+);/)?.[1] ?? "",
    };
  } catch {
    return { version: "", build: "" };
  }
}
const ios = iosAppVersion();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __IOS_APP_VERSION__: JSON.stringify(ios.version),
    __IOS_APP_BUILD__: JSON.stringify(ios.build),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
