/**
 * Tests for @pyro/unoswap
 */

import { describe, it, expect } from "vitest";
import { getQuotes, coagulateQuotes, QuoteRequest } from "./index";

describe("getQuotes", () => {
  it("should throw error for unimplemented feature", async () => {
    const request: QuoteRequest = {
      tokenIn: "0x" + "1".repeat(40),
      tokenOut: "0x" + "2".repeat(40),
      amountIn: "1000000000000000000",
    };

    await expect(getQuotes(request)).rejects.toThrow(
      "Quote aggregation not yet implemented"
    );
  });
});

describe("coagulateQuotes", () => {
  it("should call getQuotes", async () => {
    const request: QuoteRequest = {
      tokenIn: "0x" + "1".repeat(40),
      tokenOut: "0x" + "2".repeat(40),
      amountIn: "1000000000000000000",
    };

    await expect(coagulateQuotes(request)).rejects.toThrow(
      "Quote aggregation not yet implemented"
    );
  });
});
