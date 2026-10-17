import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell around the existing React app. One config, two behaviours.
 *
 * ANDROID loads the live site (`server.url`) instead of shipping the built
 * assets inside the APK. A push to main therefore reaches the app as fast
 * as it reaches the browser, with no store release and nothing for the
 * client to update.
 *
 * iOS ships the built assets (`webDir`) inside the app and only talks to
 * Supabase for data. Apple's guideline 4.2 rejects apps that are a wrapper
 * around a website, and an app that loads ldmove.com is exactly that. The
 * cost, decided knowingly: on iPhone a change to the screens needs an App
 * Store update (build `dist`, `npx cap sync ios`, upload, review).
 *
 * The CLI evaluates this file once per command, and the platform named on
 * the command line decides which config gets written into the native
 * project. A bare `npx cap sync` would write one config into both, so it
 * is refused: always name the platform.
 */
const args = process.argv.slice(2);
const platform = args.includes("ios")
  ? "ios"
  : args.includes("android")
    ? "android"
    : null;
const writesConfig = ["sync", "copy", "update", "run"].includes(args[0] ?? "");
if (writesConfig && !platform) {
  throw new Error(
    "Name the platform: `npx cap sync android` (live site) or `npx cap sync ios` (bundled). " +
      "A bare sync would give both apps the same config."
  );
}

const config: CapacitorConfig = {
  appId: "com.ldmove.app",
  appName: "LD Move",
  webDir: "dist",
  ...(platform === "android"
    ? {
        server: {
          url: "https://www.ldmove.com",
          // The site is HTTPS-only; refuse to silently downgrade.
          cleartext: false,
        },
      }
    : {}),
  android: {
    webContentsDebuggingEnabled: true,
  },
  ios: {
    // The web content draws under the notch and the home indicator and
    // pads itself with the safe-area CSS variables (index.css), as on
    // Android; letting iOS add its own inset as well would pad twice.
    contentInset: "never",
  },
};

export default config;
