/**
 * Tests for @pyro/utils
 */

import { describe, it, expect } from "vitest";
import {
  toHex,
  hexToBigInt,
  bytesToHex,
  hexToBytes,
  sleep,
  retry,
  logger,
  LogLevel,
} from "./index";

describe("toHex", () => {
  it("should convert bigint to hex", () => {
    expect(toHex(BigInt(255))).toBe("0xff");
    expect(toHex(BigInt(0))).toBe("0x0");
    expect(toHex(BigInt(256))).toBe("0x100");
  });

  it("should convert number to hex", () => {
    expect(toHex(255)).toBe("0xff");
    expect(toHex(0)).toBe("0x0");
  });

  it("should convert string to hex", () => {
    expect(toHex("255")).toBe("0xff");
    expect(toHex("0x100")).toBe("0x100");
  });

  it("should convert Uint8Array to hex", () => {
    const bytes = new Uint8Array([255, 0, 128]);
    expect(toHex(bytes)).toBe("0xff0080");
  });

  it("should throw error for invalid type", () => {
    expect(() => toHex(null as any)).toThrow();
    expect(() => toHex(undefined as any)).toThrow();
  });
});

describe("hexToBigInt", () => {
  it("should convert hex string to bigint", () => {
    expect(hexToBigInt("0xff")).toBe(BigInt(255));
    expect(hexToBigInt("ff")).toBe(BigInt(255));
    expect(hexToBigInt("0x0")).toBe(BigInt(0));
  });
});

describe("bytesToHex", () => {
  it("should convert bytes to hex", () => {
    const bytes = new Uint8Array([255, 0, 128]);
    expect(bytesToHex(bytes)).toBe("0xff0080");
  });

  it("should handle empty array", () => {
    expect(bytesToHex(new Uint8Array([]))).toBe("0x");
  });
});

describe("hexToBytes", () => {
  it("should convert hex to bytes", () => {
    const bytes = hexToBytes("0xff0080");
    expect(bytes).toEqual(new Uint8Array([255, 0, 128]));
  });

  it("should handle hex without 0x prefix", () => {
    const bytes = hexToBytes("ff0080");
    expect(bytes).toEqual(new Uint8Array([255, 0, 128]));
  });
});

describe("sleep", () => {
  it("should wait for specified time", async () => {
    const start = Date.now();
    await sleep(100);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(90);
    expect(end - start).toBeLessThan(200);
  });
});

describe("retry", () => {
  it("should retry on failure", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error("Failed");
      }
      return "success";
    };

    const result = await retry(fn, 3, 10);
    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("should throw after max retries", async () => {
    const fn = async () => {
      throw new Error("Always fails");
    };

    await expect(retry(fn, 2, 10)).rejects.toThrow("Always fails");
  });

  it("should succeed on first try", async () => {
    const fn = async () => "success";
    const result = await retry(fn, 3, 10);
    expect(result).toBe("success");
  });
});

describe("logger", () => {
  it("should have default log level", () => {
    expect(logger.getLevel()).toBe(LogLevel.INFO);
  });

  it("should allow setting log level", () => {
    logger.setLevel(LogLevel.DEBUG);
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    logger.setLevel(LogLevel.INFO); // Reset
  });
});
