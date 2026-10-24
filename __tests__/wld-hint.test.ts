import { describe, expect, it } from "vitest";
import { WORLD_APP_HINT } from "@/components/WldHint";
import { storageKey } from "@/lib/ledger-storage";

describe("WLD path", () => {
  it("exposes the plan Task 9 World App hint copy", () => {
    expect(WORLD_APP_HINT).toBe(
      "World App connect coming in v1.1 — demo chips only",
    );
  });

  it("uses the same address string for WLD and SOL storage keys", () => {
    const addr = "DemoWallet1111111111111111111111111111111";
    expect(storageKey(addr, "WLD")).toBe(`onyx-plinko:v1:${addr}:WLD`);
    expect(storageKey(addr, "SOL")).toBe(`onyx-plinko:v1:${addr}:SOL`);
    expect(storageKey(addr, "WLD")).not.toBe(storageKey(addr, "SOL"));
  });
});
