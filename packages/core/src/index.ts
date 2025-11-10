/**
 * @pyro/core - Core types and interfaces for Pyro SDK
 */

export interface RPCConfig {
  url: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface TransactionOptions {
  waitForConfirmation?: boolean;
  confirmationTimeout?: number;
  confirmationStatus?: "confirmed" | "finalized" | "processed";
  maxConfirmations?: number;
}

export interface SendOptions extends TransactionOptions {
  fee?: string | bigint;
  gasLimit?: string | bigint;
  gasPrice?: string | bigint;
  maxFeePerGas?: string | bigint;
  maxPriorityFeePerGas?: string | bigint;
}

export interface TransactionResult {
  txHash: string;
  blockNumber?: number;
  blockHash?: string;
  confirmations?: number;
  status: "pending" | "confirmed" | "failed";
}

export interface FeeWrapperConfig {
  feeRecipient: string;
  feeAmount: string | bigint;
  feeToken?: string; // Token address, undefined for native currency
}

export interface WrappedTransaction {
  data: string | Uint8Array;
  to: string;
  value?: string | bigint;
  gasLimit?: string | bigint;
  gasPrice?: string | bigint;
}

/**
 * Network configuration for EVM chains
 */
export type EVMNetwork =
  | "mainnet"
  | "sepolia"
  | "goerli"
  | "holesky"
  | "polygon"
  | "mumbai"
  | "arbitrum"
  | "arbitrum-sepolia"
  | "optimism"
  | "optimism-sepolia"
  | "base"
  | "base-sepolia";

/**
 * Network configuration for Solana
 */
export type SolanaNetwork = "mainnet-beta" | "testnet" | "devnet";

/**
 * Network configuration with RPC URLs
 */
export interface NetworkConfig {
  name: EVMNetwork | SolanaNetwork;
  rpcUrl: string;
  chainId?: number;
}

/**
 * Base error class for Pyro SDK
 */
export class PyroError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = "PyroError";
    Object.setPrototypeOf(this, PyroError.prototype);
  }
}

/**
 * RPC-related errors
 */
export class RPCError extends PyroError {
  constructor(
    message: string,
    public rpcUrl?: string,
    public statusCode?: number,
    context?: Record<string, any>
  ) {
    super(message, "RPC_ERROR", { ...context, rpcUrl, statusCode });
    this.name = "RPCError";
    Object.setPrototypeOf(this, RPCError.prototype);
  }
}

/**
 * Transaction-related errors
 */
export class TransactionError extends PyroError {
  constructor(
    message: string,
    public txHash?: string,
    public status?: string,
    context?: Record<string, any>
  ) {
    super(message, "TRANSACTION_ERROR", { ...context, txHash, status });
    this.name = "TransactionError";
    Object.setPrototypeOf(this, TransactionError.prototype);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends PyroError {
  constructor(
    message: string,
    public field?: string,
    context?: Record<string, any>
  ) {
    super(message, "VALIDATION_ERROR", { ...context, field });
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends PyroError {
  constructor(
    message: string,
    public timeout?: number,
    context?: Record<string, any>
  ) {
    super(message, "TIMEOUT_ERROR", { ...context, timeout });
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends PyroError {
  constructor(
    message: string,
    public configKey?: string,
    context?: Record<string, any>
  ) {
    super(message, "CONFIGURATION_ERROR", { ...context, configKey });
    this.name = "ConfigurationError";
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}
