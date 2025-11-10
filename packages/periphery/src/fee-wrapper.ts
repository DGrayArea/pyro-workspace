/**
 * Fee wrapper utilities for Pyro
 */

import { FeeWrapperConfig, WrappedTransaction } from '@pyro-labs/core';
import { bytesToHex } from '@pyro-labs/utils';

/**
 * Wrap a transaction with Pyro fee
 * This creates transaction data that includes fee payment
 */
export function wrapTransactionWithFee(
  originalTxData: string | Uint8Array,
  config: FeeWrapperConfig
): WrappedTransaction {
  const data = typeof originalTxData === 'string' 
    ? originalTxData 
    : bytesToHex(originalTxData);

  // This is a placeholder - actual implementation would encode
  // the fee wrapper contract call with the original transaction data
  // The fee wrapper contract would:
  // 1. Execute the original transaction
  // 2. Transfer fee to feeRecipient
  
  const wrappedData = encodeFeeWrapperCall(data, config);

  return {
    data: wrappedData,
    to: config.feeRecipient, // Fee wrapper contract address
    value: config.feeToken ? '0' : config.feeAmount,
  };
}

/**
 * Encode fee wrapper contract call
 * This is a simplified version - actual implementation would use ABI encoding
 */
function encodeFeeWrapperCall(
  originalData: string,
  config: FeeWrapperConfig
): string {
  // Placeholder implementation
  // In production, this would:
  // 1. Encode function selector for fee wrapper
  // 2. Encode parameters: originalTxData, feeAmount, feeToken
  // 3. Return encoded calldata
  
  // For now, return a placeholder that indicates this needs contract ABI
  return `0x${originalData.slice(2)}${encodeFeeConfig(config)}`;
}

function encodeFeeConfig(config: FeeWrapperConfig): string {
  const feeAmount = typeof config.feeAmount === 'bigint' 
    ? config.feeAmount.toString(16).padStart(64, '0')
    : BigInt(config.feeAmount).toString(16).padStart(64, '0');
  
  const feeToken = config.feeToken || '0'.repeat(64);
  
  return feeAmount + feeToken.slice(2);
}

