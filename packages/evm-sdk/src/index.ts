/**
 * @pyro/evm-sdk - EVM SDK for Pyro
 */

import {
  JsonRpcProvider,
  Wallet,
  TransactionRequest,
  TransactionResponse,
  TransactionReceipt,
  Provider,
  Contract,
} from 'ethers';
import { RPCConfig, SendOptions, TransactionResult } from '@pyro/core';
import { bytesToHex, sleep, retry } from '@pyro/utils';

// ERC20 ABI for transfer function
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
];

export interface EVMSDKConfig {
  rpc?: RPCConfig | string;
  provider?: Provider;
  chainId?: number;
}

export class EVMSDK {
  private provider: Provider;
  private chainId?: number;

  constructor(config: EVMSDKConfig = {}) {
    if (config.provider) {
      this.provider = config.provider;
    } else {
      const rpcUrl = typeof config.rpc === 'string' 
        ? config.rpc 
        : config.rpc?.url || 'https://eth.llamarpc.com';
      
      this.provider = new JsonRpcProvider(rpcUrl, undefined, {
        ...(typeof config.rpc === 'object' && config.rpc.headers
          ? { staticNetwork: true }
          : {}),
      });
    }
    
    this.chainId = config.chainId;
  }

  /**
   * Get the provider instance
   */
  getProvider(): Provider {
    return this.provider;
  }

  /**
   * Send native currency (ETH, etc.) or ERC20 tokens to an address
   * @param wallet - Wallet to send from
   * @param to - Recipient address
   * @param amount - Amount to send (in wei for native currency, in token units for ERC20)
   * @param options - Send options including confirmation settings
   * @param tokenAddress - Optional ERC20 token address. If not provided, sends native currency
   */
  async send(
    wallet: Wallet,
    to: string,
    amount: string | bigint,
    options: SendOptions = {},
    tokenAddress?: string
  ): Promise<TransactionResult> {
    const connectedWallet = wallet.connect(this.provider);
    const value = typeof amount === 'bigint' ? amount : BigInt(amount);

    let txResponse: TransactionResponse;

    if (tokenAddress) {
      // Send ERC20 token
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, connectedWallet);
      
      const txRequest: TransactionRequest = {
        to: tokenAddress,
        data: tokenContract.interface.encodeFunctionData('transfer', [to, value]),
      };

      // Set gas options if provided
      if (options.gasLimit) {
        txRequest.gasLimit = typeof options.gasLimit === 'bigint' 
          ? options.gasLimit 
          : BigInt(options.gasLimit);
      }

      if (options.gasPrice) {
        txRequest.gasPrice = typeof options.gasPrice === 'bigint' 
          ? options.gasPrice 
          : BigInt(options.gasPrice);
      }

      if (options.maxFeePerGas) {
        txRequest.maxFeePerGas = typeof options.maxFeePerGas === 'bigint' 
          ? options.maxFeePerGas 
          : BigInt(options.maxFeePerGas);
      }

      if (options.maxPriorityFeePerGas) {
        txRequest.maxPriorityFeePerGas = typeof options.maxPriorityFeePerGas === 'bigint' 
          ? options.maxPriorityFeePerGas 
          : BigInt(options.maxPriorityFeePerGas);
      }

      txResponse = await connectedWallet.sendTransaction(txRequest);
    } else {
      // Send native currency
      const txRequest: TransactionRequest = {
        to,
        value,
      };

      // Set gas options if provided
      if (options.gasLimit) {
        txRequest.gasLimit = typeof options.gasLimit === 'bigint' 
          ? options.gasLimit 
          : BigInt(options.gasLimit);
      }

      if (options.gasPrice) {
        txRequest.gasPrice = typeof options.gasPrice === 'bigint' 
          ? options.gasPrice 
          : BigInt(options.gasPrice);
      }

      if (options.maxFeePerGas) {
        txRequest.maxFeePerGas = typeof options.maxFeePerGas === 'bigint' 
          ? options.maxFeePerGas 
          : BigInt(options.maxFeePerGas);
      }

      if (options.maxPriorityFeePerGas) {
        txRequest.maxPriorityFeePerGas = typeof options.maxPriorityFeePerGas === 'bigint' 
          ? options.maxPriorityFeePerGas 
          : BigInt(options.maxPriorityFeePerGas);
      }

      txResponse = await connectedWallet.sendTransaction(txRequest);
    }

