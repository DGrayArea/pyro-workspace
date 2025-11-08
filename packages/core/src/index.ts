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
  confirmationStatus?: 'confirmed' | 'finalized' | 'processed';
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
  status: 'pending' | 'confirmed' | 'failed';
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

