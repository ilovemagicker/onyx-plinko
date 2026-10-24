import { describe, it, expect } from "vitest";
import { applyDrop, creditGuestStart } from "@/lib/ledger";

describe("applyDrop", () => {
  it("rejects when balance < ballCost", () => {
    expect(applyDrop(5, 10, 2)).toEqual({ ok: false, reason: "insufficient" });
  });

  it("debits cost then credits cost * multiplier", () => {
    // start 100, cost 10, land 2x → 100 - 10 + 20 = 110
    expect(applyDrop(100, 10, 2)).toEqual({ ok: true, balance: 110 });
  });

  it("supports 0.5x", () => {
    expect(applyDrop(100, 10, 0.5)).toEqual({ ok: true, balance: 95 });
  });
});

describe("creditGuestStart", () => {
  it("defaults to 1000", () => {
    expect(creditGuestStart()).toBe(1000);
  });
});