    if (options.waitForConfirmation !== false) {
      return await this.waitForConfirmation(
        txResponse.hash,
        options.maxConfirmations || 1,
        options.confirmationTimeout
      );
    }

    return {
      txHash: txResponse.hash,
      status: 'pending',
    };
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    txHash: string,
    maxConfirmations: number = 1,
    timeout?: number
  ): Promise<TransactionResult> {
    const startTime = Date.now();
    const timeoutMs = timeout ? timeout * 1000 : 60000; // Default 60 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const receipt = await retry(
          () => this.provider.getTransactionReceipt(txHash),
          3,
          1000
        );

        if (receipt) {
          // Check if we have enough confirmations
          if (maxConfirmations > 1) {
            const currentBlock = await this.provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber + 1;
            
            if (confirmations >= maxConfirmations) {
              return {
                txHash: receipt.hash,
                blockNumber: Number(receipt.blockNumber),
                blockHash: receipt.blockHash,
                confirmations: Number(confirmations),
                status: receipt.status === 1 ? 'confirmed' : 'failed',
              };
            }
          } else {
            // Single confirmation is enough
            return {
              txHash: receipt.hash,
              blockNumber: Number(receipt.blockNumber),
              blockHash: receipt.blockHash,
              confirmations: 1,
              status: receipt.status === 1 ? 'confirmed' : 'failed',
            };
          }
        }

        // Transaction not yet mined, wait and retry
        await sleep(2000);
      } catch (error) {
        // Continue polling on error
        await sleep(2000);
      }
    }

    // Timeout reached
    return {
      txHash,
      status: 'pending',
    };
  }

  /**
   * Receive transaction information
   */
  async receive(txHash: string): Promise<TransactionReceipt | null> {
    return await this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<TransactionResult> {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return {
        txHash,
        status: 'pending',
      };
    }

    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;

    return {
      txHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      blockHash: receipt.blockHash,
      confirmations: Number(confirmations),
      status: receipt.status === 1 ? 'confirmed' : 'failed',
    };
  }

  /**
   * Send raw transaction data (bytes)
   */
  async sendRawTransaction(
    wallet: Wallet,
    to: string,
    data: string | Uint8Array,
    value?: string | bigint,
    options: SendOptions = {}
  ): Promise<TransactionResult> {
    const connectedWallet = wallet.connect(this.provider);
    
    const txRequest: TransactionRequest = {
      to,
      data: typeof data === 'string' ? data : bytesToHex(data),
    };

    if (value !== undefined) {
      txRequest.value = typeof value === 'bigint' ? value : BigInt(value);
    }

    if (options.gasLimit) {
      txRequest.gasLimit = typeof options.gasLimit === 'bigint' 
        ? options.gasLimit 
        : BigInt(options.gasLimit);
    }

    if (options.gasPrice) {
      txRequest.gasPrice = typeof options.gasPrice === 'bigint' 
        ? options.gasPrice 
        : BigInt(options.gasPrice);
    }

    if (options.maxFeePerGas) {
      txRequest.maxFeePerGas = typeof options.maxFeePerGas === 'bigint' 
        ? options.maxFeePerGas 
        : BigInt(options.maxFeePerGas);
    }

    if (options.maxPriorityFeePerGas) {
      txRequest.maxPriorityFeePerGas = typeof options.maxPriorityFeePerGas === 'bigint' 
        ? options.maxPriorityFeePerGas 
        : BigInt(options.maxPriorityFeePerGas);
    }

    const txResponse: TransactionResponse = await connectedWallet.sendTransaction(txRequest);

    if (options.waitForConfirmation !== false) {
      return await this.waitForConfirmation(
        txResponse.hash,
        options.maxConfirmations || 1,
        options.confirmationTimeout
      );
    }

    return {
      txHash: txResponse.hash,
      status: 'pending',
    };
  }
}

