/**
 * Tests for fee-wrapper
 */

import { describe, it, expect } from "vitest";
import { wrapTransactionWithFee } from "./fee-wrapper";
import { FeeWrapperConfig } from "@pyro-labs/core";

describe("wrapTransactionWithFee", () => {
  it("should wrap transaction with fee", () => {
    const originalData = "0x123456";
    const config: FeeWrapperConfig = {
      feeRecipient: "0x" + "1".repeat(40),
      feeAmount: "1000000000000000000",
    };

    const result = wrapTransactionWithFee(originalData, config);
    expect(result).toBeDefined();
    expect(result.to).toBe(config.feeRecipient);
    expect(result.data).toBeDefined();
  });

  it("should handle Uint8Array data", () => {
    const originalData = new Uint8Array([0x12, 0x34, 0x56]);
    const config: FeeWrapperConfig = {
      feeRecipient: "0x" + "1".repeat(40),
      feeAmount: BigInt("1000000000000000000"),
    };

    const result = wrapTransactionWithFee(originalData, config);
    expect(result).toBeDefined();
    expect(result.to).toBe(config.feeRecipient);
  });

  it("should handle fee token", () => {
    const originalData = "0x123456";
    const config: FeeWrapperConfig = {
      feeRecipient: "0x" + "1".repeat(40),
      feeAmount: "1000000000000000000",
      feeToken: "0x" + "2".repeat(40),
    };

    const result = wrapTransactionWithFee(originalData, config);
    expect(result).toBeDefined();
  });
});
