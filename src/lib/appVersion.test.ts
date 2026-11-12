import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "web" },
}));
vi.stubGlobal("__IOS_APP_VERSION__", "1.0.3");
vi.stubGlobal("__IOS_APP_BUILD__", "7");

const { isOlderThan } = await import("./appVersion");

describe("isOlderThan", () => {
  it("compares part by part, not as text", () => {
    expect(isOlderThan("1.0.3", "1.0.10")).toBe(true);
    expect(isOlderThan("1.0.10", "1.0.3")).toBe(false);
    expect(isOlderThan("1.0.2", "1.1")).toBe(true);
  });

  it("lets the same version through", () => {
    expect(isOlderThan("1.0.3", "1.0.3")).toBe(false);
    expect(isOlderThan("1.0", "1.0.0")).toBe(false);
  });

  it("never blocks on a version it cannot read", () => {
    expect(isOlderThan("", "1.0.3")).toBe(false);
    expect(isOlderThan("1.0.3", "")).toBe(false);
    expect(isOlderThan("beta", "1.0.3")).toBe(false);
  });

  it("the default minimum lets every real version through", () => {
    expect(isOlderThan("1.0.3", "1.0.0")).toBe(false);
  });
});
