import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell around the existing React app.
 *
 * `server.url` points the app at the live site instead of shipping the
 * built assets inside the APK. A push to main therefore reaches the app
 * as fast as it reaches the browser, with no store release and nothing
 * for the client to update: the same workflow we already have.
 *
 * The trade-off, decided knowingly: Apple's guideline 4.2 rejects apps
 * that are a wrapper around a website, so this config is Android-only.
 * An iOS build would need the bundled `webDir` below plus real native
 * features (push, camera, offline) to stand a chance at review.
 *
 * `webDir` stays set because Capacitor requires it and it is what an
 * iOS build (or a bundled Android build) would fall back to.
 */
const config: CapacitorConfig = {
  appId: "com.ldmove.app",
  appName: "LD Move",
  webDir: "dist",
  server: {
    url: "https://www.ldmove.com",
    // The site is HTTPS-only; refuse to silently downgrade.
    cleartext: false,
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
