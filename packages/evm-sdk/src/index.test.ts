/**
 * Tests for @pyro/evm-sdk
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EVMSDK } from "./index";
import { Wallet, JsonRpcProvider } from "ethers";
import { ValidationError } from "@pyro-labs/core";

// Mock ethers
vi.mock("ethers", async () => {
  const actual = await vi.importActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: vi.fn(),
  };
});

describe("EVMSDK", () => {
  let mockProvider: any;

  beforeEach(() => {
    mockProvider = {
      getTransactionReceipt: vi.fn(),
      getBlockNumber: vi.fn(),
    };

    (JsonRpcProvider as any).mockImplementation(() => mockProvider);
  });

  describe("constructor", () => {
    it("should create SDK with default RPC", () => {
      const sdk = new EVMSDK();
      expect(sdk).toBeDefined();
    });

    it("should create SDK with custom RPC", () => {
      const sdk = new EVMSDK({ rpc: "https://custom-rpc.com" });
      expect(sdk).toBeDefined();
    });

    it("should create SDK with provider", () => {
      const sdk = new EVMSDK({ provider: mockProvider });
      expect(sdk.getProvider()).toBe(mockProvider);
    });
  });

  describe("send", () => {
    it("should validate recipient address", async () => {
      const sdk = new EVMSDK({ provider: mockProvider });
      const wallet = new Wallet("0x" + "1".repeat(64));

      await expect(
        sdk.send(wallet, "invalid-address", "1000000000000000000")
      ).rejects.toThrow(ValidationError);
    });

    it("should validate amount", async () => {
      const sdk = new EVMSDK({ provider: mockProvider });
      const wallet = new Wallet("0x" + "1".repeat(64));

      await expect(
        sdk.send(wallet, "0x" + "2".repeat(40), "0")
      ).rejects.toThrow(ValidationError);
    });

    it("should validate token address if provided", async () => {
      const sdk = new EVMSDK({ provider: mockProvider });
      const wallet = new Wallet("0x" + "1".repeat(64));

      await expect(
        sdk.send(
          wallet,
          "0x" + "2".repeat(40),
          "1000000000000000000",
          {},
          "invalid-token"
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("receive", () => {
    it("should validate transaction hash", async () => {
      const sdk = new EVMSDK({ provider: mockProvider });

      await expect(sdk.receive("invalid-hash")).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("getTransactionStatus", () => {
    it("should validate transaction hash", async () => {
      const sdk = new EVMSDK({ provider: mockProvider });

      await expect(sdk.getTransactionStatus("invalid-hash")).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("sendRawTransaction", () => {
    it("should validate recipient address", async () => {
      const sdk = new EVMSDK({ provider: mockProvider });
      const wallet = new Wallet("0x" + "1".repeat(64));

      await expect(
        sdk.sendRawTransaction(wallet, "invalid-address", "0x1234")
      ).rejects.toThrow(ValidationError);
    });

    it("should validate data is not empty", async () => {
      const sdk = new EVMSDK({ provider: mockProvider });
      const wallet = new Wallet("0x" + "1".repeat(64));

      await expect(
        sdk.sendRawTransaction(wallet, "0x" + "2".repeat(40), "")
      ).rejects.toThrow(ValidationError);
    });
  });
});
