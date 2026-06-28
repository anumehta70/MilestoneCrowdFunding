import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  formatPercent,
  shortenAddress,
  stroopsToXlm,
  xlmToStroops,
} from "@/lib/format";

describe("stroopsToXlm", () => {
  it("converts whole stroop amounts to XLM", () => {
    expect(stroopsToXlm("10000000")).toBe("1");
  });

  it("converts fractional stroop amounts to XLM", () => {
    expect(stroopsToXlm("15000000")).toBe("1.5");
  });

  it("handles zero", () => {
    expect(stroopsToXlm("0")).toBe("0");
  });

  it("strips trailing zeros from the fractional part", () => {
    expect(stroopsToXlm("10500000")).toBe("1.05");
  });
});

describe("xlmToStroops", () => {
  it("converts whole XLM amounts to stroops", () => {
    expect(xlmToStroops("1")).toBe("10000000");
  });

  it("converts fractional XLM amounts to stroops", () => {
    expect(xlmToStroops("1.5")).toBe("15000000");
  });

  it("round-trips with stroopsToXlm", () => {
    const original = "1234.5678901";
    expect(stroopsToXlm(xlmToStroops(original))).toBe(original);
  });

  it("handles empty input as zero", () => {
    expect(xlmToStroops("")).toBe("0");
  });
});

describe("shortenAddress", () => {
  it("shortens long Stellar contract addresses", () => {
    const address = "CABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTU";
    expect(shortenAddress(address)).toBe("CABC…RSTU");
  });

  it("returns short addresses unchanged", () => {
    expect(shortenAddress("CABCDEF")).toBe("CABCDEF");
  });
});

describe("formatPercent", () => {
  it("calculates a basic percentage", () => {
    expect(formatPercent("500000", "1000000")).toBe(50);
  });

  it("caps at 100 percent even if numerator exceeds denominator", () => {
    expect(formatPercent("2000000", "1000000")).toBe(100);
  });

  it("returns 0 when denominator is zero", () => {
    expect(formatPercent("100", "0")).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("reports campaign ended for past deadlines", () => {
    const past = Date.now() / 1000 - 1000;
    expect(formatCountdown(past)).toBe("Campaign ended");
  });

  it("reports days and hours remaining for future deadlines", () => {
    const future = Date.now() / 1000 + 2 * 86_400 + 3 * 3_600;
    expect(formatCountdown(future)).toMatch(/2d \dh left/);
  });
});
