import { describe, expect, it } from "vitest";
import { truncateAddress } from "@/components/ShellHeader";

describe("truncateAddress", () => {
  it("shortens a typical base58 pubkey", () => {
    const addr = "So11111111111111111111111111111111111111112";
    expect(truncateAddress(addr)).toBe("So11…1112");
  });

  it("leaves short strings alone", () => {
    expect(truncateAddress("abc")).toBe("abc");
  });
});
