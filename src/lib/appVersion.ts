import { Capacitor } from "@capacitor/core";

/** Version of the iPhone app this code was built into, read at build time
 *  from the Xcode project (see vite.config.ts). The release script bumps
 *  the build number before building, so both are the ones Apple receives.
 *  On the website and in the Android app they are present but unused. */
export const IOS_APP_VERSION: string = __IOS_APP_VERSION__;
export const IOS_APP_BUILD: string = __IOS_APP_BUILD__;

export const isIosApp = () => Capacitor.getPlatform() === "ios";

/** True when `version` is strictly lower than `minimum`, comparing
 *  "1.0.3"-style numbers part by part. Anything unreadable on either side
 *  answers false: a version we cannot read must never lock a client out. */
export function isOlderThan(version: string, minimum: string): boolean {
  const parse = (v: string) =>
    /^\d+(\.\d+)*$/.test(v.trim()) ? v.trim().split(".").map(Number) : null;
  const a = parse(version);
  const b = parse(minimum);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
