/**
 * Tests for @pyro/core
 */

import { describe, it, expect } from "vitest";
import {
  PyroError,
  RPCError,
  TransactionError,
  ValidationError,
  TimeoutError,
  ConfigurationError,
} from "./index";

describe("PyroError", () => {
  it("should create error with message", () => {
    const error = new PyroError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("PyroError");
  });

  it("should create error with code and context", () => {
    const error = new PyroError("Test error", "TEST_CODE", { key: "value" });
    expect(error.code).toBe("TEST_CODE");
    expect(error.context).toEqual({ key: "value" });
  });
});

describe("RPCError", () => {
  it("should create RPC error", () => {
    const error = new RPCError("RPC failed", "https://example.com", 500);
    expect(error.message).toBe("RPC failed");
    expect(error.rpcUrl).toBe("https://example.com");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("RPC_ERROR");
    expect(error.name).toBe("RPCError");
  });
});

describe("TransactionError", () => {
  it("should create transaction error", () => {
    const error = new TransactionError("Tx failed", "0x123", "failed");
    expect(error.message).toBe("Tx failed");
    expect(error.txHash).toBe("0x123");
    expect(error.status).toBe("failed");
    expect(error.code).toBe("TRANSACTION_ERROR");
    expect(error.name).toBe("TransactionError");
  });
});

describe("ValidationError", () => {
  it("should create validation error", () => {
    const error = new ValidationError("Invalid input", "fieldName");
    expect(error.message).toBe("Invalid input");
    expect(error.field).toBe("fieldName");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.name).toBe("ValidationError");
  });
});

describe("TimeoutError", () => {
  it("should create timeout error", () => {
    const error = new TimeoutError("Timeout", 30);
    expect(error.message).toBe("Timeout");
    expect(error.timeout).toBe(30);
    expect(error.code).toBe("TIMEOUT_ERROR");
    expect(error.name).toBe("TimeoutError");
  });
});

describe("ConfigurationError", () => {
  it("should create configuration error", () => {
    const error = new ConfigurationError("Config invalid", "configKey");
    expect(error.message).toBe("Config invalid");
    expect(error.configKey).toBe("configKey");
    expect(error.code).toBe("CONFIGURATION_ERROR");
    expect(error.name).toBe("ConfigurationError");
  });
});
